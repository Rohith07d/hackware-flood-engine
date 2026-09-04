import os
import math
from pathlib import Path
from typing import Any, Dict, List, Tuple

os.environ.setdefault("OMP_NUM_THREADS", "2")

import numpy as np
import lightgbm as lgb

from .config import settings

FEATURE_NAMES = [
    "rainfall_mm",
    "elevation_m",
    "slope_deg",
    "soil_moisture_pct",
    "distance_to_river_m",
    "drainage_capacity_mm_hr"
]


class LightGBMFloodPredictor:
    def __init__(self) -> None:
        self.model: lgb.Booster | None = None
        self._ensure_model_loaded()

    def _ensure_model_loaded(self) -> None:
        """Load trained LightGBM model from disk or bootstrap baseline model."""
        model_file = settings.model_path
        if model_file.exists():
            try:
                self.model = lgb.Booster(model_file=str(model_file))
                return
            except Exception as exc:
                print(f"[LightGBM] Warning: Failed to load existing model from {model_file}: {exc}. Re-training baseline...")

        # If model doesn't exist or failed to load, train baseline model
        self._train_baseline_model(model_file)

    def _train_baseline_model(self, save_path: Path) -> None:
        """Train a baseline LightGBM model on synthetic hydrological physics data."""
        print("[LightGBM] Bootstrapping baseline flood probability model...")
        np.random.seed(42)
        n_samples = 2500

        # Generate realistic synthetic meteorological/hydrological features
        rainfall = np.random.exponential(scale=35.0, size=n_samples) # 0 to 200+ mm
        elevation = np.random.uniform(2.0, 300.0, size=n_samples)    # 2m (coastal) to 300m (hills)
        slope = np.random.uniform(0.5, 30.0, size=n_samples)         # 0.5 deg (flat plain) to 30 deg
        soil_moisture = np.random.uniform(10.0, 95.0, size=n_samples)# 10% to 95%
        dist_river = np.random.exponential(scale=1500.0, size=n_samples) # river proximity
        drainage = np.random.uniform(10.0, 60.0, size=n_samples)     # mm/hr drainage capacity

        # Hydrological physics rule-based probability score
        # High rainfall + high soil saturation + low elevation + close to river -> high flood risk
        effective_water = np.maximum(0.0, rainfall - drainage)
        saturation_multiplier = soil_moisture / 100.0
        elevation_damping = 1.0 / (1.0 + np.exp((elevation - 25.0) / 15.0))
        river_proximity_risk = np.exp(-dist_river / 1200.0)

        risk_score = (
            (effective_water * saturation_multiplier * 0.035)
            + (elevation_damping * 0.45)
            + (river_proximity_risk * 0.35)
            - (slope * 0.01)
        )
        # Logit link to probability
        probabilities = 1.0 / (1.0 + np.exp(- (risk_score - 1.2) * 2.5))
        labels = (probabilities > 0.45).astype(int)

        # Feature matrix
        X = np.column_stack([rainfall, elevation, slope, soil_moisture, dist_river, drainage])
        y = labels

        train_data = lgb.Dataset(X, label=y, feature_name=FEATURE_NAMES)
        params = {
            "objective": "binary",
            "metric": "binary_logloss",
            "boosting_type": "gbdt",
            "num_leaves": 15,
            "learning_rate": 0.05,
            "verbose": -1,
            "min_child_samples": 20,
        }

        booster = lgb.train(params, train_data, num_boost_round=60)
        self.model = booster

        # Ensure directory exists and save
        save_path.parent.mkdir(parents=True, exist_ok=True)
        booster.save_model(str(save_path))
        print(f"[LightGBM] Baseline model trained and saved to {save_path}")

    def _extract_feature_vector(self, features: Dict[str, Any]) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Normalize inputs and fill hydrological approximations for missing values."""
        rainfall = float(features.get("rainfall_mm", 0.0))

        # Terrain approximation heuristic based on lat/lon if not provided
        lat = float(features.get("latitude", 0.0))
        lon = float(features.get("longitude", 0.0))

        # Synthetic deterministic terrain variation for demo coordinates
        seed_hash = abs(hash(f"{round(lat, 3)}_{round(lon, 3)}")) % 1000
        default_elev = 15.0 + (seed_hash % 80)
        default_slope = 1.5 + (seed_hash % 15) * 0.5
        default_river_dist = 300.0 + (seed_hash % 2500)

        elevation = float(features.get("elevation_m") if features.get("elevation_m") is not None else default_elev)
        slope = float(features.get("slope_deg") if features.get("slope_deg") is not None else default_slope)
        soil_moisture = float(features.get("soil_moisture_pct") if features.get("soil_moisture_pct") is not None else min(90.0, 30.0 + rainfall * 0.35))
        dist_river = float(features.get("distance_to_river_m") if features.get("distance_to_river_m") is not None else default_river_dist)
        drainage = float(features.get("drainage_capacity_mm_hr") if features.get("drainage_capacity_mm_hr") is not None else 25.0)

        feature_dict = {
            "rainfall_mm": round(rainfall, 2),
            "elevation_m": round(elevation, 1),
            "slope_deg": round(slope, 1),
            "soil_moisture_pct": round(soil_moisture, 1),
            "distance_to_river_m": round(dist_river, 1),
            "drainage_capacity_mm_hr": round(drainage, 1),
        }

        vector = np.array([[rainfall, elevation, slope, soil_moisture, dist_river, drainage]], dtype=np.float32)
        return vector, feature_dict

    def predict_probability(self, features: Dict[str, Any]) -> float:
        """Predict spatial flood probability [0.0 to 1.0]."""
        if self.model is None:
            self._ensure_model_loaded()

        vector, _ = self._extract_feature_vector(features)
        raw_pred = self.model.predict(vector)

        # LightGBM binary prediction yields probabilities
        prob = float(raw_pred[0])
        # Clamp strictly between 0.0 and 1.0
        return max(0.0, min(1.0, prob))

    def predict_detailed(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Predict probability and return categorical hazard level and contributing factors."""
        vector, features_used = self._extract_feature_vector(features)
        prob = float(self.model.predict(vector)[0])
        prob = max(0.0, min(1.0, prob))

        hazard_level = self.get_hazard_level(prob)
        return {
            "probability": round(prob, 4),
            "hazard_level": hazard_level,
            "features_used": features_used,
        }

    @staticmethod
    def get_hazard_level(prob: float) -> str:
        if prob < 0.25:
            return "Low"
        elif prob < 0.50:
            return "Moderate"
        elif prob < 0.75:
            return "High"
        else:
            return "Critical"
