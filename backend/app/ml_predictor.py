import os
import math
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

os.environ.setdefault("OMP_NUM_THREADS", "2")

import numpy as np
import lightgbm as lgb
from scipy.spatial import cKDTree

from .config import settings
from .terrain_service import terrain_service
from .rainfall_service import get_rainfall_scenario_features

# Central reference coordinate for metric equidistant projection around Hyderabad
HYDERABAD_REF_LAT = 17.40
HYDERABAD_REF_LON = 78.40
METERS_PER_DEG_LAT = 111320.0
METERS_PER_DEG_LON = 111320.0 * math.cos(math.radians(HYDERABAD_REF_LAT))


class DrainSpatialIndex:
    """
    High-performance spatial index for hydrological drain networks.
    Loads local_drains.geojson, densifies line coordinates to sub-20m resolution,
    projects to metric Cartesian coordinates (meters), and indexes with scipy.spatial.cKDTree
    for O(log M) nearest-drain Euclidean distance queries.
    """
    _instance: Optional["DrainSpatialIndex"] = None

    def __init__(self, geojson_path: Optional[Path] = None) -> None:
        self.tree: Optional[cKDTree] = None
        self.point_count: int = 0
        path = geojson_path or (settings.base_dir / "data" / "local_drains.geojson")
        self._build_tree(path)

    @classmethod
    def get_instance(cls) -> "DrainSpatialIndex":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _build_tree(self, path: Path) -> None:
        if not path.exists():
            # Fallback path check
            alt_path = Path(__file__).resolve().parent.parent / "data" / "local_drains.geojson"
            if alt_path.exists():
                path = alt_path
            else:
                print(f"[DrainSpatialIndex] Warning: {path} not found. Drain distance calculations will fallback.")
                return

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            metric_points: List[List[float]] = []
            for feat in data.get("features", []):
                geom = feat.get("geometry", {})
                coords = geom.get("coordinates", [])
                geom_type = geom.get("type")

                lines: List[List[List[float]]] = []
                if geom_type == "LineString":
                    lines = [coords]
                elif geom_type == "MultiLineString":
                    lines = coords

                for line in lines:
                    if not line:
                        continue
                    for i in range(len(line) - 1):
                        lon1, lat1 = line[i][:2]
                        lon2, lat2 = line[i + 1][:2]
                        x1 = (lon1 - HYDERABAD_REF_LON) * METERS_PER_DEG_LON
                        y1 = (lat1 - HYDERABAD_REF_LAT) * METERS_PER_DEG_LAT
                        x2 = (lon2 - HYDERABAD_REF_LON) * METERS_PER_DEG_LON
                        y2 = (lat2 - HYDERABAD_REF_LAT) * METERS_PER_DEG_LAT
                        segment_len = math.hypot(x2 - x1, y2 - y1)
                        steps = max(1, int(math.ceil(segment_len / 20.0)))
                        for s in range(steps):
                            t = s / steps
                            metric_points.append([x1 + t * (x2 - x1), y1 + t * (y2 - y1)])
                    last_lon, last_lat = line[-1][:2]
                    metric_points.append([
                        (last_lon - HYDERABAD_REF_LON) * METERS_PER_DEG_LON,
                        (last_lat - HYDERABAD_REF_LAT) * METERS_PER_DEG_LAT
                    ])

            if metric_points:
                pts_arr = np.array(metric_points, dtype=np.float64)
                self.tree = cKDTree(pts_arr)
                self.point_count = len(pts_arr)
                print(f"[DrainSpatialIndex] Indexed {self.point_count} densified drain nodes into cKDTree.")
        except Exception as exc:
            print(f"[DrainSpatialIndex] Error building cKDTree from {path}: {exc}")

    def query_distance_meters(self, latitude: float, longitude: float) -> float:
        """Calculate exact distance in meters to nearest drain in O(log M) time."""
        if self.tree is None:
            return 500.0

        qx = (longitude - HYDERABAD_REF_LON) * METERS_PER_DEG_LON
        qy = (latitude - HYDERABAD_REF_LAT) * METERS_PER_DEG_LAT
        dist, _ = self.tree.query([qx, qy])
        return round(float(dist), 2)

    def query_grid_distances_meters(self, latitudes: np.ndarray, longitudes: np.ndarray) -> np.ndarray:
        """Vectorized distance calculation for DEM grids and batch inferences in O(N log M) time."""
        if self.tree is None:
            return np.full(latitudes.shape, 500.0, dtype=np.float32)

        qx = (longitudes - HYDERABAD_REF_LON) * METERS_PER_DEG_LON
        qy = (latitudes - HYDERABAD_REF_LAT) * METERS_PER_DEG_LAT
        pts = np.column_stack([qx.ravel(), qy.ravel()])
        dists, _ = self.tree.query(pts)
        return dists.reshape(latitudes.shape).astype(np.float32)


drain_index = DrainSpatialIndex.get_instance()

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
        self.drain_index: DrainSpatialIndex = DrainSpatialIndex.get_instance()
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

        # Step 2: Calculate exact metric distance to nearest drain via cKDTree
        drain_distance_m = self.drain_index.query_distance_meters(latitude, longitude)

        # Step 3: Rainfall features from simulation (or live source)
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
            "dist_to_stream": drain_distance_m,
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

    def compute_grid_drain_distances(self, grid_lats: np.ndarray, grid_lons: np.ndarray) -> np.ndarray:
        """
        Vectorized computation of nearest drain distance across DEM grids using cKDTree.
        Runs in O(N log M) time, replacing brute-force iteration.
        """
        return self.drain_index.query_grid_distances_meters(grid_lats, grid_lons)

    def predict_proba(self, X: Any) -> np.ndarray:
        """
        Compute class probabilities [P(no_flood), P(flood)] for feature matrix X (N, 13).
        Compatible with scikit-learn predict_proba API.
        Returns continuous probabilities directly from the LightGBM Booster.
        """
        if self.model is None:
            self._load_model()

        if not isinstance(X, np.ndarray):
            X = np.array(X, dtype=np.float32)
        if X.ndim == 1:
            X = X.reshape(1, -1)

        raw_pred = self.model.predict(X)
        p1 = np.clip(np.asarray(raw_pred, dtype=np.float64), 0.0, 1.0)
        p0 = 1.0 - p1
        return np.column_stack([p0, p1])

    def predict_flood_extent(
        self,
        rainfall_mm: float = 62.0,
        epicenter_lat: Optional[float] = None,
        epicenter_lon: Optional[float] = None,
        roads_geojson_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """Method wrapper for predict_flood_extent."""
        return predict_flood_extent(
            rainfall_mm=rainfall_mm,
            epicenter_lat=epicenter_lat,
            epicenter_lon=epicenter_lon,
            roads_geojson_path=roads_geojson_path,
            predictor_instance=self,
        )

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


def predict_flood_extent(
    rainfall_mm: float = 62.0,
    epicenter_lat: Optional[float] = None,
    epicenter_lon: Optional[float] = None,
    roads_geojson_path: Optional[Path] = None,
    predictor_instance: Optional[LightGBMFloodPredictor] = None,
) -> Dict[str, Any]:
    """
    Enriches road network GeoJSON with continuous flood risk scores derived directly
    from LightGBM's predict_proba().

    Task 1 Requirements:
    - Every affected road feature's properties object includes the raw, continuous
      risk_score float (from 0.0 to 1.0) directly from LightGBM's predict_proba().
    - Does NOT filter by a binary threshold—passes the actual continuous probability down to client.
    - Factors in slope, drainage distance (via cKDTree), elevation, and rainfall.

    Returns:
      GeoJSON FeatureCollection dict with continuous risk_score, risk_tier, and hydrological metrics.
    """
    pred = predictor_instance or LightGBMFloodPredictor.get_instance()

    # Locate local_roads.geojson
    path = roads_geojson_path or (settings.base_dir / "data" / "local_roads.geojson")
    if not path.exists():
        alt_path = Path(__file__).resolve().parent.parent / "data" / "local_roads.geojson"
        if alt_path.exists():
            path = alt_path
        else:
            raise FileNotFoundError(f"[predict_flood_extent] local_roads.geojson not found at {path}")

    with open(path, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    features = geojson_data.get("features", [])
    if not features:
        return geojson_data

    # Extract representative midpoint coordinates for each road feature
    coords_list: List[Tuple[float, float]] = []
    for feat in features:
        coords = feat.get("geometry", {}).get("coordinates", [])
        if coords:
            mid = coords[len(coords) // 2]
            coords_list.append((float(mid[1]), float(mid[0])))  # (lat, lon)
        else:
            coords_list.append((HYDERABAD_REF_LAT, HYDERABAD_REF_LON))

    lats = np.array([c[0] for c in coords_list], dtype=np.float64)
    lons = np.array([c[1] for c in coords_list], dtype=np.float64)
    n_roads = len(features)

    # 1. Vectorized cKDTree distance to nearest drainage channels in O(N log M)
    drain_dists = pred.compute_grid_drain_distances(lats, lons)

    # 2. Rainfall features for the given scenario
    rainfall_feats = get_rainfall_scenario_features(rainfall_mm)

    # 3. Assemble (N, 13) feature matrix for LightGBM
    X = np.zeros((n_roads, 13), dtype=np.float32)
    for i in range(n_roads):
        tf = terrain_service.sample_terrain_features(lats[i], lons[i])
        X[i, 0] = tf.get("elevation", 505.0)
        X[i, 1] = tf.get("slope", 2.5)
        X[i, 2] = tf.get("aspect", 180.0)
        X[i, 3] = tf.get("curvature", 0.0)
        X[i, 4] = tf.get("tri", 2.0)
        X[i, 5] = tf.get("twi", 8.5)
        X[i, 6] = tf.get("rel_elev", 0.0)
        X[i, 7] = tf.get("flow_acc_log", 3.0)
        X[i, 8] = drain_dists[i]
        X[i, 9] = rainfall_feats.get("total_rainfall_mm", 0.0)
        X[i, 10] = rainfall_feats.get("max_hourly_mm", 0.0)
        X[i, 11] = rainfall_feats.get("max_cum24h_mm", 0.0)
        X[i, 12] = rainfall_feats.get("max_api", 0.0)

    # 4. Predict raw continuous probabilities via predict_proba()[:, 1]
    probabilities = pred.predict_proba(X)[:, 1]

    # 5. Enrich each feature's properties with continuous risk_score float
    enriched_features = []
    for i, feat in enumerate(features):
        raw_prob = float(probabilities[i])
        risk_score = round(max(0.0, min(1.0, raw_prob)), 4)
        risk_tier = pred.classify_risk_level(risk_score)

        props = dict(feat.get("properties", {}))
        props["risk_score"] = risk_score
        props["risk_tier"] = risk_tier
        props["drain_distance_m"] = round(float(drain_dists[i]), 1)
        props["slope_deg"] = round(float(X[i, 1]), 2)
        props["elevation_m"] = round(float(X[i, 0]), 1)
        props["flood_depth_m"] = round(float(risk_score * 2.2), 2)
        props["is_flooded"] = bool(risk_score >= 0.3)

        if epicenter_lat is not None and epicenter_lon is not None:
            dx = (lons[i] - epicenter_lon) * METERS_PER_DEG_LON
            dy = (lats[i] - epicenter_lat) * METERS_PER_DEG_LAT
            props["dist_to_epicenter_m"] = round(float(math.hypot(dx, dy)), 1)

        enriched_feat = {
            "type": "Feature",
            "id": feat.get("id", f"road_{i}"),
            "properties": props,
            "geometry": feat.get("geometry", {}),
        }
        enriched_features.append(enriched_feat)

    return {
        "type": "FeatureCollection",
        "name": "hyderabad_local_roads_inundation",
        "metadata": {
            "rainfall_mm": rainfall_mm,
            "total_roads": n_roads,
            "high_risk_roads": sum(1 for f in enriched_features if f["properties"]["risk_score"] >= 0.6),
            "critical_roads": sum(1 for f in enriched_features if f["properties"]["risk_score"] >= 0.85),
            "model_version": "lgb_flood_model.txt",
        },
        "features": enriched_features,
    }


# Global singleton instance
predictor = LightGBMFloodPredictor.get_instance()
