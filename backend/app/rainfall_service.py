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


def fetch_live_weather_forecast(latitude: float = 17.4065, longitude: float = 78.4772) -> Dict[str, Any]:
    """
    Fetch real-time precipitation and 72-hour hourly forecast from Open-Meteo.
    Calculates 24h, 48h, and 72h precipitation sums and flood risk probabilities.
    Falls back gracefully if external weather service is temporarily unreachable.
    """
    import httpx
    from datetime import datetime, timezone

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation,rain,weather_code",
        "current": "precipitation,rain",
        "forecast_days": 3,
        "timezone": "auto",
    }

    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                hourly = data.get("hourly", {})
                times = hourly.get("time", [])
                precip = hourly.get("precipitation", [])

                cur_precip = float(data.get("current", {}).get("precipitation", 0.0))

                precip_24h = round(float(sum(precip[:24])), 1) if len(precip) >= 24 else round(float(sum(precip)), 1)
                precip_48h = round(float(sum(precip[:48])), 1) if len(precip) >= 48 else round(float(sum(precip)), 1)
                precip_72h = round(float(sum(precip)), 1)

                hourly_points = []
                for i in range(min(72, len(times))):
                    p_val = float(precip[i]) if i < len(precip) else 0.0
                    # Estimated risk curve scaling with cumulative precipitation
                    cum_to_step = sum(precip[:i + 1])
                    risk_val = min(0.95, max(0.05, (cum_to_step / 120.0) * 0.75 + (p_val / 25.0) * 0.25))
                    tier = "LOW"
                    if risk_val >= 0.75:
                        tier = "CRITICAL"
                    elif risk_val >= 0.50:
                        tier = "HIGH"
                    elif risk_val >= 0.25:
                        tier = "MODERATE"

                    hourly_points.append({
                        "time": times[i],
                        "precipitation_mm": round(p_val, 2),
                        "probability_risk": round(risk_val, 3),
                        "risk_tier": tier,
                    })

                return {
                    "latitude": latitude,
                    "longitude": longitude,
                    "current_precipitation_mm": cur_precip,
                    "forecast_24h_mm": precip_24h,
                    "forecast_48h_mm": precip_48h,
                    "forecast_72h_mm": precip_72h,
                    "hourly": hourly_points,
                    "source": "Open-Meteo Realtime API",
                }
    except Exception as exc:
        print(f"[rainfall_service] Weather API query warning: {exc}. Falling back to baseline simulation.")

    # Graceful fallback simulation
    hourly_points = []
    base_time = datetime.now(timezone.utc)
    for i in range(72):
        t_str = f"+{i + 1}h"
        sim_p = round(max(0.0, math.sin(i / 6.0) * 4.5 + (0.5 if i % 12 == 0 else 0.0)), 1)
        sim_risk = min(0.92, max(0.08, (i * 0.008) + (sim_p / 10.0)))
        tier = "LOW"
        if sim_risk >= 0.75:
            tier = "CRITICAL"
        elif sim_risk >= 0.50:
            tier = "HIGH"
        elif sim_risk >= 0.25:
            tier = "MODERATE"

        hourly_points.append({
            "time": t_str,
            "precipitation_mm": sim_p,
            "probability_risk": round(sim_risk, 3),
            "risk_tier": tier,
        })

    return {
        "latitude": latitude,
        "longitude": longitude,
        "current_precipitation_mm": 2.4,
        "forecast_24h_mm": 38.5,
        "forecast_48h_mm": 64.2,
        "forecast_72h_mm": 89.0,
        "hourly": hourly_points,
        "source": "Open-Meteo Simulated Fallback",
    }


def get_historical_event_data() -> Dict[str, Any]:
    """Provide historical October 2020 Hyderabad storm metadata and inundation footprint."""
    return {
        "event_id": "hyd_oct_2020",
        "title": "October 2020 Hyderabad Urban Flash Flood",
        "dates": "October 13-14, 2020",
        "peak_24h_rainfall_mm": 191.8,
        "affected_areas": [
            "Musi River Basin",
            "Nadeem Colony (Tolichowki)",
            "Ghatkesar & Peerzadiguda",
            "Alwal & Begumpet",
            "Saroornagar & Ramanthapur",
        ],
        "inundation_zones": [
            {"name": "Musi River Corridor", "center": [17.3700, 78.4800], "radius_m": 1200, "depth_m": 2.8, "severity": "CRITICAL"},
            {"name": "Nadeem Colony Basin", "center": [17.3950, 78.4100], "radius_m": 850, "depth_m": 2.3, "severity": "CRITICAL"},
            {"name": "Ghatkesar Lowlands", "center": [17.4948, 78.6810], "radius_m": 950, "depth_m": 1.9, "severity": "HIGH"},
            {"name": "Begumpet Nala", "center": [17.4440, 78.4720], "radius_m": 700, "depth_m": 1.6, "severity": "HIGH"},
        ],
        "summary": "Deep depression in the Bay of Bengal triggered unprecedented cloudburst rainfall across Hyderabad, leading to Musi river overflow and severe urban drainage backflow.",
    }
