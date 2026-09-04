import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from .ml_predictor import predictor, LightGBMFloodPredictor
from .supabase_service import supabase_service, SupabaseService
from .featherless_agent import FeatherlessAgent


class AlertOrchestrator:
    def __init__(self) -> None:
        self.predictor: LightGBMFloodPredictor = predictor
        self.supabase: SupabaseService = supabase_service
        self.llm_agent = FeatherlessAgent()

    def evaluate_hazard(self, features: Dict[str, Any]) -> float:
        """Evaluate raw spatial flood susceptibility score [0.0 - 1.0]."""
        return self.predictor.predict_susceptibility(features)

    def evaluate_compound_hazard(
        self,
        latitude: float,
        longitude: float,
        rainfall_mm: float,
        radius_km: float = 5.0
    ) -> Dict[str, Any]:
        """
        Intersect ML flood susceptibility with critical infrastructure assets.
        Calculates compound hazard index and identifies threatened facilities.
        """
        # Execute 13-feature ML pipeline
        prediction_result = self.predictor.predict_coordinate(
            latitude=latitude,
            longitude=longitude,
            rainfall_mm=rainfall_mm
        )
        susceptibility = prediction_result["susceptibility"]
        hazard_level = prediction_result["risk_level"]

        # Fetch infrastructure within monitoring radius from Supabase
        infrastructure_assets = self.supabase.get_infrastructure_assets(
            center_lat=latitude,
            center_lon=longitude,
            radius_km=radius_km
        )

        # Calculate threatened infrastructure based on REAL model output
        # Assets are only threatened if susceptibility is elevated
        impact_multiplier = 0.0
        threatened_items = []

        if susceptibility >= 0.25:
            for asset in infrastructure_assets:
                dist = max(0.2, asset.get("distance_km", 1.0))
                vuln = asset.get("vulnerability_score", 0.5)
                weight = vuln / (dist ** 0.5)
                impact_multiplier += weight

                # Threatened threshold: high susceptibility or direct proximity
                if susceptibility >= 0.50 or (susceptibility >= 0.25 and dist <= 1.5):
                    threatened_items.append(asset)

        # Compound risk score normalized
        compound_score = round(min(1.0, susceptibility * (1.0 + (impact_multiplier * 0.15))), 4)

        severity = hazard_level
        if compound_score >= 0.75:
            severity = "CRITICAL"
        elif compound_score >= 0.50:
            severity = "HIGH"
        elif compound_score >= 0.25:
            severity = "MODERATE"
        else:
            severity = "LOW"

        return {
            "latitude": latitude,
            "longitude": longitude,
            "rainfall_mm": rainfall_mm,
            "flood_probability": susceptibility,
            "susceptibility": susceptibility,
            "hazard_level": severity,
            "risk_level": severity,
            "compound_risk_score": compound_score,
            "threatened_infrastructure": threatened_items,
            "total_assets_scanned": len(infrastructure_assets),
            "features_used": prediction_result["features_used"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def generate_and_save_alert(
        self,
        latitude: float,
        longitude: float,
        rainfall_mm: float,
        location_name: str = "Monitored Basin",
        radius_km: float = 5.0
    ) -> Dict[str, Any]:
        """
        Full orchestration workflow:
        1. Evaluate compound hazard and infrastructure impact
        2. Call LLM agent for tactical advisory (or structured fallback)
        3. Persist alert and prediction record in Supabase
        4. Return structured alert payload
        """
        hazard_eval = self.evaluate_compound_hazard(
            latitude=latitude,
            longitude=longitude,
            rainfall_mm=rainfall_mm,
            radius_km=radius_km
        )

        susceptibility = hazard_eval["susceptibility"]
        severity = hazard_eval["hazard_level"]
        threatened_infra = hazard_eval["threatened_infrastructure"]

        # Call LLM Agent for tactical advisory
        context = {
            "location_name": location_name,
            "flood_probability": susceptibility,
            "severity": severity,
            "rainfall_mm": rainfall_mm,
            "threatened_infrastructure": threatened_infra,
        }
        advisory_result = self.llm_agent.generate_emergency_advisory(context)

        alert_id = str(uuid.uuid4())
        recommended_actions = advisory_result.get("recommended_actions", [
            "Monitor civil defense and municipal radar feeds.",
            "Avoid underpasses, riverbanks, and low-lying stormwater drains."
        ])

        alert_record = {
            "id": alert_id,
            "severity": severity,
            "location_name": location_name,
            "advisory_title": advisory_result["advisory_title"],
            "advisory_markdown": advisory_result["advisory_markdown"],
            "recommended_actions": recommended_actions,
            "threatened_infrastructure_count": len(threatened_infra),
            "flood_probability": susceptibility,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Persist alert to Supabase
        self.supabase.save_alert(alert_record)

        # Persist prediction record
        self.supabase.save_prediction({
            "latitude": latitude,
            "longitude": longitude,
            "rainfall_mm": rainfall_mm,
            "probability": susceptibility,
            "hazard_level": severity,
            "features": {
                "location_name": location_name,
                "radius_km": radius_km,
                "threatened_count": len(threatened_infra),
                "features_used": hazard_eval["features_used"],
            }
        })

        alert_record["threatened_infrastructure"] = threatened_infra
        return alert_record
