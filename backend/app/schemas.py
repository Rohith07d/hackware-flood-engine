from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class HealthResponse(BaseModel):
    status: str = "ok"
    version: Optional[str] = None
    model_ready: bool = False
    supabase_configured: bool = False
    llm_configured: bool = False
    featherless: Optional[str] = "connected"
    dem_cached: bool = False
    timestamp: datetime = Field(default_factory=get_utc_now)


class ModelStatusResponse(BaseModel):
    model_name: str
    feature_count: int
    feature_names: List[str]
    is_loaded: bool
    dem_cached: bool
    disclaimer: str


class FloodPredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    rainfall_mm: float = Field(..., ge=0.0, description="Scenario rainfall accumulation in mm")
    # Optional direct feature overrides
    elevation: Optional[float] = None
    slope: Optional[float] = None
    aspect: Optional[float] = None
    curvature: Optional[float] = None
    tri: Optional[float] = None
    twi: Optional[float] = None
    rel_elev: Optional[float] = None
    flow_acc_log: Optional[float] = None
    dist_to_stream: Optional[float] = None
    total_rainfall_mm: Optional[float] = None
    max_hourly_mm: Optional[float] = None
    max_cum24h_mm: Optional[float] = None
    max_api: Optional[float] = None


class FloodPredictionResponse(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float
    susceptibility: float = Field(..., ge=0.0, le=1.0, description="AI-based flood susceptibility estimate [0.0 - 1.0]")
    probability: float = Field(..., ge=0.0, le=1.0, description="Alias for susceptibility probability")
    risk_level: str = Field(..., description="Categorical risk tier: LOW, MODERATE, HIGH, or CRITICAL")
    hazard_level: str = Field(..., description="Categorical hazard level: LOW, MODERATE, HIGH, or CRITICAL")
    features_used: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=get_utc_now)


class BatchPredictionRequest(BaseModel):
    points: List[FloodPredictionRequest] = Field(..., min_length=1, max_length=500)


class BatchPredictionResponse(BaseModel):
    total_points: int
    high_risk_points: int
    predictions: List[FloodPredictionResponse]


class InfrastructureItem(BaseModel):
    id: str
    name: str
    type: str  # Hospital, School, Bridge, Power Substation, Water Treatment, Emergency Shelter
    latitude: float
    longitude: float
    vulnerability_score: float = Field(..., ge=0.0, le=1.0)
    distance_km: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class HazardEvaluationRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    rainfall_mm: float = Field(..., ge=0.0)
    radius_km: float = Field(default=5.0, ge=0.5, le=50.0)


class HazardEvaluationResponse(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float
    flood_probability: float
    susceptibility: float
    hazard_level: str
    risk_level: str
    compound_risk_score: float
    threatened_infrastructure: List[InfrastructureItem]
    timestamp: datetime = Field(default_factory=get_utc_now)


class AlertGenerationRequest(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float
    location_name: str = Field(default="Monitored Basin")
    radius_km: float = Field(default=5.0, ge=0.5, le=50.0)


class AlertGenerationResponse(BaseModel):
    alert_id: str
    severity: str
    location_name: str
    advisory_title: str
    advisory_markdown: str
    recommended_actions: List[str]
    threatened_infrastructure_count: int
    threatened_infrastructure: List[InfrastructureItem]
    flood_probability: float
    generated_at: datetime = Field(default_factory=get_utc_now)


class HazardMapMetadataResponse(BaseModel):
    crs: str
    bounds: Dict[str, float]
    leaflet_bounds: List[List[float]]
    shape: List[int]
    overlay_url: str
    disclaimer: str


class AreaAnalysisRequest(BaseModel):
    location_name: Optional[str] = Field(default=None, description="Name of locality or area, e.g. 'Gachibowli, Hyderabad'")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Optional center latitude")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Optional center longitude")
    bounding_box: Optional[List[float]] = Field(default=None, description="Optional [south, west, north, east]")
    rainfall_mm: float = Field(default=65.0, ge=0.0, description="Rainfall scenario accumulation in mm")


class AreaAnalysisResponse(BaseModel):
    status: str
    area_name: str
    coordinates: Dict[str, float]
    bounding_box: List[float]
    rainfall_scenario_mm: float
    susceptibility_score: float
    risk_tier: str
    hazard_level: str
    features_13: Dict[str, float]
    drivers: List[Dict[str, Any]]
    ai_summary: str
    recommendations: List[str]
    ai_source: str
    supabase_record_id: Optional[str] = None
    storage_status: Optional[str] = None
    timestamp: Optional[str] = None
    orchestration_log: Optional[List[Dict[str, Any]]] = None
