from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from .config import settings

logger = logging.getLogger(__name__)

PARAM_GAGE_HEIGHT = "00065"
PARAM_STREAMFLOW = "00060"
PARAM_PRECIPITATION = "00045"
REQUESTED_PARAMETERS = (
    PARAM_GAGE_HEIGHT,
    PARAM_STREAMFLOW,
    PARAM_PRECIPITATION,
)

MISSING_NUMERIC_SENTINELS = {"", "-999999", "-99999"}

TELEMETRY_BY_PARAM = {
    PARAM_GAGE_HEIGHT: "gage_height_ft",
    PARAM_STREAMFLOW: "streamflow_cfs",
    PARAM_PRECIPITATION: "precipitation",
}


def _empty_station(site_id: str = "") -> Dict[str, Any]:
    return {
        "id": site_id or None,
        "name": None,
        "latitude": None,
        "longitude": None,
    }


def _empty_telemetry() -> Dict[str, Optional[float]]:
    return {
        "gage_height_ft": None,
        "streamflow_cfs": None,
        "precipitation": None,
    }


def _empty_units() -> Dict[str, Optional[str]]:
    return {
        "gage_height_ft": None,
        "streamflow_cfs": None,
        "precipitation": None,
    }


def _observation(
    *,
    status: str,
    site_id: str = "",
    station: Optional[Dict[str, Any]] = None,
    timestamp: Optional[str] = None,
    telemetry: Optional[Dict[str, Optional[float]]] = None,
    units: Optional[Dict[str, Optional[str]]] = None,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": status,
        "source": "USGS",
        "station": station or _empty_station(site_id),
        "timestamp": timestamp,
        "telemetry": telemetry or _empty_telemetry(),
        "units": units or _empty_units(),
    }
    if error:
        payload["error"] = error
    return payload


def _safe_get(mapping: Any, *keys: Any, default: Any = None) -> Any:
    current = mapping
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key, default)
        if current is None:
            return default
    return current


def _parse_float(raw: Any) -> Optional[float]:
    if raw is None:
        return None
    text = str(raw).strip()
    if text in MISSING_NUMERIC_SENTINELS:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        logger.warning("USGS numeric value could not be parsed: %r", raw)
        return None


def _latest_value_entry(series: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    values_blocks = series.get("values")
    if not isinstance(values_blocks, list) or not values_blocks:
        return None

    first_block = values_blocks[0]
    if not isinstance(first_block, dict):
        return None

    points = first_block.get("value")
    if not isinstance(points, list) or not points:
        return None

    latest = points[-1]
    if not isinstance(latest, dict):
        return None
    return latest


def _parameter_code(series: Dict[str, Any]) -> Optional[str]:
    codes = _safe_get(series, "variable", "variableCode", default=[])
    if not isinstance(codes, list) or not codes:
        return None
    first = codes[0]
    if not isinstance(first, dict):
        return None
    code = first.get("value")
    return str(code) if code is not None else None


def _unit_code(series: Dict[str, Any]) -> Optional[str]:
    unit = _safe_get(series, "variable", "unit", "unitCode")
    if unit is None:
        return None
    text = str(unit).strip()
    return text or None


def _station_from_series(series: Dict[str, Any], fallback_site_id: str) -> Dict[str, Any]:
    source_info = series.get("sourceInfo") if isinstance(series, dict) else None
    if not isinstance(source_info, dict):
        return _empty_station(fallback_site_id)

    site_codes = source_info.get("siteCode")
    site_id = fallback_site_id or None
    if isinstance(site_codes, list) and site_codes:
        first_code = site_codes[0]
        if isinstance(first_code, dict) and first_code.get("value"):
            site_id = str(first_code["value"])

    geo = _safe_get(source_info, "geoLocation", "geogLocation", default={})
    latitude = None
    longitude = None
    if isinstance(geo, dict):
        latitude = _parse_float(geo.get("latitude"))
        longitude = _parse_float(geo.get("longitude"))

    name = source_info.get("siteName")
    return {
        "id": site_id,
        "name": str(name) if name else None,
        "latitude": latitude,
        "longitude": longitude,
    }


def _has_usable_telemetry(telemetry: Dict[str, Optional[float]]) -> bool:
    return any(value is not None for value in telemetry.values())


def _normalize_usgs_payload(payload: Any, requested_site_id: str) -> Dict[str, Any]:
    time_series = _safe_get(payload, "value", "timeSeries", default=[])
    if not isinstance(time_series, list) or not time_series:
        message = (
            f"USGS returned no timeSeries for site {requested_site_id}; "
            "no usable telemetry is available"
        )
        logger.warning(message)
        return _observation(status="degraded", site_id=requested_site_id, error=message)

    station = _station_from_series(time_series[0], requested_site_id)
    telemetry = _empty_telemetry()
    units = _empty_units()
    timestamps: Dict[str, str] = {}

    for series in time_series:
        if not isinstance(series, dict):
            continue

        param_code = _parameter_code(series)
        telemetry_key = TELEMETRY_BY_PARAM.get(param_code or "")
        if not telemetry_key:
            continue

        latest = _latest_value_entry(series)
        if latest is None:
            logger.info(
                "USGS parameter %s present for site %s but has no values",
                param_code,
                requested_site_id,
            )
            continue

        telemetry[telemetry_key] = _parse_float(latest.get("value"))
        units[telemetry_key] = _unit_code(series)

        date_time = latest.get("dateTime")
        if date_time:
            timestamps[telemetry_key] = str(date_time)

    timestamp = None
    for key in ("gage_height_ft", "streamflow_cfs", "precipitation"):
        if key in timestamps:
            timestamp = timestamps[key]
            break

    if not _has_usable_telemetry(telemetry):
        message = (
            f"USGS request succeeded for site {station.get('id') or requested_site_id} "
            "but no usable telemetry is available"
        )
        logger.warning(message)
        return _observation(
            status="degraded",
            station=station,
            timestamp=timestamp,
            telemetry=telemetry,
            units=units,
            error=message,
        )

    logger.info(
        "Normalized USGS snapshot for site %s (gage_height=%s streamflow=%s precipitation=%s)",
        station.get("id"),
        telemetry["gage_height_ft"],
        telemetry["streamflow_cfs"],
        telemetry["precipitation"],
    )
    return _observation(
        status="success",
        station=station,
        timestamp=timestamp,
        telemetry=telemetry,
        units=units,
    )


async def collect_ffs_snapshot(site_id: Optional[str] = None) -> Dict[str, Any]:
    resolved_site_id = (site_id or settings.usgs_site_id or "").strip()
    if not resolved_site_id:
        message = (
            "USGS site ID is not configured. Set USGS_SITE_ID or pass site_id."
        )
        logger.error(message)
        return _observation(status="error", error=message)

    params = {
        "format": "json",
        "sites": resolved_site_id,
        "parameterCd": ",".join(REQUESTED_PARAMETERS),
    }
    timeout = httpx.Timeout(settings.usgs_timeout_seconds)
    url = settings.usgs_nwis_iv_url

    logger.info("Requesting USGS NWIS IV data for site %s from %s", resolved_site_id, url)

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(
                url,
                params=params,
                headers={"Accept": "application/json", "User-Agent": "FloodCast/0.1"},
            )
    except httpx.TimeoutException:
        message = (
            f"USGS NWIS IV request timed out after {settings.usgs_timeout_seconds}s "
            f"for site {resolved_site_id}"
        )
        logger.error(message)
        return _observation(status="error", site_id=resolved_site_id, error=message)
    except httpx.RequestError as exc:
        message = f"USGS NWIS IV request failed for site {resolved_site_id}: {exc}"
        logger.error(message)
        return _observation(status="error", site_id=resolved_site_id, error=message)

    if response.status_code >= 400:
        body_preview = (response.text or "")[:300]
        message = (
            f"USGS NWIS IV returned HTTP {response.status_code} for site "
            f"{resolved_site_id}: {body_preview}"
        )
        logger.error(message)
        return _observation(status="error", site_id=resolved_site_id, error=message)

    try:
        payload = response.json()
    except ValueError:
        message = f"USGS NWIS IV returned non-JSON for site {resolved_site_id}"
        logger.error(message)
        return _observation(status="error", site_id=resolved_site_id, error=message)

    try:
        return _normalize_usgs_payload(payload, resolved_site_id)
    except Exception:
        message = f"Failed to parse USGS NWIS IV response for site {resolved_site_id}"
        logger.exception(message)
        return _observation(status="error", site_id=resolved_site_id, error=message)
