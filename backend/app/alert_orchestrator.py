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

        flood_prob = susceptibility

        # Compound impact score calculation (P7 & P8)
        # Weights nearby vulnerable assets more heavily
        total_weight = 0.0
        threatened_items = []
        for asset in infrastructure_assets:
            dist = max(0.4, asset.get("distance_km", 1.0))
            vuln = asset.get("vulnerability_score", 0.5)
            # Inverse distance weighting for vulnerability impact
            weight = vuln / (dist ** 0.5)
            total_weight += weight

            # Distance-aware threat rule: closer assets are threatened at lower probabilities,
            # while assets further away require higher flood probabilities
            threat_threshold = 0.35 * (dist / 1.5)
            if flood_prob >= threat_threshold:
                threatened_items.append(asset)

        # Bound impact strictly in [0, 1) and blend with flood probability (P7)
        impact = total_weight / (1.0 + total_weight) if total_weight > 0 else 0.0
        compound_score = round(min(1.0, 0.7 * flood_prob + 0.3 * impact), 3)

        # Re-assess severity if compound score escalates risk (P7)
        severity = hazard_level
        if compound_score >= 0.80:
            severity = "CRITICAL"
        elif compound_score >= 0.55 and severity in ("LOW", "MODERATE", "Low", "Moderate"):
            severity = "HIGH"

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
