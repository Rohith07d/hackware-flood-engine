import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ml_predictor import LightGBMFloodPredictor, FEATURE_NAMES, predictor
from app.terrain_service import terrain_service
from app.rainfall_service import get_rainfall_scenario_features, compute_rainfall_metrics_from_series
from app.ffs_collector import collect_ffs_snapshot, generate_regional_grid

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_ready"] is True
    assert data["dem_cached"] is True
    assert "version" in data


def test_model_status_endpoint():
    response = client.get("/model/status")
    assert response.status_code == 200
    data = response.json()
    assert data["model_name"] == "lgb_flood_model.txt"
    assert data["feature_count"] == 13
    assert data["feature_names"] == FEATURE_NAMES
    assert data["is_loaded"] is True
    assert data["dem_cached"] is True
    assert "AI-based Flood Susceptibility Estimate" in data["disclaimer"]


def test_terrain_service_sampling():
    feats = terrain_service.sample_terrain_features(latitude=17.4065, longitude=78.4772)
    expected_terrain_keys = [
        "elevation", "slope", "aspect", "curvature",
        "tri", "twi", "rel_elev", "flow_acc_log", "dist_to_stream"
    ]
    for key in expected_terrain_keys:
        assert key in feats
        assert isinstance(feats[key], (int, float))
    assert feats["elevation"] > 0


def test_rainfall_service_calculation():
    rain_feats = get_rainfall_scenario_features(100.0)
    expected_rain_keys = ["total_rainfall_mm", "max_hourly_mm", "max_cum24h_mm", "max_api"]
    for key in expected_rain_keys:
        assert key in rain_feats
        assert isinstance(rain_feats[key], (int, float))
        assert rain_feats[key] >= 0.0

    # Test metric computation from series
    metrics = compute_rainfall_metrics_from_series([5.0, 10.0, 15.0, 20.0])
    assert metrics["total_rainfall_mm"] == 50.0
    assert metrics["max_hourly_mm"] == 20.0
    assert metrics["max_api"] > 0


def test_ml_predictor_strict_validation():
    # Test missing feature rejection
    incomplete = {"elevation": 500.0, "slope": 2.0}
    with pytest.raises(ValueError, match="Missing required features"):
        predictor.validate_features(incomplete)

    # Test NaN rejection
    nan_dict = {f: 1.0 for f in FEATURE_NAMES}
    nan_dict["twi"] = float("nan")
    with pytest.raises(ValueError, match="cannot be NaN"):
        predictor.validate_features(nan_dict)

    # Valid complete 13 features
    valid_dict = {
        "elevation": 505.0,
        "slope": 2.5,
        "aspect": 180.0,
        "curvature": 0.0,
        "tri": 2.0,
        "twi": 8.5,
        "rel_elev": 0.0,
        "flow_acc_log": 3.0,
        "dist_to_stream": 500.0,
        "total_rainfall_mm": 100.0,
        "max_hourly_mm": 15.0,
        "max_cum24h_mm": 60.0,
        "max_api": 45.0,
    }
    vec = predictor.validate_features(valid_dict)
    assert vec.shape == (1, 13)

    prob = predictor.predict_susceptibility(valid_dict)
    assert 0.0 <= prob <= 1.0


def test_predict_endpoint_coordinate():
    payload = {
        "latitude": 17.4065,
        "longitude": 78.4772,
        "rainfall_mm": 120.0,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] == payload["latitude"]
    assert data["longitude"] == payload["longitude"]
    assert data["rainfall_mm"] == payload["rainfall_mm"]
    assert 0.0 <= data["susceptibility"] <= 1.0
    assert 0.0 <= data["probability"] <= 1.0
    assert data["risk_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
    assert len(data["features_used"]) == 13
    for f in FEATURE_NAMES:
        assert f in data["features_used"]


def test_batch_predict_endpoint():
    payload = {
        "points": [
            {"latitude": 17.40, "longitude": 78.47, "rainfall_mm": 20.0},
            {"latitude": 17.45, "longitude": 78.50, "rainfall_mm": 160.0},
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_points"] == 2
    assert len(data["predictions"]) == 2
    for p in data["predictions"]:
        assert 0.0 <= p["susceptibility"] <= 1.0
        assert p["risk_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")


def test_hazard_map_metadata_and_overlay():
    # Metadata endpoint
    resp_meta = client.get("/hazard-map/metadata")
    assert resp_meta.status_code == 200
    meta = resp_meta.json()
    assert meta["crs"] == "EPSG:4326"
    assert "bounds" in meta
    assert "leaflet_bounds" in meta
    assert meta["shape"] == [1201, 1201]
    assert meta["overlay_url"] == "/hazard-map/overlay.png"

    # Overlay PNG endpoint
    resp_png = client.get("/hazard-map/overlay.png")
    assert resp_png.status_code == 200
    assert resp_png.headers["content-type"] == "image/png"
    assert len(resp_png.content) > 10000


def test_rainfall_timeseries_endpoint():
    response = client.get("/rainfall/timeseries")
    assert response.status_code == 200
    data = response.json()
    assert "storm_event" in data
    assert "summary_metrics" in data
    assert len(data["hourly_data"]) > 0


def test_evaluate_hazard_endpoint():
    payload = {
        "latitude": 17.4065,
        "longitude": 78.4772,
        "rainfall_mm": 110.0,
        "radius_km": 5.0,
    }
    response = client.post("/evaluate-hazard", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["flood_probability"] <= 1.0
    assert 0.0 <= data["susceptibility"] <= 1.0
    assert "compound_risk_score" in data
    assert isinstance(data["threatened_infrastructure"], list)


def test_alerts_generate_and_list():
    payload = {
        "latitude": 17.4065,
        "longitude": 78.4772,
        "rainfall_mm": 135.0,
        "location_name": "Hyderabad Musi River Basin",
        "radius_km": 5.0,
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
