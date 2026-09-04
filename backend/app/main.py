from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import FastAPI, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from .config import settings
from .schemas import (
    HealthResponse,
    ModelStatusResponse,
    FloodPredictionRequest,
    FloodPredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    HazardEvaluationRequest,
    HazardEvaluationResponse,
    AlertGenerationRequest,
    AlertGenerationResponse,
    InfrastructureItem,
    HazardMapMetadataResponse,
)
from .ml_predictor import FEATURE_NAMES, LightGBMFloodPredictor, predictor
from .terrain_service import terrain_service
from .rainfall_service import load_historical_rainfall_series, BASELINE_RAIN_SUMMARY
from .ffs_collector import collect_ffs_snapshot, generate_regional_grid
from .supabase_service import supabase_service
from .alert_orchestrator import AlertOrchestrator

# Application singletons
orchestrator: Optional[AlertOrchestrator] = None


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
    """Service health, model readiness, database, and DEM cache status check."""
    global orchestrator
    model_ready = (orchestrator is not None and orchestrator.predictor.model is not None) or (predictor.model is not None)
    supabase_configured = supabase_service.is_connected
    llm_configured = orchestrator is not None and orchestrator.llm_agent.is_configured
    dem_cached = terrain_service.is_loaded

    return HealthResponse(
        status="ok",
        version=settings.app_version,
        model_ready=model_ready,
        supabase_configured=supabase_configured,
        llm_configured=llm_configured,
        dem_cached=dem_cached,
    )


@app.get("/model/status", response_model=ModelStatusResponse, tags=["Model"])
def get_model_status() -> ModelStatusResponse:
    """Detailed ML model metadata, 13 feature schema, and prototype disclaimer."""
    return ModelStatusResponse(
        model_name="lgb_flood_model.txt",
        feature_count=len(FEATURE_NAMES),
        feature_names=FEATURE_NAMES,
        is_loaded=predictor.model is not None,
        dem_cached=terrain_service.is_loaded,
        disclaimer="AI-based Flood Susceptibility Estimate (Experimental Prototype). This model estimates relative spatial flood susceptibility based on topography and rainfall scenarios. It is not an official real-time evacuation or emergency warning.",
    )


@app.post("/predict", response_model=FloodPredictionResponse, tags=["Prediction"])
def predict_flood_probability(request: FloodPredictionRequest) -> FloodPredictionResponse:
    """
    Predict point flood susceptibility using the trained LightGBM model.
    Derives 9 DEM terrain features and 4 hydrological rainfall features automatically,
    or accepts explicit feature overrides.
    """
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    overrides = {
        "elevation": request.elevation,
        "slope": request.slope,
        "aspect": request.aspect,
        "curvature": request.curvature,
        "tri": request.tri,
        "twi": request.twi,
        "rel_elev": request.rel_elev,
        "flow_acc_log": request.flow_acc_log,
        "dist_to_stream": request.dist_to_stream,
        "total_rainfall_mm": request.total_rainfall_mm,
        "max_hourly_mm": request.max_hourly_mm,
        "max_cum24h_mm": request.max_cum24h_mm,
        "max_api": request.max_api,
    }

    pred = orchestrator.predictor.predict_coordinate(
        latitude=request.latitude,
        longitude=request.longitude,
        rainfall_mm=request.rainfall_mm,
        overrides=overrides,
    )

    return FloodPredictionResponse(
        latitude=request.latitude,
        longitude=request.longitude,
        rainfall_mm=request.rainfall_mm,
        susceptibility=pred["susceptibility"],
        probability=pred["susceptibility"],
        risk_level=pred["risk_level"],
        hazard_level=pred["risk_level"],
        features_used=pred["features_used"],
    )


@app.post("/predict/batch", response_model=BatchPredictionResponse, tags=["Prediction"])
def batch_predict(request: BatchPredictionRequest) -> BatchPredictionResponse:
    """Batch prediction across multiple geographic coordinates."""
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    results = []
    high_risk = 0
    for pt in request.points:
        overrides = {
            "elevation": pt.elevation,
            "slope": pt.slope,
            "aspect": pt.aspect,
            "curvature": pt.curvature,
            "tri": pt.tri,
            "twi": pt.twi,
            "rel_elev": pt.rel_elev,
            "flow_acc_log": pt.flow_acc_log,
            "dist_to_stream": pt.dist_to_stream,
            "total_rainfall_mm": pt.total_rainfall_mm,
            "max_hourly_mm": pt.max_hourly_mm,
            "max_cum24h_mm": pt.max_cum24h_mm,
            "max_api": pt.max_api,
        }
        pred = orchestrator.predictor.predict_coordinate(
            latitude=pt.latitude,
            longitude=pt.longitude,
            rainfall_mm=pt.rainfall_mm,
            overrides=overrides,
        )
        if pred["risk_level"] in ("HIGH", "CRITICAL"):
            high_risk += 1
        results.append(
            FloodPredictionResponse(
                latitude=pt.latitude,
                longitude=pt.longitude,
                rainfall_mm=pt.rainfall_mm,
                susceptibility=pred["susceptibility"],
                probability=pred["susceptibility"],
                risk_level=pred["risk_level"],
                hazard_level=pred["risk_level"],
                features_used=pred["features_used"],
            )
        )

    return BatchPredictionResponse(
        total_points=len(results),
        high_risk_points=high_risk,
        predictions=results,
    )


@app.get("/hazard-map/metadata", response_model=HazardMapMetadataResponse, tags=["Hazard Map"])
def get_hazard_map_metadata() -> HazardMapMetadataResponse:
    """Geographic bounds and metadata for the georeferenced flood susceptibility overlay."""
    meta = terrain_service.get_grid_metadata()
    return HazardMapMetadataResponse(
        crs=meta["crs"],
        bounds=meta["bounds"],
        leaflet_bounds=meta["leaflet_bounds"],
        shape=meta["shape"],
        overlay_url="/hazard-map/overlay.png",
        disclaimer="AI-based Flood Susceptibility Estimate (Experimental Prototype)",
    )


@app.get("/hazard-map/overlay.png", tags=["Hazard Map"])
def get_hazard_map_overlay():
    """Serve the georeferenced flood susceptibility raster overlay as transparent RGBA PNG."""
    overlay_path = Path(__file__).resolve().parent.parent / "data" / "flood_overlay.png"
    if not overlay_path.exists():
        raise HTTPException(status_code=404, detail="Overlay raster image not found.")
    return FileResponse(overlay_path, media_type="image/png")


@app.get("/rainfall/timeseries", tags=["Hydrology"])
def get_rainfall_timeseries():
    """Retrieve historical hourly rainfall timeseries (Oct 2020 Hyderabad storm) and derived hydrological metrics."""
    series = load_historical_rainfall_series()
    return {
        "storm_event": "Hyderabad Urban Flash Flood (October 13-14, 2020)",
        "summary_metrics": BASELINE_RAIN_SUMMARY,
        "hourly_data": series,
    }


@app.get("/ffs/snapshot", tags=["Flash Flood Guidance"])
def get_ffs_snapshot(
    latitude: float = Query(17.4065, ge=-90.0, le=90.0),
    longitude: float = Query(78.4772, ge=-180.0, le=180.0),
):
    """Retrieve real-time Flash Flood Guidance (FFS) metrics and saturation snapshot."""
    return collect_ffs_snapshot(latitude=latitude, longitude=longitude)


@app.get("/ffs/grid", tags=["Flash Flood Guidance"])
def get_ffs_grid(
    center_lat: float = Query(17.4065, ge=-90.0, le=90.0),
    center_lon: float = Query(78.4772, ge=-180.0, le=180.0),
    grid_size: int = Query(3, ge=1, le=7),
    step_deg: float = Query(0.04, ge=0.01, le=0.2),
):
    """Retrieve spatial grid of FFS observations for map visualization."""
    return generate_regional_grid(
        center_lat=center_lat,
        center_lon=center_lon,
        grid_size=grid_size,
        step_deg=step_deg,
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
        radius_km=request.radius_km,
    )

    infra_items = [InfrastructureItem(**item) for item in result["threatened_infrastructure"]]

    return HazardEvaluationResponse(
        latitude=result["latitude"],
        longitude=result["longitude"],
        rainfall_mm=result["rainfall_mm"],
        flood_probability=result["flood_probability"],
        susceptibility=result["susceptibility"],
        hazard_level=result["hazard_level"],
        risk_level=result["risk_level"],
        compound_risk_score=result["compound_risk_score"],
        threatened_infrastructure=infra_items,
    )


@app.post("/alerts/generate", response_model=AlertGenerationResponse, tags=["Alerts"])
def generate_alert(request: AlertGenerationRequest) -> AlertGenerationResponse:
    """Trigger AI advisory generation and persist alert in database."""
    global orchestrator
    if not orchestrator:
        orchestrator = AlertOrchestrator()

    alert_record = orchestrator.generate_and_save_alert(
        latitude=request.latitude,
        longitude=request.longitude,
        rainfall_mm=request.rainfall_mm,
        location_name=request.location_name,
        radius_km=request.radius_km,
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
    """Retrieve recent alerts stored in database or cache."""
    return supabase_service.get_recent_alerts(limit=limit)


@app.get("/infrastructure", response_model=List[InfrastructureItem], tags=["Infrastructure"])
def get_infrastructure(
    latitude: float = Query(17.4065, ge=-90.0, le=90.0),
    longitude: float = Query(78.4772, ge=-180.0, le=180.0),
    radius_km: float = Query(10.0, ge=0.5, le=50.0),
) -> List[InfrastructureItem]:
    """Retrieve critical infrastructure nodes within radius."""
    raw_assets = supabase_service.get_infrastructure_assets(
        center_lat=latitude,
        center_lon=longitude,
        radius_km=radius_km,
    )
    return [InfrastructureItem(**item) for item in raw_assets]
