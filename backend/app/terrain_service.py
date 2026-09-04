import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
NPZ_PATH = DATA_DIR / "terrain_features.npz"
META_PATH = DATA_DIR / "hyd_dem_metadata.json"

# Hyderabad Downsampled Grid Spatial Bounds (EPSG:4326)
LEFT = 77.99986111111112
BOTTOM = 16.99930555555556
RIGHT = 79.00069444444445
TOP = 18.00013888888889
GRID_HEIGHT = 1201
GRID_WIDTH = 1201
PIXEL_WIDTH = (RIGHT - LEFT) / GRID_WIDTH
PIXEL_HEIGHT = (TOP - BOTTOM) / GRID_HEIGHT


class TerrainService:
    _instance: Optional["TerrainService"] = None

    def __init__(self) -> None:
        self.terrain_data: Dict[str, np.ndarray] = {}
        self.is_loaded: bool = False
        self._load_cache()

    @classmethod
    def get_instance(cls) -> "TerrainService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_cache(self) -> None:
        """Load precomputed 9 terrain feature rasters once into memory."""
        if not NPZ_PATH.exists():
            print(f"[TerrainService] Warning: {NPZ_PATH} not found.")
            return

        try:
            print(f"[TerrainService] Loading precomputed terrain feature grid from {NPZ_PATH}...")
            npz = np.load(NPZ_PATH)
            for k in [
                "elevation", "slope", "aspect", "curvature",
                "tri", "twi", "rel_elev", "flow_acc_log", "dist_to_stream"
            ]:
                if k in npz:
                    self.terrain_data[k] = npz[k]
            self.is_loaded = True
            print(f"[TerrainService] Successfully loaded 9 terrain feature rasters ({GRID_HEIGHT}x{GRID_WIDTH}).")
        except Exception as exc:
            print(f"[TerrainService] Error loading NPZ: {exc}")

    def coordinate_to_pixel(self, latitude: float, longitude: float) -> Tuple[int, int]:
        """Map latitude and longitude to grid row and column."""
        col = int((longitude - LEFT) / PIXEL_WIDTH)
        row = int((TOP - latitude) / PIXEL_HEIGHT)
        col = max(0, min(GRID_WIDTH - 1, col))
        row = max(0, min(GRID_HEIGHT - 1, row))
        return row, col

    def sample_terrain_features(self, latitude: float, longitude: float) -> Dict[str, float]:
        """
        Sample the exact 9 physical terrain features at given coordinates.
        O(1) execution without raster recalculations.
        """
        if not self.is_loaded:
            self._load_cache()

        row, col = self.coordinate_to_pixel(latitude, longitude)

        # Fallback values if dataset not loaded
        if not self.is_loaded:
            return {
                "elevation": 505.0,
                "slope": 2.5,
                "aspect": 180.0,
                "curvature": 0.0,
                "tri": 2.0,
                "twi": 8.5,
                "rel_elev": 0.0,
                "flow_acc_log": 3.0,
                "dist_to_stream": 500.0,
            }

        return {
            "elevation": round(float(self.terrain_data["elevation"][row, col]), 2),
            "slope": round(float(self.terrain_data["slope"][row, col]), 4),
            "aspect": round(float(self.terrain_data["aspect"][row, col]), 2),
            "curvature": round(float(self.terrain_data["curvature"][row, col]), 6),
            "tri": round(float(self.terrain_data["tri"][row, col]), 4),
            "twi": round(float(self.terrain_data["twi"][row, col]), 4),
            "rel_elev": round(float(self.terrain_data["rel_elev"][row, col]), 2),
            "flow_acc_log": round(float(self.terrain_data["flow_acc_log"][row, col]), 4),
            "dist_to_stream": round(float(self.terrain_data["dist_to_stream"][row, col]), 2),
        }

    def get_grid_metadata(self) -> Dict[str, Any]:
        """Return geographic extent and resolution metadata."""
        return {
            "crs": "EPSG:4326",
            "bounds": {
                "left": LEFT,
                "bottom": BOTTOM,
                "right": RIGHT,
                "top": TOP,
            },
            "leaflet_bounds": [
                [BOTTOM, LEFT],
                [TOP, RIGHT],
            ],
            "shape": [GRID_HEIGHT, GRID_WIDTH],
            "is_precomputed_cached": self.is_loaded,
        }


terrain_service = TerrainService.get_instance()
