import math
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from supabase import Client, create_client

from .config import settings

# In-memory fallback data store for resilient local execution & testing
# In-memory fallback data store for resilient local execution & testing with Hyderabad infrastructure
DEFAULT_INFRASTRUCTURE = [
    {"id": "hyd-infra-01", "name": "Osmania General Trauma Hospital", "type": "Hospital", "latitude": 17.3785, "longitude": 78.4754, "vulnerability_score": 0.95, "capacity": 1200, "status": "Operational"},
    {"id": "hyd-infra-02", "name": "Gandhi Super Specialty Hospital", "type": "Hospital", "latitude": 17.4243, "longitude": 78.5034, "vulnerability_score": 0.88, "capacity": 1500, "status": "Operational"},
    {"id": "hyd-infra-03", "name": "Community Hospital Ghatkesar", "type": "Hospital", "latitude": 17.4938, "longitude": 78.6795, "vulnerability_score": 0.82, "capacity": 250, "status": "Operational"},
    {"id": "hyd-infra-04", "name": "Musi River Puranapul Bridge", "type": "Bridge", "latitude": 17.3660, "longitude": 78.4630, "vulnerability_score": 0.90, "capacity": 0, "status": "Operational"},
    {"id": "hyd-infra-05", "name": "Chaderghat Causeway River Bridge", "type": "Bridge", "latitude": 17.3775, "longitude": 78.4900, "vulnerability_score": 0.92, "capacity": 0, "status": "Operational"},
    {"id": "hyd-infra-06", "name": "Gachibowli High-Tension Substation", "type": "Power Substation", "latitude": 17.4400, "longitude": 78.3500, "vulnerability_score": 0.78, "capacity": 60000, "status": "Operational"},
    {"id": "hyd-infra-07", "name": "Keesara Electrical Substation", "type": "Power Substation", "latitude": 17.4875, "longitude": 78.6825, "vulnerability_score": 0.85, "capacity": 35000, "status": "Operational"},
    {"id": "hyd-infra-08", "name": "Govt. High School Relief Shelter (Ghatkesar)", "type": "Emergency Shelter", "latitude": 17.5005, "longitude": 78.6875, "vulnerability_score": 0.45, "capacity": 1800, "status": "Operational"},
    {"id": "hyd-infra-09", "name": "Begumpet Central Relief Shelter", "type": "Emergency Shelter", "latitude": 17.4440, "longitude": 78.4720, "vulnerability_score": 0.50, "capacity": 2200, "status": "Operational"},
    {"id": "hyd-infra-10", "name": "Amberpet Water Treatment Works", "type": "Water Treatment", "latitude": 17.3890, "longitude": 78.5150, "vulnerability_score": 0.86, "capacity": 150000, "status": "Operational"},
    {"id": "hyd-infra-11", "name": "Peerzadiguda Retention Basin Pump 02", "type": "Water Treatment", "latitude": 17.4120, "longitude": 78.5820, "vulnerability_score": 0.70, "capacity": 40000, "status": "Operational"},
]

_memory_predictions: List[Dict[str, Any]] = []
_memory_alerts: List[Dict[str, Any]] = []
_memory_crowd_reports: List[Dict[str, Any]] = [
    {
        "id": "crowd-sample-01",
        "latitude": 17.3750,
        "longitude": 78.4820,
        "water_depth": "Knee",
        "location_name": "Chaderghat Nala Crossing",
        "description": "Severe stormwater backflow overflowing onto main road.",
        "created_at": "2026-09-08T12:30:00Z",
        "verified": True,
    },
    {
        "id": "crowd-sample-02",
        "latitude": 17.4920,
        "longitude": 78.6830,
        "water_depth": "Ankle",
        "location_name": "Ghatkesar Station Underpass",
        "description": "Standing water accumulating rapidly near drain culvert.",
        "created_at": "2026-09-08T13:00:00Z",
        "verified": False,
    }
]
_memory_subscriptions: List[Dict[str, Any]] = []
_memory_saved_locations: List[Dict[str, Any]] = []


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

    def save_crowd_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a crowd-sourced waterlogging report."""
        import uuid
        record = dict(report_data)
        record.setdefault("id", f"crowd-{uuid.uuid4().hex[:8]}")
        record.setdefault("created_at", datetime.now(timezone.utc).isoformat())
        record.setdefault("verified", False)

        if self.client:
            try:
                res = self.client.table("crowd_reports").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as exc:
                print(f"[Supabase] Insert crowd report error: {exc}")

        _memory_crowd_reports.append(record)
        return record

    def get_crowd_reports(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch community waterlogging reports."""
        if self.client:
            try:
                res = self.client.table("crowd_reports").select("*").order("created_at", desc=True).limit(limit).execute()
                if res.data:
                    return res.data
            except Exception as exc:
                print(f"[Supabase] Fetch crowd reports error: {exc}")

        return list(reversed(_memory_crowd_reports[-limit:]))

    def save_alert_subscription(self, sub_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save high-hazard zone alert subscription."""
        import uuid
        record = dict(sub_data)
        record.setdefault("subscription_id", f"sub-{uuid.uuid4().hex[:8]}")
        record.setdefault("created_at", datetime.now(timezone.utc).isoformat())
        record.setdefault("status", "active")

        if self.client:
            try:
                res = self.client.table("alert_subscriptions").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as exc:
                print(f"[Supabase] Insert subscription error: {exc}")

        _memory_subscriptions.append(record)
        return record

    def get_alert_subscriptions(self) -> List[Dict[str, Any]]:
        """Fetch alert subscriptions."""
        if self.client:
            try:
                res = self.client.table("alert_subscriptions").select("*").execute()
                if res.data:
                    return res.data
            except Exception as exc:
                print(f"[Supabase] Fetch subscriptions error: {exc}")

        return list(_memory_subscriptions)

    def save_user_location(self, loc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a favorite/pinned location for a user."""
        import uuid
        record = dict(loc_data)
        record.setdefault("id", f"loc-{uuid.uuid4().hex[:8]}")
        record.setdefault("created_at", datetime.now(timezone.utc).isoformat())

        if self.client:
            try:
                res = self.client.table("user_saved_locations").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as exc:
                print(f"[Supabase] Insert user location error: {exc}")

        _memory_saved_locations.append(record)
        return record

    def get_user_locations(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch saved locations for a specific user."""
        if self.client:
            try:
                res = self.client.table("user_saved_locations").select("*").eq("user_id", user_id).execute()
                if res.data:
                    return res.data
            except Exception as exc:
                print(f"[Supabase] Fetch user locations error: {exc}")

        return [loc for loc in _memory_saved_locations if loc.get("user_id") == user_id]


# Global service instance
supabase_service = SupabaseService()


def get_supabase_client() -> Optional[Client]:
    return supabase_service.client
