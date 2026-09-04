import hashlib
from typing import Any, Dict, List
from datetime import datetime, timezone
import math


def get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def collect_ffs_snapshot(latitude: float = 17.4948, longitude: float = 78.6810) -> Dict[str, Any]:
    """
    Collect Flash Flood Guidance (FFS) snapshot for specified coordinates.
    Calculates basin saturation index, precipitation accumulation, and threshold metrics.
    """
    # Deterministic MD5 spatial hash for consistent demo values across coordinates
    coord_key = f"{round(latitude, 2)}_{round(longitude, 2)}".encode("utf-8")
    coord_seed = int(hashlib.md5(coord_key).hexdigest(), 16) % 100

    base_rain_1h = round(15.0 + (coord_seed * 0.45), 1)
    base_rain_3h = round(base_rain_1h * 2.3, 1)
    base_rain_6h = round(base_rain_3h * 1.6, 1)
    soil_saturation = round(min(98.0, 35.0 + (coord_seed * 0.55)), 1)
    ffg_threshold_3h = round(max(20.0, 70.0 - (soil_saturation * 0.45)), 1)

    # Exceedance ratio: > 1.0 means imminent/active flash flood
    exceedance_ratio = round(base_rain_3h / max(1.0, ffg_threshold_3h), 2)

    status = "Normal"
    if exceedance_ratio >= 1.2:
        status = "Emergency Flash Flood"
    elif exceedance_ratio >= 1.0:
        status = "Flash Flood Warning"
    elif exceedance_ratio >= 0.75:
        status = "Flash Flood Watch"

    return {
        "timestamp": get_utc_now_iso(),
        "coordinates": {"latitude": latitude, "longitude": longitude},
        "status": status,
        "metrics": {
            "rainfall_1h_mm": base_rain_1h,
            "rainfall_3h_mm": base_rain_3h,
            "rainfall_6h_mm": base_rain_6h,
            "soil_saturation_pct": soil_saturation,
            "ffg_threshold_3h_mm": ffg_threshold_3h,
            "ffg_exceedance_ratio": exceedance_ratio,
            "river_discharge_m3s": round(45.0 + (coord_seed * 1.8), 1),
        },
        "basin_name": f"Basin-{abs(int(latitude * 10))}-{abs(int(longitude * 10))}",
    }


def generate_regional_grid(
    center_lat: float,
    center_lon: float,
    grid_size: int = 3,
    step_deg: float = 0.05
) -> List[Dict[str, Any]]:
    """Generate a grid of FFS snapshots around center coordinates for MapCanvas rendering."""
    snapshots = []
    half = grid_size // 2
    for i in range(-half, half + 1):
        for j in range(-half, half + 1):
            lat = round(center_lat + (i * step_deg), 4)
            lon = round(center_lon + (j * step_deg), 4)
            snapshots.append(collect_ffs_snapshot(latitude=lat, longitude=lon))
    return snapshots
