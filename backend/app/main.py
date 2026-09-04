from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .schemas import (
    HealthResponse,
    FloodPredictionRequest,
    FloodPredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    HazardEvaluationRequest,
    HazardEvaluationResponse,
    AlertGenerationRequest,
    AlertGenerationResponse,
    InfrastructureItem,
)
from .ml_predictor import LightGBMFloodPredictor
from .ffs_collector import collect_ffs_snapshot, generate_regional_grid
from .supabase_service import supabase_service
from .featherless_agent import FeatherlessAgent
from .alert_orchestrator import AlertOrchestrator

# Application singletons
orchestrator: AlertOrchestrator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global orchestrator
    print(f"[{settings.app_name}] Initializing AI pipeline & services...")
    orchestrator = AlertOrchestrator()
    yield
    print(f"[{settings.app_name}] Shutting down gracefully...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Hybrid AI flood risk forecasting, tabular LightGBM spatial probability, and tactical emergency orchestration engine.",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check() -> HealthResponse:
    """Service health and component status check."""
    global orchestrator
    model_ready = orchestrator is not None and orchestrator.predictor.model is not None
    supabase_configured = supabase_service.is_connected
    llm_configured = orchestrator is not None and orchestrator.llm_agent.is_configured

    return HealthResponse(
        status="ok",
        version=settings.app_version,
        model_ready=model_ready,
        supabase_configured=supabase_configured,
        llm_configured=llm_configured,
    )


@app.post("/predict", response_model=FloodPredictionResponse, tags=["Prediction"])
def predict_flood_probability(request: FloodPredictionRequest) -> FloodPredictionResponse:
    """Predict point flood probability using tabular LightGBM model."""
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    features = request.model_dump()
    detailed_pred = orchestrator.predictor.predict_detailed(features)

    return FloodPredictionResponse(
        latitude=request.latitude,
        longitude=request.longitude,
        rainfall_mm=request.rainfall_mm,
        probability=detailed_pred["probability"],
        hazard_level=detailed_pred["hazard_level"],
        features_used=detailed_pred["features_used"],
    )


@app.post("/predict/batch", response_model=BatchPredictionResponse, tags=["Prediction"])
def batch_predict(request: BatchPredictionRequest) -> BatchPredictionResponse:
    """Batch prediction across multiple geographic coordinates (e.g. for MapCanvas heatmap)."""
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    results = []
    high_risk = 0
    for pt in request.points:
        pred = orchestrator.predictor.predict_detailed(pt.model_dump())
        if pred["hazard_level"] in ("High", "Critical"):
            high_risk += 1
        results.append(
            FloodPredictionResponse(
                latitude=pt.latitude,
                longitude=pt.longitude,
                rainfall_mm=pt.rainfall_mm,
                probability=pred["probability"],
                hazard_level=pred["hazard_level"],
                features_used=pred["features_used"],
            )
        )

    return BatchPredictionResponse(
        total_points=len(results),
        high_risk_points=high_risk,
        predictions=results,
    )


@app.get("/ffs/snapshot", tags=["Flash Flood Guidance"])
def get_ffs_snapshot(
    latitude: float = Query(13.0827, ge=-90.0, le=90.0),
    longitude: float = Query(80.2707, ge=-180.0, le=180.0)
):
    """Retrieve real-time Flash Flood Guidance (FFS) metrics and saturation snapshot."""
    return collect_ffs_snapshot(latitude=latitude, longitude=longitude)


@app.get("/ffs/grid", tags=["Flash Flood Guidance"])
def get_ffs_grid(
    center_lat: float = Query(13.0827, ge=-90.0, le=90.0),
    center_lon: float = Query(80.2707, ge=-180.0, le=180.0),
    grid_size: int = Query(3, ge=1, le=7),
    step_deg: float = Query(0.04, ge=0.01, le=0.2)
):
    """Retrieve spatial grid of FFS observations for map visualization."""
    return generate_regional_grid(
        center_lat=center_lat,
        center_lon=center_lon,
        grid_size=grid_size,
        step_deg=step_deg
    )


@app.post("/evaluate-hazard", response_model=HazardEvaluationResponse, tags=["Hazard Evaluation"])
def evaluate_hazard(request: HazardEvaluationRequest) -> HazardEvaluationResponse:
    """Evaluate compound hazard intersecting flood probability with critical infrastructure."""
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    result = orchestrator.evaluate_compound_hazard(
        latitude=request.latitude,
        longitude=request.longitude,
        rainfall_mm=request.rainfall_mm,
        radius_km=request.radius_km
    )

    infra_items = [InfrastructureItem(**item) for item in result["threatened_infrastructure"]]

    return HazardEvaluationResponse(
        latitude=result["latitude"],
        longitude=result["longitude"],
        rainfall_mm=result["rainfall_mm"],
        flood_probability=result["flood_probability"],
        hazard_level=result["hazard_level"],
        compound_risk_score=result["compound_risk_score"],
        threatened_infrastructure=infra_items,
    )


@app.post("/alerts/generate", response_model=AlertGenerationResponse, tags=["Alerts"])
def generate_alert(request: AlertGenerationRequest) -> AlertGenerationResponse:
    """Trigger Featherless AI to generate an emergency tactical alert and persist it in Supabase."""
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    alert_record = orchestrator.generate_and_save_alert(
        latitude=request.latitude,
        longitude=request.longitude,
        rainfall_mm=request.rainfall_mm,
        location_name=request.location_name,
        radius_km=request.radius_km
    )

    infra_items = [InfrastructureItem(**item) for item in alert_record["threatened_infrastructure"]]

    return AlertGenerationResponse(
        alert_id=alert_record["id"],
        severity=alert_record["severity"],
        location_name=alert_record["location_name"],
        advisory_title=alert_record["advisory_title"],
        advisory_markdown=alert_record["advisory_markdown"],
        recommended_actions=alert_record["recommended_actions"],
        threatened_infrastructure_count=alert_record["threatened_infrastructure_count"],
        threatened_infrastructure=infra_items,
        flood_probability=alert_record["flood_probability"],
    )


@app.get("/alerts", tags=["Alerts"])
def list_recent_alerts(limit: int = Query(10, ge=1, le=50)):
    """Retrieve recent alerts stored in Supabase or in-memory cache."""
    return supabase_service.get_recent_alerts(limit=limit)


@app.get("/infrastructure", response_model=List[InfrastructureItem], tags=["Infrastructure"])
def get_infrastructure(
    latitude: float = Query(13.0827, ge=-90.0, le=90.0),
    longitude: float = Query(80.2707, ge=-180.0, le=180.0),
    radius_km: float = Query(10.0, ge=0.5, le=50.0)
) -> List[InfrastructureItem]:
    """Retrieve critical infrastructure nodes within radius."""
    raw_assets = supabase_service.get_infrastructure_assets(
        center_lat=latitude,
        center_lon=longitude,
        radius_km=radius_km
    )
    return [InfrastructureItem(**item) for item in raw_assets]
