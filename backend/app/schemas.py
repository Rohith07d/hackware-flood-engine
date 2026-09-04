from pydantic import BaseModel


class PredictionRequest(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float


class PredictionResponse(BaseModel):
    flood_probability: float
