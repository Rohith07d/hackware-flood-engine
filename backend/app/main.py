from typing import Any, Dict

from fastapi import FastAPI

from .config import settings
from .ffs_collector import collect_ffs_snapshot
from .schemas import HealthResponse

app = FastAPI(title=settings.app_name, version=settings.app_version)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/v1/telemetry/{station_id}")
async def get_telemetry(station_id: str) -> Dict[str, Any]:
    return await collect_ffs_snapshot(station_id)
