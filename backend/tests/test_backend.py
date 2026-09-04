import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ml_predictor import LightGBMFloodPredictor
from app.ffs_collector import collect_ffs_snapshot, generate_regional_grid

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_ml_predictor_direct():
    predictor = LightGBMFloodPredictor()
    assert predictor.model is not None

    # Low rainfall test
    low_risk = predictor.predict_probability({"latitude": 13.0, "longitude": 80.0, "rainfall_mm": 5.0})
    assert 0.0 <= low_risk <= 1.0

    # High rainfall test
    high_risk = predictor.predict_probability({"latitude": 13.0, "longitude": 80.0, "rainfall_mm": 180.0})
    assert 0.0 <= high_risk <= 1.0

    # High rainfall should yield greater or equal risk compared to low rainfall
    assert high_risk >= low_risk


def test_predict_endpoint():
    payload = {
        "latitude": 13.0827,
        "longitude": 80.2707,
        "rainfall_mm": 95.0,
        "soil_moisture_pct": 75.0,
        "elevation_m": 12.0
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] == payload["latitude"]
    assert data["longitude"] == payload["longitude"]
    assert data["rainfall_mm"] == payload["rainfall_mm"]
    assert 0.0 <= data["probability"] <= 1.0
    assert data["hazard_level"] in ("Low", "Moderate", "High", "Critical")
    assert "rainfall_mm" in data["features_used"]


def test_batch_predict_endpoint():
    payload = {
        "points": [
            {"latitude": 13.08, "longitude": 80.27, "rainfall_mm": 15.0},
            {"latitude": 13.09, "longitude": 80.28, "rainfall_mm": 120.0},
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_points"] == 2
    assert len(data["predictions"]) == 2


def test_ffs_collector_direct_and_endpoint():
    # Direct function test
    snapshot = collect_ffs_snapshot(13.0827, 80.2707)
    assert "status" in snapshot
    assert "metrics" in snapshot
    assert snapshot["metrics"]["rainfall_1h_mm"] > 0

    grid = generate_regional_grid(13.0827, 80.2707, grid_size=3)
    assert len(grid) == 9

    # API endpoints
    resp1 = client.get("/ffs/snapshot?latitude=13.08&longitude=80.27")
    assert resp1.status_code == 200
    assert resp1.json()["coordinates"]["latitude"] == 13.08

    resp2 = client.get("/ffs/grid?center_lat=13.08&center_lon=80.27&grid_size=3")
    assert resp2.status_code == 200
    assert len(resp2.json()) == 9


def test_infrastructure_endpoint():
    response = client.get("/infrastructure?latitude=13.0827&longitude=80.2707&radius_km=10.0")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first_item = data[0]
    assert "name" in first_item
    assert "vulnerability_score" in first_item
    assert "type" in first_item


def test_evaluate_hazard_endpoint():
    payload = {
        "latitude": 13.0827,
        "longitude": 80.2707,
        "rainfall_mm": 110.0,
        "radius_km": 5.0
    }
    response = client.post("/evaluate-hazard", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["flood_probability"] <= 1.0
    assert "compound_risk_score" in data
    assert isinstance(data["threatened_infrastructure"], list)


def test_generate_and_list_alerts():
    payload = {
        "latitude": 13.0827,
        "longitude": 80.2707,
        "rainfall_mm": 125.0,
        "location_name": "Central Chennai Riverway",
        "radius_km": 6.0
    }
    create_resp = client.post("/alerts/generate", json=payload)
    assert create_resp.status_code == 200
    alert_data = create_resp.json()
    assert "alert_id" in alert_data
    assert alert_data["location_name"] == payload["location_name"]
    assert "advisory_markdown" in alert_data
    assert len(alert_data["recommended_actions"]) > 0

    # Retrieve alerts
    list_resp = client.get("/alerts?limit=5")
    assert list_resp.status_code == 200
    alerts_list = list_resp.json()
    assert isinstance(alerts_list, list)
    assert len(alerts_list) >= 1
