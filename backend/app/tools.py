import os
from geopy.geocoders import Nominatim
from .terrain_service import terrain_service
from .rainfall_service import get_rainfall_scenario_features
from .ml_predictor import predictor
from .supabase_service import supabase_service

geolocator = Nominatim(user_agent="hackware_flood_engine")

def resolve_area(location: str) -> dict:
    """Resolve a location string to latitude and longitude."""
    try:
        loc = geolocator.geocode(location)
        if loc:
            return {"latitude": loc.latitude, "longitude": loc.longitude, "address": loc.address, "status": "success"}
        return {"status": "error", "message": "Location not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_terrain_features(latitude: float, longitude: float) -> dict:
    """Extract terrain features at the given latitude and longitude."""
    try:
        feats = terrain_service.sample_terrain_features(latitude, longitude)
        return {"status": "success", "features": feats}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_live_rainfall(latitude: float, longitude: float) -> dict:
    """Obtain rainfall-event features for the given location."""
    # Using 50mm as default for now, could be passed dynamically
    try:
        feats = get_rainfall_scenario_features(50.0) 
        return {"status": "success", "features": feats}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_flood_model(terrain_features: dict, rainfall_features: dict) -> dict:
    """Execute the LightGBM flood susceptibility model."""
    try:
        features = {}
        features.update(terrain_features)
        features.update(rainfall_features)
        res = predictor.predict_detailed(features)
        return {"status": "success", "prediction": res}
    except Exception as e:
        return {"status": "error", "message": str(e)}
