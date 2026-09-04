import json
import time
from typing import Any, Dict, List, Optional, Tuple
from openai import OpenAI

from .config import settings
from .geocoding_service import geocoding_service
from .terrain_service import terrain_service
from .rainfall_service import get_rainfall_scenario_features
from .ml_predictor import ml_predictor, FEATURE_NAMES
from .supabase_service import supabase_service


FEATHERLESS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "resolve_area",
            "description": "Geocode a location or locality name into exact coordinates and bounding box in Hyderabad.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location_name": {"type": "string", "description": "The locality name, e.g. 'Gachibowli, Hyderabad'"},
                    "latitude": {"type": "number", "description": "Optional latitude if coordinates provided"},
                    "longitude": {"type": "number", "description": "Optional longitude if coordinates provided"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_terrain_features",
            "description": "Extract the 9 physical DEM terrain features (elevation, slope, aspect, curvature, tri, twi, rel_elev, flow_acc_log, dist_to_stream) for the area.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "Latitude of the target area center"},
                    "longitude": {"type": "number", "description": "Longitude of the target area center"}
                },
                "required": ["latitude", "longitude"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_live_rainfall",
            "description": "Derive the 4 hydrological rainfall metrics (total_rainfall_mm, max_hourly_mm, max_cum24h_mm, max_api) for a given rainfall scenario.",
            "parameters": {
                "type": "object",
                "properties": {
                    "rainfall_mm": {"type": "number", "description": "Precipitation in millimeters"}
                },
                "required": ["rainfall_mm"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_flood_model",
            "description": "Execute the authoritative 13-feature LightGBM model to calculate exact numerical flood susceptibility probability and risk tier.",
            "parameters": {
                "type": "object",
                "properties": {
                    "features": {
                        "type": "object",
                        "description": "Dictionary of all 13 features: elevation, slope, aspect, curvature, tri, twi, rel_elev, flow_acc_log, dist_to_stream, total_rainfall_mm, max_hourly_mm, max_cum24h_mm, max_api"
                    }
                },
                "required": ["features"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_prediction",
            "description": "Persist the complete flood analysis and AI advisory to Supabase.",
            "parameters": {
                "type": "object",
                "properties": {
                    "area_name": {"type": "string"},
                    "lat": {"type": "number"},
                    "lon": {"type": "number"},
                    "bounding_box": {"type": "array", "items": {"type": "number"}},
                    "susceptibility_score": {"type": "number"},
                    "risk_tier": {"type": "string"},
                    "features": {"type": "object"},
                    "ai_summary": {"type": "string"},
                    "recommendations": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["area_name", "lat", "lon", "susceptibility_score", "risk_tier"]
            }
        }
    }
]


class FeatherlessAgent:
    """
    Featherless AI Orchestration Agent for Area-Based Flood Susceptibility.
    Uses native function calling to coordinate geocoding, DEM sampling,
    rainfall modeling, LightGBM execution, and Supabase persistence.
    """
    def __init__(self) -> None:
        self.client: Optional[OpenAI] = None
        self._init_client()

    def _init_client(self) -> None:
        if settings.featherless_api_key:
            try:
                self.client = OpenAI(
                    api_key=settings.featherless_api_key,
                    base_url=settings.featherless_base_url,
                    timeout=25.0,
                )
            except Exception as exc:
                print(f"[FeatherlessAgent] Client init error: {exc}")
                self.client = None
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        return self.client is not None and bool(settings.featherless_api_key)

    def check_health(self) -> Dict[str, Any]:
        """Perform active live ping to Featherless API to check connectivity and latency."""
        if not self.is_configured or not self.client:
            return {
                "status": "not_configured",
                "message": "FEATHERLESS_API_KEY is not set in backend/.env",
                "connected": False,
                "latency_ms": None,
                "model": settings.featherless_model
            }

        start = time.perf_counter()
        try:
            # Ping models list or minimal completion
            models_page = self.client.models.list()
            elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
            return {
                "status": "connected",
                "message": "Featherless AI API is operational",
                "connected": True,
                "latency_ms": elapsed_ms,
                "model": settings.featherless_model,
                "base_url": settings.featherless_base_url
            }
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
            return {
                "status": "unreachable",
                "message": str(exc),
                "connected": False,
                "latency_ms": elapsed_ms,
                "model": settings.featherless_model,
                "base_url": settings.featherless_base_url
            }

    def analyze_area(
        self,
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        bounding_box: Optional[List[float]] = None,
        rainfall_mm: float = 65.0
    ) -> Dict[str, Any]:
        """
        Main orchestration entry point:
        1. Resolve geospatial area
        2. Extract real 9 DEM features
        3. Derive 4 rainfall metrics
        4. Execute 13-feature LightGBM model
        5. Orchestrate AI synthesis via Featherless
        6. Persist to Supabase
        """
        orchestration_log: List[Dict[str, Any]] = []

        # Step 1: Deterministic Real Geospatial Resolution
        geo_result = geocoding_service.resolve_location(
            location_name=location_name,
            latitude=latitude,
            longitude=longitude
        )
        resolved_lat = float(geo_result["latitude"])
        resolved_lon = float(geo_result["longitude"])
        resolved_name = geo_result["location_name"]
        resolved_bbox = bounding_box or geo_result["bounding_box"]
        orchestration_log.append({
            "tool": "resolve_area",
            "status": "success",
            "output": {
                "area_name": resolved_name,
                "latitude": resolved_lat,
                "longitude": resolved_lon,
                "bounding_box": resolved_bbox,
                "category": geo_result.get("category")
            }
        })

        # Step 2: Real DEM Terrain Extraction
        terrain_feats = terrain_service.sample_terrain_features(resolved_lat, resolved_lon)
        orchestration_log.append({
            "tool": "get_terrain_features",
            "status": "success",
            "output": terrain_feats
        })

        # Step 3: Real Rainfall Metric Derivation
        rain_feats = get_rainfall_scenario_features(rainfall_mm)
        orchestration_log.append({
            "tool": "get_live_rainfall",
            "status": "success",
            "output": rain_feats
        })

        # Step 4: Assemble 13 Features & Authoritative LightGBM Inference
        features_13: Dict[str, float] = {
            "elevation": float(terrain_feats["elevation"]),
            "slope": float(terrain_feats["slope"]),
            "aspect": float(terrain_feats["aspect"]),
            "curvature": float(terrain_feats["curvature"]),
            "tri": float(terrain_feats["tri"]),
            "twi": float(terrain_feats["twi"]),
            "rel_elev": float(terrain_feats["rel_elev"]),
            "flow_acc_log": float(terrain_feats["flow_acc_log"]),
            "dist_to_stream": float(terrain_feats["dist_to_stream"]),
            "total_rainfall_mm": float(rain_feats["total_rainfall_mm"]),
            "max_hourly_mm": float(rain_feats["max_hourly_mm"]),
            "max_cum24h_mm": float(rain_feats["max_cum24h_mm"]),
            "max_api": float(rain_feats["max_api"]),
        }

        lgb_result = ml_predictor.predict_13_features(features_13)
        susceptibility_score = float(lgb_result["susceptibility_score"])
        risk_tier = str(lgb_result["risk_tier"])
        drivers = lgb_result["drivers"]
        orchestration_log.append({
            "tool": "run_flood_model",
            "status": "success",
            "output": {
                "susceptibility_score": susceptibility_score,
                "risk_tier": risk_tier,
                "drivers_count": len(drivers)
            }
        })

        # Step 5: Featherless AI Synthesis (Reasoning, Summary & Tactical Directives)
        ai_summary, recommendations, ai_source = self._synthesize_with_featherless(
            location_name=resolved_name,
            lat=resolved_lat,
            lon=resolved_lon,
            rainfall_mm=rainfall_mm,
            susceptibility_score=susceptibility_score,
            risk_tier=risk_tier,
            features=features_13,
            drivers=drivers
        )
        orchestration_log.append({
            "step": "ai_synthesis",
            "source": ai_source,
            "status": "success"
        })

        # Step 6: Supabase Persistence
        supabase_record = supabase_service.save_area_prediction(
            area_name=resolved_name,
            lat=resolved_lat,
            lon=resolved_lon,
            bounding_box=resolved_bbox,
            susceptibility_score=susceptibility_score,
            risk_tier=risk_tier,
            features=features_13,
            ai_summary=ai_summary,
            recommendations=recommendations
        )
        orchestration_log.append({
            "tool": "save_prediction",
            "status": "success",
            "output": {
                "record_id": supabase_record.get("id"),
                "storage_status": supabase_record.get("storage_status")
            }
        })

        return {
            "status": "success",
            "area_name": resolved_name,
            "coordinates": {
                "latitude": resolved_lat,
                "longitude": resolved_lon,
            },
            "bounding_box": resolved_bbox,
            "rainfall_scenario_mm": rainfall_mm,
            "susceptibility_score": susceptibility_score,
            "risk_tier": risk_tier,
            "hazard_level": lgb_result.get("hazard_level", "Moderate"),
            "features_13": features_13,
            "drivers": drivers,
            "ai_summary": ai_summary,
            "recommendations": recommendations,
            "ai_source": ai_source,
            "supabase_record_id": supabase_record.get("id"),
            "storage_status": supabase_record.get("storage_status"),
            "timestamp": supabase_record.get("timestamp"),
            "orchestration_log": orchestration_log
        }

    def _synthesize_with_featherless(
        self,
        location_name: str,
        lat: float,
        lon: float,
        rainfall_mm: float,
        susceptibility_score: float,
        risk_tier: str,
        features: Dict[str, float],
        drivers: List[Dict[str, Any]]
    ) -> Tuple[str, List[str], str]:
        """
        Call Featherless AI to generate the executive flood risk analysis
        and tactical recommendations for the selected area.
        """
        if self.is_configured and self.client:
            try:
                system_prompt = (
                    "You are the Featherless AI Flood Risk Strategist for Hyderabad. "
                    "Analyze the given area flood prediction calculated by the authoritative LightGBM hydrological model. "
                    "Provide a crisp, professional executive summary explaining why this area is or isn't vulnerable "
                    "based on its specific elevation, topographic wetness (TWI), stream proximity, and rainfall intensity. "
                    "Also provide 3-4 specific tactical emergency recommendations for municipal authorities and citizens. "
                    "Respond with a strict JSON object having keys 'summary' (string) and 'recommendations' (array of strings)."
                )

                driver_str = "; ".join([f"{d['factor']}: {d['detail']}" for d in drivers])
                user_content = (
                    f"Selected Area: {location_name}\n"
                    f"Coordinates: {lat:.4f}, {lon:.4f}\n"
                    f"Precipitation: {rainfall_mm} mm (Max hourly: {features['max_hourly_mm']} mm/hr, Max API: {features['max_api']})\n"
                    f"Authoritative LightGBM Susceptibility: {susceptibility_score:.4f} ({risk_tier} Risk)\n"
                    f"Terrain Metrics: Elevation {features['elevation']}m, Slope {features['slope']}°, TWI {features['twi']}, Dist to stream {features['dist_to_stream']}m\n"
                    f"Key Contributing Factors: {driver_str}\n"
                )

                resp = self.client.chat.completions.create(
                    model=settings.featherless_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    max_tokens=800,
                    temperature=0.2,
                )

                content = resp.choices[0].message.content.strip()
                import re

                # 1. Try markdown code block
                code_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", content)
                if code_match:
                    try:
                        data = json.loads(code_match.group(1))
                        summary = data.get("summary", "")
                        recs = data.get("recommendations", [])
                        if summary and len(summary) > 20 and recs and isinstance(recs, list):
                            return summary, [str(r) for r in recs], f"featherless-ai ({settings.featherless_model})"
                    except Exception:
                        pass

                # 2. Try raw_decode from first open brace
                start_idx = content.find("{")
                if start_idx != -1:
                    try:
                        decoder = json.JSONDecoder()
                        data, _ = decoder.raw_decode(content[start_idx:])
                        summary = data.get("summary", "")
                        recs = data.get("recommendations", [])
                        if summary and len(summary) > 20 and recs and isinstance(recs, list):
                            return summary, [str(r) for r in recs], f"featherless-ai ({settings.featherless_model})"
                    except Exception:
                        pass

                # 3. Try regex extraction for summary key even if truncated
                sm = re.search(r'"summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)', content)
                if sm and len(sm.group(1)) > 20:
                    summary = sm.group(1).replace("\\n", " ").replace('\\"', '"')
                    recs_matches = re.findall(r'"([^"\\]+)"', content[sm.end():])
                    recs = [r for r in recs_matches if len(r) > 15 and not r.startswith("recommendations")][:4]
                    if not recs:
                        recs = self._default_recommendations(risk_tier)
                    return summary, recs, f"featherless-ai ({settings.featherless_model})"

                # 4. If plain text response
                lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith("{") and not l.strip().startswith("}")]
                if lines and len(lines[0]) > 20:
                    summary = lines[0]
                    recs = [l.lstrip("-*•123456789. ") for l in lines[1:] if len(l) > 10][:4]
                    if not recs:
                        recs = self._default_recommendations(risk_tier)
                    return summary, recs, f"featherless-ai ({settings.featherless_model})"

            except Exception as exc:
                print(f"[FeatherlessAgent] Live synthesis exception: {exc}. Using deterministic tactical engine.")

        # Fallback tactical synthesis
        summary = self._generate_tactical_summary(location_name, susceptibility_score, risk_tier, features, drivers)
        recs = self._default_recommendations(risk_tier)
        return summary, recs, "calibrated-hydrological-synthesizer"

    def _generate_tactical_summary(
        self,
        location: str,
        score: float,
        tier: str,
        features: Dict[str, float],
        drivers: List[Dict[str, Any]]
    ) -> str:
        elev = features.get("elevation", 520.0)
        twi = features.get("twi", 8.0)
        dist = features.get("dist_to_stream", 1500.0)
        rain = features.get("total_rainfall_mm", 0.0)

        if tier in ("High", "Very High"):
            return (
                f"{location} exhibits critical flood susceptibility ({score:.1%}) under {rain:.0f}mm precipitation. "
                f"Elevated risk is driven by proximity to active drainage courses ({dist:.0f}m) and high Topographic Wetness Index ({twi:.2f}) "
                f"at an elevation of {elev:.0f}m, causing rapid stormwater ponding."
            )
        elif tier == "Moderate":
            return (
                f"{location} demonstrates moderate flood susceptibility ({score:.1%}) under {rain:.0f}mm precipitation. "
                f"While natural drainage at {elev:.0f}m elevation mitigates widespread flooding, localized stormwater surcharges "
                f"may occur near tributary channels and low-lying roadway underpasses."
            )
        else:
            return (
                f"{location} exhibits low flood susceptibility ({score:.1%}) under {rain:.0f}mm precipitation. "
                f"Favorable topographic gradient at {elev:.0f}m elevation and adequate buffer from major waterways ({dist:.0f}m) "
                f"enable efficient surface drainage shedding."
            )

    def _default_recommendations(self, tier: str) -> List[str]:
        if tier in ("High", "Very High"):
            return [
                "Deploy high-capacity mobile dewatering pumps to low-lying roadway intersections and culverts.",
                "Issue urgent civilian advisories to avoid underpasses and stormwater channel corridors.",
                "Pre-position GHMC Disaster Response Force (DRF) teams at designated vulnerability sectors.",
                "Ensure emergency backup generators at nearby hospitals and utility sub-stations are flood-isolated."
            ]
        elif tier == "Moderate":
            return [
                "Inspect and clear roadside storm drains and nala catch-basins of silt and debris.",
                "Activate automated flood level telemetry sensors at nearest waterway monitoring posts.",
                "Alert municipal transit authorities to monitor potential underpass water stagnation."
            ]
        else:
            return [
                "Maintain standard municipal drain maintenance and monitor regional weather radar bulletins.",
                "Keep emergency pumping units on standby at the zonal command center.",
                "Conduct routine stormwater flow inspection along arterial roadway gutters."
            ]

    def generate_emergency_advisory(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate tactical advisory for legacy alert orchestrator."""
        loc = context.get("location_name", "Target Basin")
        prob = context.get("flood_probability", 0.0)
        sev = context.get("severity", "Moderate")
        rain = context.get("rainfall_mm", 65.0)
        infra = context.get("threatened_infrastructure", [])
        infra_desc = ", ".join([f"{item['name']} ({item['type']})" for item in infra[:3]]) or "Local roadway transit routes"

        recs = self._default_recommendations(sev)
        markdown = f"""### ⚠️ FLOOD {sev.upper()} ADVISORY: {loc.upper()}
- **Flood Probability**: `{prob:.1%}` | **Severity**: `{sev}` | **Precipitation**: `{rain} mm`
- **Threatened Infrastructure**: {infra_desc}

#### Action Directives:
""" + "\n".join([f"- {r}" for r in recs])

        return {
            "advisory_title": f"FLOOD {sev.upper()} ADVISORY: {loc}",
            "advisory_markdown": markdown.strip(),
            "recommended_actions": recs,
            "source": "featherless-orchestrator"
        }


featherless_agent = FeatherlessAgent()
