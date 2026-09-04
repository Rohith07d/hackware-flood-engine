import os
import math
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

os.environ.setdefault("OMP_NUM_THREADS", "2")

import numpy as np

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False

from .config import settings
from .terrain_service import terrain_service
from .rainfall_service import get_rainfall_scenario_features

# Exact 13 features required by the notebook LightGBM model (lgb_flood_model.txt)
FEATURE_NAMES: List[str] = [
    "elevation",
    "slope",
    "aspect",
    "curvature",
    "tri",
    "twi",
    "rel_elev",
    "flow_acc_log",
    "dist_to_stream",
    "total_rainfall_mm",
    "max_hourly_mm",
    "max_cum24h_mm",
    "max_api",
]


def estimate_terrain_features(lat: float, lon: float) -> Tuple[float, float, float]:
    """
    Spatially smooth terrain estimation for demo basins.
    Replaces random hash noise with a continuous 2D valley-to-ridge profile.
    Returns: (elevation_m, slope_deg, distance_to_river_m)
    """
    coord_key = f"{round(lat, 2)}_{round(lon, 2)}".encode("utf-8")
    macro_seed = int(hashlib.md5(coord_key).hexdigest(), 16) % 1000

    delta_lat_km = abs(lat - 17.4950) * 111.0
    delta_lon_km = (lon - 78.6810) * 105.0

    dist_river_m = float(max(150.0, delta_lat_km * 1000.0 + (macro_seed % 100) * 1.5))
    valley_rise = 18.0 + 8.5 * (delta_lat_km ** 1.3) - (delta_lon_km * 0.8)
    elevation_m = float(np.clip(valley_rise, 12.0, 95.0))
    slope_deg = float(np.clip(1.2 + delta_lat_km * 1.6, 0.8, 18.0))

    return round(elevation_m, 1), round(slope_deg, 1), round(dist_river_m, 1)


class HydrologicalPhysicsModel:
    """
    Fallback continuous calibrated hydrological physics engine.
    Used only if LightGBM booster cannot be loaded.
    """
    def predict_13(self, X: np.ndarray) -> np.ndarray:
        X = np.asarray(X, dtype=np.float32)
        if X.ndim == 1:
            X = X.reshape(1, -1)

        elev = X[:, 0]
        slope = X[:, 1]
        twi = X[:, 5]
        dist_stream = X[:, 8]
        rainfall = X[:, 9]

        drainage = 25.0
        effective_water = rainfall * (rainfall / (rainfall + drainage * 0.8 + 1e-5))
        elevation_factor = 1.0 / (1.0 + np.exp((elev - 520.0) / 30.0))
        river_factor = np.exp(-dist_stream / 1500.0)
        twi_factor = np.clip(twi / 15.0, 0.0, 1.5)
        slope_factor = np.exp(-slope / 10.0)

        hydrological_load = (effective_water / 45.0) * twi_factor
        terrain_vulnerability = (0.45 * elevation_factor + 0.35 * river_factor + 0.20 * slope_factor)

        z = 2.8 * (hydrological_load * 0.65 + terrain_vulnerability * 0.35) - 2.1
        probabilities = 1.0 / (1.0 + np.exp(-z))
        return np.clip(probabilities, 0.0, 1.0)


class LightGBMFloodPredictor:
    """
    Authoritative LightGBM Flood Risk Predictor for Hyderabad.
    Directly evaluates the 13 geospatial terrain + meteorological features
    using the notebook-trained LightGBM model artifact (lgb_flood_model.txt).
    """
    _instance: Optional["LightGBMFloodPredictor"] = None

    def __init__(self) -> None:
        self.booster: Optional[Any] = None
        self.fallback_model = HydrologicalPhysicsModel()
        self.model_path = self._resolve_model_path()
        self._load_model()

    @classmethod
    def get_instance(cls) -> "LightGBMFloodPredictor":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _resolve_model_path(self) -> Path:
        """Find authoritative lgb_flood_model.txt location."""
        candidates = [
            settings.base_dir / "models" / "lgb_flood_model.txt",
            settings.base_dir / "backend" / "models" / "lgb_flood_model.txt",
            Path("backend/models/lgb_flood_model.txt").resolve(),
            Path("models/lgb_flood_model.txt").resolve(),
            settings.model_path,
        ]
        for p in candidates:
            if p.exists() and p.is_file():
                return p
        return settings.base_dir / "models" / "lgb_flood_model.txt"

    def _load_model(self) -> None:
        """Load LightGBM Booster from file."""
        if not LIGHTGBM_AVAILABLE:
            print("[LightGBMFloodPredictor] LightGBM not installed. Using calibrated physics fallback.")
            return

        if self.model_path.exists():
            try:
                self.booster = lgb.Booster(model_file=str(self.model_path))
                print(f"[LightGBMFloodPredictor] Successfully loaded LightGBM model from {self.model_path} ({self.booster.num_feature()} features).")
            except Exception as exc:
                print(f"[LightGBMFloodPredictor] Error loading model file {self.model_path}: {exc}. Using fallback.")
                self.booster = None
        else:
            print(f"[LightGBMFloodPredictor] Model file {self.model_path} not found. Using fallback.")

    @property
    def is_loaded(self) -> bool:
        return self.booster is not None

    @property
    def model(self) -> Any:
        return self.booster or self.fallback_model

    def get_risk_tier(self, probability: float) -> str:
        """Categorize continuous flood probability into authoritative Risk Tier."""
        if probability < 0.25:
            return "Very Low"
        elif probability < 0.45:
            return "Low"
        elif probability < 0.65:
            return "Moderate"
        elif probability < 0.85:
            return "High"
        else:
            return "Very High"

    def get_hazard_level(self, probability: float) -> str:
        """Legacy 4-level categorical hazard indicator."""
        if probability < 0.30:
            return "Low"
        elif probability < 0.60:
            return "Moderate"
        elif probability < 0.80:
            return "High"
        else:
            return "Critical"

    def validate_features(self, feature_dict: Dict[str, Any]) -> np.ndarray:
        """Validate and arrange the exact 13 features into a (1, 13) numpy float32 matrix."""
        missing = [f for f in FEATURE_NAMES if f not in feature_dict or feature_dict[f] is None]
        if missing:
            raise ValueError(f"Missing required features: {missing}. Expected all 13 features: {FEATURE_NAMES}")

        values = []
        for name in FEATURE_NAMES:
            raw_val = feature_dict[name]
            try:
                val = float(raw_val)
            except (ValueError, TypeError):
                raise ValueError(f"Feature '{name}' must be numeric, got: {raw_val}")

            if math.isnan(val) or math.isinf(val):
                raise ValueError(f"Feature '{name}' cannot be NaN or inf, got: {val}")
            values.append(val)

        return np.array([values], dtype=np.float32)

    def extract_driver_factors(self, features: Dict[str, float], probability: float) -> List[Dict[str, Any]]:
        """Identify key physical factors that drive this area's flood risk."""
        drivers = []
        rainfall = features.get("total_rainfall_mm", 0.0)
        max_hourly = features.get("max_hourly_mm", 0.0)
        twi = features.get("twi", 0.0)
        dist_stream = features.get("dist_to_stream", 5000.0)
        elevation = features.get("elevation", 550.0)
        slope = features.get("slope", 2.0)

        if rainfall >= 70.0:
            drivers.append({
                "factor": "Severe Precipitation Accumulation",
                "detail": f"{rainfall:.1f} mm total rainfall exceeds drainage capacity",
                "impact": "High"
            })
        elif rainfall >= 35.0:
            drivers.append({
                "factor": "Moderate Precipitation",
                "detail": f"{rainfall:.1f} mm rainfall contributes to localized ponding",
                "impact": "Medium"
            })

        if max_hourly >= 25.0:
            drivers.append({
                "factor": "Intense Rainfall Burst",
                "detail": f"Peak intensity of {max_hourly:.1f} mm/hr triggers flash surcharge",
                "impact": "High"
            })

        if twi >= 10.0:
            drivers.append({
                "factor": "High Topographic Wetness Index (TWI)",
                "detail": f"TWI {twi:.2f} indicates natural hollow where surface runoff converges",
                "impact": "High"
            })
        elif twi >= 8.0:
            drivers.append({
                "factor": "Moderate Topographic Wetness",
                "detail": f"TWI {twi:.2f} reflects gentle water accumulation potential",
                "impact": "Medium"
            })

        if dist_stream < 500.0:
            drivers.append({
                "factor": "Channel Proximity",
                "detail": f"Located {dist_stream:.0f} m from major stream / lake outfall",
                "impact": "High"
            })
        elif dist_stream < 1500.0:
            drivers.append({
                "factor": "Drainage Basin Proximity",
                "detail": f"Located {dist_stream:.0f} m from feeder watercourses",
                "impact": "Medium"
            })

        if elevation < 515.0:
            drivers.append({
                "factor": "Depressed Topography",
                "detail": f"Elevation {elevation:.1f} m lies in a low Hyderabad basin",
                "impact": "High"
            })

        if slope < 1.0:
            drivers.append({
                "factor": "Extremely Flat Gradient",
                "detail": f"Slope {slope:.2f}° impedes gravity drainage",
                "impact": "High"
            })

        if not drivers:
            drivers.append({
                "factor": "Stable High-Ground Terrain",
                "detail": f"Elevation {elevation:.1f} m and slope {slope:.1f}° promote natural runoff shedding",
                "impact": "Low"
            })

        return drivers

    def predict_13_features(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Primary inference entry point:
        Predicts continuous flood susceptibility using the exact 13 features.
        """
        if not self.is_loaded:
            self._load_model()

        X = self.validate_features(features)

        if self.booster is not None:
            raw_pred = self.booster.predict(X)
            prob = float(raw_pred[0])
        else:
            raw_pred = self.fallback_model.predict_13(X)
            prob = float(raw_pred[0])

        rainfall_val = float(features.get("total_rainfall_mm", 0.0))
        if rainfall_val > 0.0 and prob < 0.05:
            prob = min(1.0, prob + (rainfall_val * 0.00015))

        prob = max(0.0, min(1.0, prob))
        risk_tier = self.get_risk_tier(prob)
        hazard_level = self.get_hazard_level(prob)
        drivers = self.extract_driver_factors(features, prob)

        # Standardized rounded feature dictionary for output
        cleaned_features = {k: round(float(features[k]), 4) for k in FEATURE_NAMES}

        return {
            "probability": round(prob, 4),
            "susceptibility": round(prob, 4),
            "susceptibility_score": round(prob, 4),
            "risk_tier": risk_tier,
            "hazard_level": hazard_level,
            "risk_level": hazard_level.upper(),
            "drivers": drivers,
            "features": cleaned_features,
            "features_used": cleaned_features,
            "model_type": "LightGBM (13-feature notebook artifact)" if self.booster else "Calibrated Hydrological Physics",
        }

    def predict_coordinate(
        self,
        latitude: float,
        longitude: float,
        rainfall_mm: float,
        overrides: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate flood susceptibility for any geographic coordinate in Hyderabad.
        1. Samples real 9 DEM features from terrain_service.
        2. Derives 4 rainfall storm features from rainfall_service.
        3. Evaluates through 13-feature LightGBM model.
        """
        # Step 1: Real 9 DEM features
        terrain_feats = terrain_service.sample_terrain_features(latitude, longitude)

        # Step 2: Real 4 storm rainfall features
        rain_feats = get_rainfall_scenario_features(rainfall_mm)

        # Merge all 13 features
        merged: Dict[str, float] = {
            "elevation": float(terrain_feats["elevation"]),
            "slope": float(terrain_feats["slope"]),
            "aspect": float(terrain_feats["aspect"]),
            "curvature": float(terrain_feats["curvature"]),
            "tri": float(terrain_feats["tri"]),
            "twi": float(terrain_feats["twi"]),
            "rel_elev": float(terrain_feats["rel_elev"]),
            "flow_acc_log": float(terrain_feats["flow_acc_log"]),
            "dist_to_stream": float(terrain_feats["dist_to_stream"]),
            "total_rainfall_mm": float(rain_feats["total_rainfall_mm"]),
            "max_hourly_mm": float(rain_feats["max_hourly_mm"]),
            "max_cum24h_mm": float(rain_feats["max_cum24h_mm"]),
            "max_api": float(rain_feats["max_api"]),
        }

        if overrides:
            for k, v in overrides.items():
                if k in merged and v is not None:
                    merged[k] = float(v)

        result = self.predict_13_features(merged)
        result["latitude"] = latitude
        result["longitude"] = longitude
        result["rainfall_mm"] = rainfall_mm
        result["features_used"] = result["features"]
        return result

    def predict_probability(self, features: Dict[str, Any]) -> float:
        """Evaluate flood probability, mapping legacy or 13-feature inputs."""
        # If all 13 features present
        if all(k in features for k in FEATURE_NAMES):
            res = self.predict_13_features(features)
            return res["susceptibility_score"]

        # If coordinate-driven or legacy features
        lat = float(features.get("latitude", 17.4401))
        lon = float(features.get("longitude", 78.3489))
        rainfall = float(features.get("rainfall_mm", features.get("total_rainfall_mm", 50.0)))
        res = self.predict_coordinate(lat, lon, rainfall, overrides=features)
        return res["susceptibility_score"]

    def predict_susceptibility(self, features: Dict[str, Any]) -> float:
        return self.predict_probability(features)

    def predict_detailed(self, features: Dict[str, Any]) -> Dict[str, Any]:
        lat = float(features.get("latitude", 17.4401))
        lon = float(features.get("longitude", 78.3489))
        rainfall = float(features.get("rainfall_mm", features.get("total_rainfall_mm", 50.0)))
        return self.predict_coordinate(lat, lon, rainfall, overrides=features)

    def predict_batch(self, points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Vectorized batch prediction across N coordinates or feature dictionaries.
        Evaluates the entire batch in a single LightGBM inference pass.
        """
        if not points:
            return []

        if not self.is_loaded:
            self._load_model()

        n = len(points)
        X_matrix = np.zeros((n, 13), dtype=np.float32)
        results = []

        for i, pt in enumerate(points):
            lat = float(pt.get("latitude") if pt.get("latitude") is not None else 17.4401)
            lon = float(pt.get("longitude") if pt.get("longitude") is not None else 78.3489)
            rainfall = float(pt.get("rainfall_mm") if pt.get("rainfall_mm") is not None else (pt.get("total_rainfall_mm") if pt.get("total_rainfall_mm") is not None else 50.0))

            terrain_feats = terrain_service.sample_terrain_features(lat, lon)
            rain_feats = get_rainfall_scenario_features(rainfall)

            def get_f(k: str, default_val: Any) -> float:
                v = pt.get(k)
                return float(v if v is not None else default_val)

            row_feats = [
                get_f("elevation", terrain_feats["elevation"]),
                get_f("slope", terrain_feats["slope"]),
                get_f("aspect", terrain_feats["aspect"]),
                get_f("curvature", terrain_feats["curvature"]),
                get_f("tri", terrain_feats["tri"]),
                get_f("twi", terrain_feats["twi"]),
                get_f("rel_elev", terrain_feats["rel_elev"]),
                get_f("flow_acc_log", terrain_feats["flow_acc_log"]),
                get_f("dist_to_stream", terrain_feats["dist_to_stream"]),
                get_f("total_rainfall_mm", rain_feats["total_rainfall_mm"]),
                get_f("max_hourly_mm", rain_feats["max_hourly_mm"]),
                get_f("max_cum24h_mm", rain_feats["max_cum24h_mm"]),
                get_f("max_api", rain_feats["max_api"]),
            ]
            X_matrix[i, :] = row_feats

        if self.booster is not None:
            probs = self.booster.predict(X_matrix)
        else:
            probs = self.fallback_model.predict_13(X_matrix)

        for i, pt in enumerate(points):
            r = float(pt.get("rainfall_mm", pt.get("total_rainfall_mm", 50.0)))
            p = float(np.clip(probs[i], 0.0, 1.0))
            if r > 0.0 and p < 0.05:
                p = min(1.0, p + (r * 0.00015))
            h = self.get_hazard_level(p)
            results.append({
                "latitude": float(pt.get("latitude", 17.4401)),
                "longitude": float(pt.get("longitude", 78.3489)),
                "rainfall_mm": r,
                "probability": round(p, 4),
                "susceptibility": round(p, 4),
                "risk_tier": self.get_risk_tier(p),
                "hazard_level": h,
                "risk_level": h.upper(),
                "features_used": {"total_rainfall_mm": r},
            })

        return results


ml_predictor = LightGBMFloodPredictor.get_instance()
predictor = ml_predictor
