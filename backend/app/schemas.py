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
    timestamp: datetime = Field(default_factory=get_utc_now)


class FloodPredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    rainfall_mm: float = Field(..., ge=0.0, description="Precipitation accumulation in mm")
    elevation_m: Optional[float] = Field(None, description="Terrain elevation in meters above sea level")
    slope_deg: Optional[float] = Field(None, ge=0.0, le=90.0, description="Terrain slope angle in degrees")
    soil_moisture_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Soil saturation percentage")
    distance_to_river_m: Optional[float] = Field(None, ge=0.0, description="Distance to nearest watercourse in meters")
    drainage_capacity_mm_hr: Optional[float] = Field(None, ge=0.0, description="Urban stormwater drainage capacity")


class FloodPredictionResponse(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float
    probability: float = Field(..., ge=0.0, le=1.0, description="Estimated probability of flooding [0.0 - 1.0]")
    hazard_level: str = Field(..., description="Categorical hazard level: Low, Moderate, High, or Critical")
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
    type: str  # Hospital, School, Bridge, Substation, Water Treatment, Shelter
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
    hazard_level: str
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
