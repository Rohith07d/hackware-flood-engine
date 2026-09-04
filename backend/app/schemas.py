from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class FloodPredictionRequest(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float


class FloodPredictionResponse(BaseModel):
    probability: float
