import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from .ml_predictor import LightGBMFloodPredictor
from .supabase_service import supabase_service, SupabaseService
from .featherless_agent import FeatherlessAgent


class AlertOrchestrator:
    def __init__(self) -> None:
        self.predictor = LightGBMFloodPredictor()
        self.supabase: SupabaseService = supabase_service
        self.llm_agent = FeatherlessAgent()

    def evaluate_hazard(self, features: dict) -> float:
        """Evaluate raw spatial flood probability from feature dictionary."""
        return self.predictor.predict_probability(features)

    def evaluate_compound_hazard(
        self,
        latitude: float,
        longitude: float,
        rainfall_mm: float,
        radius_km: float = 5.0
    ) -> Dict[str, Any]:
        """
        Intersect ML flood probability with critical infrastructure vulnerabilities.
        Calculates compound hazard index and lists threatened facilities.
        """
        features = {
            "latitude": latitude,
            "longitude": longitude,
            "rainfall_mm": rainfall_mm,
        }
        prediction_result = self.predictor.predict_detailed(features)
        flood_prob = prediction_result["probability"]
        hazard_level = prediction_result["hazard_level"]

        # Fetch infrastructure within monitoring radius
        infrastructure_assets = self.supabase.get_infrastructure_assets(
            center_lat=latitude,
            center_lon=longitude,
            radius_km=radius_km
        )

        # Compound impact score calculation
        # Weights nearby vulnerable assets more heavily
        impact_multiplier = 0.0
        threatened_items = []
        for asset in infrastructure_assets:
            dist = max(0.2, asset.get("distance_km", 1.0))
            vuln = asset.get("vulnerability_score", 0.5)
            # Inverse distance weighting for vulnerability impact
            weight = vuln / (dist ** 0.5)
            impact_multiplier += weight

            # Assets under direct threat if probability > 0.35 and within 3km
            if flood_prob >= 0.35 or (flood_prob >= 0.20 and dist <= 1.5):
                threatened_items.append(asset)

        # Compound risk score normalized
        compound_score = round(min(1.0, flood_prob * (1.0 + (impact_multiplier * 0.15))), 3)

        # Re-assess severity if compound score escalates risk
        severity = hazard_level
        if compound_score >= 0.80:
            severity = "Critical"
        elif compound_score >= 0.55 and severity in ("Low", "Moderate"):
            severity = "High"

        return {
            "latitude": latitude,
            "longitude": longitude,
            "rainfall_mm": rainfall_mm,
            "flood_probability": flood_prob,
            "hazard_level": severity,
            "compound_risk_score": compound_score,
            "threatened_infrastructure": threatened_items,
            "total_assets_scanned": len(infrastructure_assets),
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
        2. Call Featherless AI to generate human-readable tactical advisory
        3. Save alert and prediction into Supabase
        4. Return structured response
        """
        hazard_eval = self.evaluate_compound_hazard(
            latitude=latitude,
            longitude=longitude,
            rainfall_mm=rainfall_mm,
            radius_km=radius_km
        )

        flood_prob = hazard_eval["flood_probability"]
        severity = hazard_eval["hazard_level"]
        threatened_infra = hazard_eval["threatened_infrastructure"]

        # Call LLM Agent
        context = {
            "location_name": location_name,
            "flood_probability": flood_prob,
            "severity": severity,
            "rainfall_mm": rainfall_mm,
            "threatened_infrastructure": threatened_infra,
        }
        advisory_result = self.llm_agent.generate_emergency_advisory(context)

        alert_id = str(uuid.uuid4())
        recommended_actions = advisory_result.get("recommended_actions", [
            "Monitor civil defense channels.",
            "Avoid low-lying roadways and drainage basins."
        ])

        alert_record = {
            "id": alert_id,
            "severity": severity,
            "location_name": location_name,
            "advisory_title": advisory_result["advisory_title"],
            "advisory_markdown": advisory_result["advisory_markdown"],
            "recommended_actions": recommended_actions,
            "threatened_infrastructure_count": len(threatened_infra),
            "flood_probability": flood_prob,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Persist alert to Supabase
        self.supabase.save_alert(alert_record)

        # Also persist prediction record
        self.supabase.save_prediction({
            "latitude": latitude,
            "longitude": longitude,
            "rainfall_mm": rainfall_mm,
            "probability": flood_prob,
            "hazard_level": severity,
            "features": {
                "location_name": location_name,
                "radius_km": radius_km,
                "threatened_count": len(threatened_infra)
            }
        })

        alert_record["threatened_infrastructure"] = threatened_infra
        return alert_record
