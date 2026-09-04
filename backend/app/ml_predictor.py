import os
import math
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

os.environ.setdefault("OMP_NUM_THREADS", "2")

import numpy as np
import lightgbm as lgb

from .config import settings
from .terrain_service import terrain_service
from .rainfall_service import get_rainfall_scenario_features

# Central source of truth for the 13 features expected by lgb_flood_model.txt
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


class LightGBMFloodPredictor:
    """
    Production LightGBM flood susceptibility inference service.
    Loads lgb_flood_model.txt once, validates exact 13 features,
    and returns susceptibility probability and categorical risk levels.
    """
    _instance: Optional["LightGBMFloodPredictor"] = None

    def __init__(self) -> None:
        self.model: Optional[lgb.Booster] = None
        self._load_model()

    @classmethod
    def get_instance(cls) -> "LightGBMFloodPredictor":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_model(self) -> None:
        """Load the pre-trained LightGBM model from disk once."""
        model_file = settings.model_path
        if not model_file.exists():
            # Fallback to secondary location if needed
            alt_path = settings.base_dir / "models" / "lgb_flood_model.txt"
            if alt_path.exists():
                model_file = alt_path
            else:
                raise FileNotFoundError(f"[LightGBM] Critical: Trained model not found at {model_file}")

        try:
            print(f"[LightGBM] Loading trained model from {model_file}...")
            self.model = lgb.Booster(model_file=str(model_file))
            model_features = self.model.feature_name()
            print(f"[LightGBM] Model loaded successfully with {len(model_features)} features: {model_features}")

            # Verify feature compatibility
            if len(model_features) != len(FEATURE_NAMES):
                print(f"[LightGBM] Warning: Model feature count ({len(model_features)}) != expected ({len(FEATURE_NAMES)})")
        except Exception as exc:
            raise RuntimeError(f"[LightGBM] Failed to load trained model: {exc}") from exc

    def validate_features(self, feature_dict: Dict[str, Any]) -> np.ndarray:
        """
        Validate that all 13 features are present, numeric, and finite.
        Preserves exact feature order.
        Rejects missing, NaN, or infinite inputs.
        """
        missing = [f for f in FEATURE_NAMES if f not in feature_dict or feature_dict[f] is None]
        if missing:
            raise ValueError(f"Missing required features: {missing}. Expected all 13 features: {FEATURE_NAMES}")

        values = []
        for name in FEATURE_NAMES:
            raw_val = feature_dict[name]
            try:
                val = float(raw_val)
            except (ValueError, TypeError):
                raise ValueError(f"Feature '{name}' must be a numeric value, got: {raw_val}")

            if math.isnan(val) or math.isinf(val):
                raise ValueError(f"Feature '{name}' cannot be NaN or infinite, got: {val}")

            values.append(val)

        return np.array([values], dtype=np.float32)

    def predict_susceptibility(self, feature_dict: Dict[str, Any]) -> float:
        """
        Compute flood susceptibility score in [0.0, 1.0].
        Validates all 13 features before inference.
        """
        if self.model is None:
            self._load_model()

        vector = self.validate_features(feature_dict)
        raw_pred = self.model.predict(vector)
        prob = float(raw_pred[0])
        return max(0.0, min(1.0, prob))

    def predict_detailed(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate, infer susceptibility, and classify risk level."""
        score = self.predict_susceptibility(feature_dict)
        risk = self.classify_risk_level(score)

        return {
            "susceptibility": round(score, 4),
            "risk_level": risk,
            "features_used": {k: feature_dict[k] for k in FEATURE_NAMES if k in feature_dict},
        }

    def predict_coordinate(
        self,
        latitude: float,
        longitude: float,
        rainfall_mm: float,
        overrides: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        End-to-End Feature Preparation & Inference Pipeline:
          1. Sample 9 physical terrain features from DEM at (latitude, longitude)
          2. Derive 4 hydrological rainfall features from rainfall scenario
          3. Validate exact 13 features
          4. Execute LightGBM inference
          5. Return susceptibility score & risk classification
        """
        # Step 1: Terrain features from DEM
        terrain_feats = terrain_service.sample_terrain_features(latitude, longitude)

        # Step 2: Rainfall features from simulation (or live source)
        rainfall_feats = get_rainfall_scenario_features(rainfall_mm)

        # Merge into the exact 13 features expected by the model
        features = {
            "elevation": terrain_feats.get("elevation", 505.0),
            "slope": terrain_feats.get("slope", 2.5),
            "aspect": terrain_feats.get("aspect", 180.0),
            "curvature": terrain_feats.get("curvature", 0.0),
            "tri": terrain_feats.get("tri", 2.0),
            "twi": terrain_feats.get("twi", 8.5),
            "rel_elev": terrain_feats.get("rel_elev", 0.0),
            "flow_acc_log": terrain_feats.get("flow_acc_log", 3.0),
            "dist_to_stream": terrain_feats.get("dist_to_stream", 500.0),
            "total_rainfall_mm": rainfall_feats.get("total_rainfall_mm", 0.0),
            "max_hourly_mm": rainfall_feats.get("max_hourly_mm", 0.0),
            "max_cum24h_mm": rainfall_feats.get("max_cum24h_mm", 0.0),
            "max_api": rainfall_feats.get("max_api", 0.0),
        }

        # Apply any explicit overrides if provided
        if overrides:
            for k, v in overrides.items():
                if v is not None and k in features:
                    features[k] = v

        result = self.predict_detailed(features)
        result["latitude"] = latitude
        result["longitude"] = longitude
        result["rainfall_mm"] = rainfall_mm
        return result

    @staticmethod
    def classify_risk_level(score: float) -> str:
        """
        Classify numerical susceptibility into standard hazard tiers:
          [0.00 - 0.25) -> LOW
          [0.25 - 0.50) -> MODERATE
          [0.50 - 0.75) -> HIGH
          [0.75 - 1.00] -> CRITICAL
        """
        if score < 0.25:
            return "LOW"
        elif score < 0.50:
            return "MODERATE"
        elif score < 0.75:
            return "HIGH"
        else:
            return "CRITICAL"


# Global singleton instance
predictor = LightGBMFloodPredictor.get_instance()
