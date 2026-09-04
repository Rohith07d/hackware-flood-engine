from fastapi import FastAPI

from .alert_orchestrator import evaluate_hazard
from .config import settings
from .schemas import PredictionRequest, PredictionResponse

app = FastAPI(title=settings.app_name)


@app.get('/health')
def healthcheck() -> dict:
    return {'status': 'ok'}


@app.post('/predict', response_model=PredictionResponse)
def predict(payload: PredictionRequest) -> PredictionResponse:
    result = evaluate_hazard(payload.model_dump())
    return PredictionResponse(flood_probability=result['flood_probability'])
