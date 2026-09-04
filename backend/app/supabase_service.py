import math
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from supabase import Client, create_client

from .config import settings

# In-memory fallback data store for resilient local execution & testing
DEFAULT_INFRASTRUCTURE = [
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01", "name": "Ghatkesar Community Hospital", "type": "Hospital", "latitude": 17.4938, "longitude": 78.6795, "vulnerability_score": 0.95, "capacity": 350, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02", "name": "Govt. High School & Evacuation Shelter", "type": "Emergency Shelter", "latitude": 17.5005, "longitude": 78.6875, "vulnerability_score": 0.60, "capacity": 1200, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03", "name": "Musi Basin Electrical Substation", "type": "Power Substation", "latitude": 17.4875, "longitude": 78.6825, "vulnerability_score": 0.90, "capacity": 35000, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04", "name": "Musi River Pump Station 04", "type": "Water Infrastructure", "latitude": 17.5020, "longitude": 78.6825, "vulnerability_score": 0.85, "capacity": 50000, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05", "name": "Ghatkesar Central Police Station", "type": "Police Station", "latitude": 17.4965, "longitude": 78.6840, "vulnerability_score": 0.45, "capacity": 80, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06", "name": "Musi Flood Retention Basin & Sluice", "type": "Retention Basin", "latitude": 17.4925, "longitude": 78.6910, "vulnerability_score": 0.80, "capacity": 120000, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07", "name": "Keesara Musi River Cross Bridge", "type": "Bridge", "latitude": 17.4855, "longitude": 78.6780, "vulnerability_score": 0.75, "capacity": 0, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08", "name": "Bibinagar Road Upstream Gauge Post", "type": "River Gauge", "latitude": 17.4990, "longitude": 78.6665, "vulnerability_score": 0.70, "capacity": 0, "status": "Operational"},
    # Secondary demo items
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "name": "Metro General Trauma Hospital", "type": "Hospital", "latitude": 13.0827, "longitude": 80.2707, "vulnerability_score": 0.95, "capacity": 650, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", "name": "Central River Cross-Over Bridge", "type": "Bridge", "latitude": 13.0780, "longitude": 80.2650, "vulnerability_score": 0.85, "capacity": 0, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", "name": "Coastal Power Grid Substation 4", "type": "Power Substation", "latitude": 13.0910, "longitude": 80.2810, "vulnerability_score": 0.90, "capacity": 45000, "status": "Operational"},
]

_memory_predictions: List[Dict[str, Any]] = []
_memory_alerts: List[Dict[str, Any]] = []


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points on the Earth in kilometers."""
    r = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class SupabaseService:
    def __init__(self) -> None:
        self.client: Optional[Client] = None
        self._init_client()

    def _init_client(self) -> None:
        if settings.supabase_url and settings.supabase_key:
            try:
                self.client = create_client(settings.supabase_url, settings.supabase_key)
            except Exception as exc:
                print(f"[Supabase] Warning: Could not initialize client: {exc}. Running in in-memory mode.")
                self.client = None
        else:
            self.client = None

    @property
    def is_connected(self) -> bool:
        return self.client is not None

    def get_infrastructure_assets(
        self,
        center_lat: float,
        center_lon: float,
        radius_km: float = 5.0
    ) -> List[Dict[str, Any]]:
        """Fetch infrastructure assets within a given radius (km)."""
        raw_assets = []
        if self.client:
            try:
                # Rough bounding box filter first
                lat_delta = radius_km / 111.0
                lon_delta = radius_km / (111.0 * max(0.1, math.cos(math.radians(center_lat))))
                res = (
                    self.client.table("infrastructure_assets")
                    .select("*")
                    .gte("latitude", center_lat - lat_delta)
                    .lte("latitude", center_lat + lat_delta)
                    .gte("longitude", center_lon - lon_delta)
                    .lte("longitude", center_lon + lon_delta)
                    .execute()
                )
                raw_assets = res.data if res.data else []
            except Exception as exc:
                print(f"[Supabase] Query error, falling back to local store: {exc}")
                raw_assets = DEFAULT_INFRASTRUCTURE
        else:
            raw_assets = DEFAULT_INFRASTRUCTURE

        # Filter precisely with haversine distance
        results = []
        for asset in raw_assets:
            dist = haversine_distance_km(center_lat, center_lon, asset["latitude"], asset["longitude"])
            if dist <= radius_km:
                item = dict(asset)
                item["distance_km"] = round(dist, 2)
                results.append(item)

        # Sort by proximity
        results.sort(key=lambda x: x["distance_km"])
        return results

    def save_area_prediction(
        self,
        area_name: str,
        lat: float,
        lon: float,
        bounding_box: List[float],
        susceptibility_score: float,
        risk_tier: str,
        features: Dict[str, Any],
        ai_summary: str,
        recommendations: List[str],
    ) -> Dict[str, Any]:
        """Save area-based flood analysis record according to architecture specification."""
        import uuid
        record_id = str(uuid.uuid4())
        record = {
            "id": record_id,
            "area_name": area_name,
            "lat": lat,
            "lon": lon,
            "bounding_box": bounding_box,
            "susceptibility_score": susceptibility_score,
            "risk_tier": risk_tier,
            "features": features,
            "ai_summary": ai_summary,
            "recommendations": recommendations,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        stored_remote = False
        if self.client:
            try:
                res = self.client.table("flood_predictions").insert(record).execute()
                if res.data:
                    stored_remote = True
                    return {**res.data[0], "storage_status": "stored_in_supabase"}
            except Exception as exc:
                print(f"[Supabase] Remote insert error: {exc}. Storing in resilient local cache.")

        # In-memory resilient cache
        _memory_predictions.append(record)
        return {**record, "storage_status": "stored_in_cache"}

    def save_prediction(self, prediction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save flood prediction record."""
        record = dict(prediction_data)
        record.setdefault("created_at", datetime.now(timezone.utc).isoformat())

        if self.client:
            try:
                res = self.client.table("flood_predictions").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as exc:
                print(f"[Supabase] Insert prediction error: {exc}")

        # In-memory fallback
        _memory_predictions.append(record)
        return record

    def save_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save flood alert record."""
        record = dict(alert_data)
        record.setdefault("created_at", datetime.now(timezone.utc).isoformat())

        if self.client:
            try:
                res = self.client.table("flood_alerts").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as exc:
                print(f"[Supabase] Insert alert error: {exc}")

        # In-memory fallback
        _memory_alerts.append(record)
        return record

    def get_recent_alerts(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve recent flood alerts."""
        if self.client:
            try:
                res = self.client.table("flood_alerts").select("*").order("created_at", desc=True).limit(limit).execute()
                if res.data:
                    return res.data
            except Exception as exc:
                print(f"[Supabase] Fetch alerts error: {exc}")

        return list(reversed(_memory_alerts[-limit:]))


# Global service instance
supabase_service = SupabaseService()


def get_supabase_client() -> Optional[Client]:
    return supabase_service.client
