import json
from typing import Any, Dict, List, Optional
from openai import OpenAI

from .config import settings


class FeatherlessAgent:
    def __init__(self) -> None:
        self.client: Optional[OpenAI] = None
        self._init_client()

    def _init_client(self) -> None:
        if settings.featherless_api_key:
            try:
                self.client = OpenAI(
                    api_key=settings.featherless_api_key,
                    base_url=settings.featherless_base_url,
                )
            except Exception as exc:
                print(f"[FeatherlessAgent] Client init error: {exc}. Using fallback generator.")
                self.client = None
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        return self.client is not None and bool(settings.featherless_api_key)

    def generate_emergency_advisory(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a tactical, human-readable flood advisory based on compound hazard evaluation.
        Uses Featherless AI if configured, otherwise produces a calibrated deterministic template.
        """
        location = context.get("location_name", "Target Region")
        probability = context.get("flood_probability", 0.0)
        severity = context.get("severity", "Moderate")
        threatened_infra = context.get("threatened_infrastructure", [])
        rainfall_mm = context.get("rainfall_mm", 0.0)

        infra_summary = ", ".join([f"{item['name']} ({item['type']})" for item in threatened_infra[:4]])
        if not infra_summary:
            infra_summary = "General residential and surface transit routes"

        if self.is_configured and self.client:
            try:
                system_prompt = (
                    "You are an Emergency Disaster Management AI for the HackWave Flood Engine. "
                    "Generate a concise, authoritative emergency advisory. "
                    "Include: 1) Executive Situation Summary, 2) Critical Infrastructure Threats, 3) Actionable Directives for Citizens and Responders. "
                    "Format in clean GitHub Markdown."
                )
                user_content = (
                    f"Location: {location}\n"
                    f"Precipitation: {rainfall_mm} mm\n"
                    f"Flood Probability: {round(probability * 100, 1)}%\n"
                    f"Severity Level: {severity}\n"
                    f"Threatened Critical Infrastructure: {infra_summary}\n"
                )

                response = self.client.chat.completions.create(
                    model=settings.featherless_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    max_tokens=450,
                    temperature=0.3,
                )
                markdown_content = response.choices[0].message.content.strip()
                return {
                    "advisory_title": f"FLOOD {severity.upper()} ADVISORY: {location}",
                    "advisory_markdown": markdown_content,
                    "model_used": settings.featherless_model,
                    "source": "featherless-ai"
                }
            except Exception as exc:
                print(f"[FeatherlessAgent] API generation error: {exc}. Switching to local tactical fallback.")

        # Resilient Local Generator Fallback
        return self._generate_fallback_advisory(
            location=location,
            probability=probability,
            severity=severity,
            rainfall_mm=rainfall_mm,
            threatened_infra=threatened_infra,
            infra_summary=infra_summary
        )

    def _generate_fallback_advisory(
        self,
        location: str,
        probability: float,
        severity: str,
        rainfall_mm: float,
        threatened_infra: List[Dict[str, Any]],
        infra_summary: str
    ) -> Dict[str, Any]:
        """High-grade calibrated emergency advisory fallback template."""
        pct = round(probability * 100, 1)

        actions = [
            "Activate Municipal Emergency Operations Center (EOC) monitoring.",
            "Deploy emergency drainage pumps and sandbag perimeters around critical utilities.",
            "Clear low-lying road intersections and monitor underpass water levels.",
            "Issue civilian push notifications advising avoidance of flooded transit corridors."
        ]

        if severity in ("High", "Critical"):
            actions.insert(0, "Initiate phased precautionary evacuation for residents within 500m of drainage channels.")
            actions.insert(1, "Pre-position emergency rescue teams and medical transport near designated shelter hubs.")

        actions_formatted = "\n".join([f"- {act}" for act in actions])

        markdown_advisory = f"""### ⚠️ FLOOD EMERGENCY ADVISORY: {location.upper()}

**Threat Level**: `{severity.upper()}` | **Flood Inundation Probability**: `{pct}%` | **Rainfall**: `{rainfall_mm} mm`

#### 1. Situation Analysis
Hydrological sensors and spatial LightGBM analysis indicate an imminent hazard in **{location}**. Saturated ground and heavy precipitation create elevated risks of stormwater surcharge, flash runoff, and structural backwater.

#### 2. Critical Infrastructure Under Assessment
The following key facilities within the monitoring radius are vulnerable to water ingress:
- **Identified Nodes**: {infra_summary}
- **Vulnerability Impact**: Heightened risk of access disruption, power grid isolation, and service interruption.

#### 3. Immediate Recommended Protocols
{actions_formatted}

*Generated automatically by HackWave Hybrid AI Flood Engine.*
"""
        return {
            "advisory_title": f"FLOOD {severity.upper()} ADVISORY: {location}",
            "advisory_markdown": markdown_advisory.strip(),
            "recommended_actions": actions,
            "model_used": "rule-based-tactical-engine (fallback)",
            "source": "local-fallback"
        }
