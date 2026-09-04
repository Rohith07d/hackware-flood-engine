import math
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from supabase import Client, create_client

from .config import settings

# In-memory fallback data store for resilient local execution & testing
DEFAULT_INFRASTRUCTURE = [
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "name": "Metro General Trauma Hospital", "type": "Hospital", "latitude": 13.0827, "longitude": 80.2707, "vulnerability_score": 0.95, "capacity": 650, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", "name": "Central River Cross-Over Bridge", "type": "Bridge", "latitude": 13.0780, "longitude": 80.2650, "vulnerability_score": 0.85, "capacity": 0, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", "name": "Coastal Power Grid Substation 4", "type": "Power Substation", "latitude": 13.0910, "longitude": 80.2810, "vulnerability_score": 0.90, "capacity": 45000, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14", "name": "North District High School & Shelter", "type": "Emergency Shelter", "latitude": 13.0715, "longitude": 80.2580, "vulnerability_score": 0.60, "capacity": 1200, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15", "name": "Municipal Water Purification Works", "type": "Water Treatment", "latitude": 13.0950, "longitude": 80.2620, "vulnerability_score": 0.80, "capacity": 80000, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16", "name": "St. Jude Emergency Medical Clinic", "type": "Hospital", "latitude": 13.0650, "longitude": 80.2450, "vulnerability_score": 0.75, "capacity": 120, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17", "name": "South Highway Flyover Bridge", "type": "Bridge", "latitude": 13.0520, "longitude": 80.2380, "vulnerability_score": 0.70, "capacity": 0, "status": "Operational"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18", "name": "East Harbour Primary School", "type": "School", "latitude": 13.0880, "longitude": 80.2920, "vulnerability_score": 0.65, "capacity": 450, "status": "Operational"},
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
