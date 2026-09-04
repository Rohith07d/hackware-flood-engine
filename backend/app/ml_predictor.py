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
        self.model_feature_names: List[str] = FEATURE_NAMES.copy()
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
            model_features = list(self.model.feature_name())
            print(f"[LightGBM] Model loaded successfully with {len(model_features)} features: {model_features}")

            missing = [f for f in FEATURE_NAMES if f not in model_features]
            extras = [f for f in model_features if f not in FEATURE_NAMES]
            if missing or extras:
                raise RuntimeError(
                    f"[LightGBM] Model feature mismatch. Missing: {missing or 'none'}, Extra: {extras or 'none'}"
                )

            self.model_feature_names = model_features
            if self.model_feature_names != FEATURE_NAMES:
                print("[LightGBM] Warning: Feature order differs from expected baseline; using model-native order.")
        except Exception as exc:
            raise RuntimeError(f"[LightGBM] Failed to load trained model: {exc}") from exc

    def validate_features(self, feature_dict: Dict[str, Any]) -> np.ndarray:
        """
        Validate that all 13 features are present, numeric, and finite.
        Preserves exact feature order.
        Rejects missing, NaN, or infinite inputs.
        """
        ordered_features = self.model_feature_names or FEATURE_NAMES
        missing = [f for f in ordered_features if f not in feature_dict or feature_dict[f] is None]
        if missing:
            raise ValueError(f"Missing required features: {missing}. Expected all 13 features: {FEATURE_NAMES}")

        values = []
        for name in ordered_features:
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
            "features_used": {k: feature_dict[k] for k in (self.model_feature_names or FEATURE_NAMES) if k in feature_dict},
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

        # Step 2: Rainfall features
        rain_feats = get_rainfall_scenario_features(rainfall_mm)

        # Merge into 13 features
        features = {**terrain_feats, **rain_feats}

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
