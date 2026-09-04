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


def test_smooth_physics_gradient_no_cliff():
    """Verify that predictions follow a smooth, strictly monotonic curve with no quantization cliff."""
    predictor = LightGBMFloodPredictor()
    rainfalls = [0.0, 10.0, 25.0, 50.0, 75.0, 100.0, 130.0]
    probabilities = [
        predictor.predict_probability({"latitude": 17.4948, "longitude": 78.681, "rainfall_mm": r})
        for r in rainfalls
    ]

    # Strictly monotonic increase
    for i in range(len(probabilities) - 1):
        assert probabilities[i] < probabilities[i + 1], f"Expected prob at {rainfalls[i]}mm < {rainfalls[i+1]}mm"

    # Distinct values (no flat cliff plateaus like 0.171 -> 0.171)
    assert len(set(round(p, 3) for p in probabilities)) == len(rainfalls)


def test_terrain_spatial_smoothness_and_determinism():
    """Verify deterministic MD5 hashing and spatially smooth valley profile."""
    from app.ml_predictor import estimate_terrain_features
    # Determinism: same coordinates return exact same values
    t1 = estimate_terrain_features(17.4948, 78.681)
    t2 = estimate_terrain_features(17.4948, 78.681)
    assert t1 == t2

    # Smoothness: adjacent points (within ~1 km) have gradual elevation changes (< 15m), no speckle
    elev_center, _, _ = estimate_terrain_features(17.4948, 78.681)
    elev_near, _, _ = estimate_terrain_features(17.5048, 78.681)
    assert abs(elev_near - elev_center) < 15.0


def test_compound_risk_no_saturation_and_distance_aware():
    """Verify compound risk does not saturate prematurely and threats are distance-scaled."""
    from app.alert_orchestrator import AlertOrchestrator
    orchestrator = AlertOrchestrator()

    # Moderate rainfall (30 mm) near Ghatkesar
    result = orchestrator.evaluate_compound_hazard(
        latitude=17.4948,
        longitude=78.681,
        rainfall_mm=30.0,
        radius_km=5.0
    )
    # Must NOT saturate to Critical (1.0)
    assert result["compound_risk_score"] < 0.70
    assert result["hazard_level"].upper() in ("LOW", "MODERATE")

    # Threat check: distant assets (e.g. > 3km) should not be flagged under moderate conditions
    for asset in result["threatened_infrastructure"]:
        assert asset.get("distance_km", 0) <= 3.5


def test_default_coordinates_aligned_hyderabad():
    """Verify defaults in FFS and infrastructure endpoints align on Hyderabad / Ghatkesar."""
    # FFS default snapshot
    ffs_resp = client.get("/ffs/snapshot")
    assert ffs_resp.status_code == 200
    assert round(ffs_resp.json()["coordinates"]["latitude"], 2) == 17.49
    assert round(ffs_resp.json()["coordinates"]["longitude"], 2) == 78.68

    # Infrastructure default
    infra_resp = client.get("/infrastructure")
    assert infra_resp.status_code == 200
    assets = infra_resp.json()
    assert assets[0]["distance_km"] <= 5.0


def test_featherless_health_endpoint():
    """Verify GET /health/featherless returns operational or configured status."""
    resp = client.get("/health/featherless")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "connected" in data
    assert "model" in data


def test_geocoding_service():
    """Verify local catalog resolves Gachibowli and coordinate reverse geocode."""
    from app.geocoding_service import geocoding_service
    res1 = geocoding_service.resolve_location("Gachibowli, Hyderabad")
    assert res1["status"] == "resolved"
    assert round(res1["latitude"], 2) == 17.44
    assert round(res1["longitude"], 2) == 78.35
    assert len(res1["bounding_box"]) == 4

    res2 = geocoding_service.resolve_location(latitude=17.4447, longitude=78.4664)
    assert res2["status"] == "resolved"
    assert "Begumpet" in res2["location_name"]


def test_analyze_area_endpoint():
    """Verify POST /analyze-area orchestrates LightGBM, 13 features, and AI synthesis."""
    payload = {
        "location_name": "Gachibowli, Hyderabad",
        "rainfall_mm": 85.0
    }
    resp = client.post("/analyze-area", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "Gachibowli" in data["area_name"]
    assert "coordinates" in data
    assert 0.0 <= data["susceptibility_score"] <= 1.0
    assert data["risk_tier"] in ("Very Low", "Low", "Moderate", "High", "Very High")
    assert len(data["features_13"]) == 13
    assert len(data["recommendations"]) > 0
    assert len(data["ai_summary"]) > 20
    assert data["supabase_record_id"] is not None

