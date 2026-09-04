from .ml_predictor import LightGBMFloodPredictor


class AlertOrchestrator:
    def __init__(self) -> None:
        self.predictor = LightGBMFloodPredictor()

    def evaluate_hazard(self, features: dict) -> float:
        return self.predictor.predict_probability(features)
