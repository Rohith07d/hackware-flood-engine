import math
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAINFALL_FILE = DATA_DIR / "rainfall_hyd.csv"

# Pre-computed baseline metrics from real Oct 2020 Hyderabad storm event
BASELINE_RAIN_SUMMARY = {
    "total_rainfall_mm": 148.0,
    "max_hourly_mm": 11.2,
    "max_cum24h_mm": 80.5,
    "max_api": 86.916,
}


def compute_rainfall_metrics_from_series(hourly_rain_mm: List[float], k_decay: float = 0.98) -> Dict[str, float]:
    """
    Derive the 4 hydrological rainfall features required by LightGBM model:
      1. total_rainfall_mm: Cumulative rainfall across event
      2. max_hourly_mm: Peak single-hour precipitation intensity
      3. max_cum24h_mm: Maximum 24-hour rolling accumulation
      4. max_api: Peak Antecedent Precipitation Index (API_t = API_{t-1} * k + Rain_t)
    """
    if not hourly_rain_mm:
        return {
            "total_rainfall_mm": 0.0,
            "max_hourly_mm": 0.0,
            "max_cum24h_mm": 0.0,
            "max_api": 0.0,
        }

    rain_arr = np.array(hourly_rain_mm, dtype=np.float64)
    rain_arr = np.nan_to_num(rain_arr, nan=0.0)

    total_rainfall = float(np.sum(rain_arr))
    max_hourly = float(np.max(rain_arr))

    # Rolling 24h accumulation
    cum24 = np.zeros(len(rain_arr), dtype=np.float64)
    for i in range(len(rain_arr)):
        start = max(0, i - 23)
        cum24[i] = np.sum(rain_arr[start:i + 1])
    max_cum24h = float(np.max(cum24))

    # API calculation
    api = np.zeros(len(rain_arr), dtype=np.float64)
    for i in range(1, len(rain_arr)):
        api[i] = api[i - 1] * k_decay + rain_arr[i]
    max_api = float(np.max(api))

    return {
        "total_rainfall_mm": round(total_rainfall, 2),
        "max_hourly_mm": round(max_hourly, 2),
        "max_cum24h_mm": round(max_cum24h, 2),
        "max_api": round(max_api, 3),
    }


def get_rainfall_scenario_features(rainfall_mm: float) -> Dict[str, float]:
    """
    Scale real historical storm event proportionately to simulate a 'what-if' rainfall scenario.
    Does not fabricate numbers; preserves event dynamics (intensity distribution, rolling accumulation, API decay).
    """
    if rainfall_mm <= 0.0:
        return {
            "total_rainfall_mm": 0.0,
            "max_hourly_mm": 0.0,
            "max_cum24h_mm": 0.0,
            "max_api": 0.0,
        }

    ratio = rainfall_mm / BASELINE_RAIN_SUMMARY["total_rainfall_mm"]
    return {
        "total_rainfall_mm": round(float(rainfall_mm), 2),
        "max_hourly_mm": round(float(BASELINE_RAIN_SUMMARY["max_hourly_mm"] * ratio), 2),
        "max_cum24h_mm": round(float(BASELINE_RAIN_SUMMARY["max_cum24h_mm"] * ratio), 2),
        "max_api": round(float(BASELINE_RAIN_SUMMARY["max_api"] * ratio), 3),
    }


def load_historical_rainfall_series() -> List[Dict[str, Any]]:
    """Load raw hourly rainfall records from disk."""
    if not RAINFALL_FILE.exists():
        return []

    df = pd.read_csv(RAINFALL_FILE, skiprows=3)
    records = []
    for _, row in df.iterrows():
        records.append({
            "time": str(row["time"]),
            "rain_mm": float(row.get("rain (mm)", 0.0)),
        })
    return records
