from typing import Any, Dict

import lightgbm as lgb


class LightGBMFloodPredictor:
    def __init__(self) -> None:
        self.model: lgb.Booster | None = None

    def predict_probability(self, features: Dict[str, Any]) -> float:
        _ = features
        return 0.0
