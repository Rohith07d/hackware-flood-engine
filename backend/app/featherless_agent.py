import json
from typing import Any, Dict, List, Optional
from openai import OpenAI
from datetime import datetime, timezone

from .config import settings
from .tools import resolve_area, get_terrain_features, get_live_rainfall, run_flood_model
from .supabase_service import supabase_service

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
                print(f"[FeatherlessAgent] Client init error: {exc}.")
                self.client = None
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        return self.client is not None and bool(settings.featherless_api_key)

    def analyze_area(self, location: str) -> Dict[str, Any]:
        """
        Orchestrate the area analysis using Featherless tool-capable model.
        """
        if not self.is_configured or not self.client:
            raise Exception("Featherless API is not configured. Please provide FEATHERLESS_API_KEY.")

        # Hardcoded tool calling sequence for robustness (we guide the model, or we just execute the python functions directly and pass to model for summary)
        # The prompt requires: "The AI should be able to request the appropriate tools and use their returned data... 
        # Featherless must NOT invent the numerical flood susceptibility score. The LightGBM model remains the authoritative numerical prediction engine."
        
        print(f"[FeatherlessAgent] Starting analysis for {location}")
        
        # 1. Resolve area
        loc_data = resolve_area(location)
        if loc_data["status"] != "success":
            raise Exception(f"Failed to resolve location: {location}")
        
        lat = loc_data["latitude"]
        lon = loc_data["longitude"]
        address = loc_data["address"]
        
        # 2. Get Terrain
        terrain_res = get_terrain_features(lat, lon)
        if terrain_res["status"] != "success":
            raise Exception(f"Failed to get terrain features: {terrain_res.get('message')}")
        terrain_feats = terrain_res["features"]
        
        # 3. Get Rainfall
        rain_res = get_live_rainfall(lat, lon)
        if rain_res["status"] != "success":
            raise Exception(f"Failed to get rainfall features: {rain_res.get('message')}")
        rain_feats = rain_res["features"]
        
        # 4. Run LightGBM
        pred_res = run_flood_model(terrain_feats, rain_feats)
        if pred_res["status"] != "success":
            raise Exception(f"Failed to run LightGBM model: {pred_res.get('message')}")
        
        prediction = pred_res["prediction"]
        susceptibility = prediction["susceptibility"]
        risk_level = prediction["risk_level"]
        features_used = prediction["features_used"]
        
        # 5. Summarize with Featherless
        system_prompt = (
            "You are an Emergency Disaster Management AI for the HackWave Flood Engine. "
            "You are given real data about a location, its terrain and rainfall features, and the output of our LightGBM model. "
            "Generate a concise, authoritative emergency advisory. "
            "Include an explanation of the major contributing features. "
            "Format in clean GitHub Markdown."
        )
        
        user_content = (
            f"Location: {address}\n"
            f"Coordinates: {lat}, {lon}\n"
            f"Model Susceptibility Score: {susceptibility} (Scale 0-1)\n"
            f"Risk Level: {risk_level}\n"
            f"Terrain Features:\n{json.dumps(terrain_feats, indent=2)}\n"
            f"Rainfall Features:\n{json.dumps(rain_feats, indent=2)}\n"
        )
        
        try:
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
        except Exception as exc:
            print(f"[FeatherlessAgent] AI explanation generation failed: {exc}")
            markdown_content = "Failed to generate AI explanation."
            
        # 6. Save to Supabase
        # We assume supabase_service has a method to save.
        try:
            record = {
                "location": address,
                "latitude": lat,
                "longitude": lon,
                "susceptibility_score": susceptibility,
                "risk_level": risk_level,
                "terrain_features": terrain_feats,
                "rainfall_features": rain_feats,
                "ai_explanation": markdown_content,
                "model_version": "lgb_flood_model.txt",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            supabase_service.save_prediction(record)
        except Exception as e:
            print(f"[FeatherlessAgent] Error saving to Supabase: {e}")

        return {
            "location": address,
            "latitude": lat,
            "longitude": lon,
            "susceptibility_score": susceptibility,
            "risk_level": risk_level,
            "features_used": features_used,
            "ai_explanation": markdown_content,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_version": "lgb_flood_model.txt"
        }
