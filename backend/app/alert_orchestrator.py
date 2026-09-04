from .ml_predictor import predict_flood_probability


def evaluate_hazard(features: dict) -> dict:
    probability = predict_flood_probability(features)
    return {'flood_probability': probability, 'alert': probability >= 0.7}
