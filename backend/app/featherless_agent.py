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

    def analyze_area(self, location: str, language: str = "en") -> Dict[str, Any]:
        """
        Orchestrate the area analysis using Featherless tool-capable model with multilingual support.
        """
        print(f"[FeatherlessAgent] Starting analysis for {location} (language={language})")
        
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
        
        # 5. Multilingual Summarize with Featherless (or graceful deterministic fallback)
        elev = terrain_feats.get("elevation", 0)
        slope = terrain_feats.get("slope", 0)
        precip = rain_feats.get("total_rainfall_mm", 0)
        
        if language == "te":
            markdown_content = (
                f"### వ్యూహాత్మక వరద హెచ్చరిక: {address}\n\n"
                f"**ముంపు ప్రమాద స్థాయి**: `{risk_level}` (స్కోరు: {susceptibility:.2f})\n\n"
                f"- **భౌగోళిక ఎత్తు**: {elev:.1f} మీటర్లు, వాలు: {slope:.1f}°.\n"
                f"- **ఊహించిన వర్షపాతం**: {precip:.1f} మి.మీ.\n\n"
                f"LightGBM మోడల్ విశ్లేషణ ప్రకారం ఈ ప్రాంతంలో ప్రస్తుత నీటి ప్రవాహం దృష్ట్యా {risk_level} స్థాయి ముప్పు ఉంది. "
                f"లోతట్టు ప్రాంతాలు మరియు మూసీ కాలువల సమీప ప్రజలు జాగ్రత్తగా ఉండాలి."
            )
        elif language == "hi":
            markdown_content = (
                f"### सामरिक बाढ़ चेतावनी: {address}\n\n"
                f"**बाढ़ जोखिम स्तर**: `{risk_level}` (स्कोर: {susceptibility:.2f})\n\n"
                f"- **भूभाग ऊंचाई**: {elev:.1f} मीटर, ढलान: {slope:.1f}°.\n"
                f"- **अनुमानित वर्षा**: {precip:.1f} मिमी.\n\n"
                f"LightGBM मॉडल मूल्यांकन के अनुसार मौजूदा जलजमाव को देखते हुए {risk_level} स्तर का जोखिम है। "
                f"निचले इलाकों और मुख्य जल निकासी चैनलों के पास सतर्कता बरतें।"
            )
        else:
            markdown_content = (
                f"### Tactical Flood Advisory: {address}\n\n"
                f"**Inundation Risk Level**: `{risk_level}` (Spatial Score: {susceptibility:.2f})\n\n"
                f"- **Topography**: Elevation {elev:.1f} m, Slope {slope:.1f}°.\n"
                f"- **Hydrology**: Projected Precipitation {precip:.1f} mm.\n\n"
                f"Automated LightGBM spatial probability model evaluation indicates {risk_level.lower()} "
                f"vulnerability under current saturation dynamics. Civil defense and local residents should "
                f"monitor low-lying stormwater channels and transit corridors."
            )
        
        if self.is_configured and self.client:
            lang_instruction = "Respond entirely in English."
            if language == "te":
                lang_instruction = "Respond entirely in Telugu (తెలుగు). Use clear, authentic Telugu terminology."
            elif language == "hi":
                lang_instruction = "Respond entirely in Hindi (हिन्दी). Use clear, authoritative Hindi disaster terminology."

            system_prompt = (
                "You are an Emergency Disaster Management AI for the HackWave Flood Engine. "
                "You are given real data about a location, its terrain and rainfall features, and the output of our LightGBM model. "
                "Generate a concise, authoritative emergency advisory. "
                "Include an explanation of the major contributing features. "
                f"{lang_instruction} "
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
                if response.choices and response.choices[0].message.content:
                    markdown_content = response.choices[0].message.content.strip()
            except Exception as exc:
                print(f"[FeatherlessAgent] AI explanation generation failed: {exc}. Using deterministic summary.")
            
        # 6. Save to Supabase
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
                "model_version": settings.model_version,
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
            "model_version": settings.model_version,
        }

    def generate_emergency_advisory(self, context: Dict[str, Any], language: str = "en") -> Dict[str, Any]:
        """Generate a tactical emergency advisory from context with multilingual support."""
        loc_name = context.get("location_name", "Unknown Area")
        prob = context.get("flood_probability", 0.5)
        sev = context.get("severity", "MODERATE")

        # Deterministic multilingual defaults
        if language == "te":
            fallback = {
                "advisory_title": f"వరద ముందస్తు హెచ్చరిక: {loc_name}",
                "advisory_markdown": f"స్వయంచాలక నివేదిక. ముంపు సంభావ్యత: {(prob * 100):.1f}%. తీవ్రత: {sev}. లోతట్టు నాలా మార్గాలను నివారించండి.",
                "recommended_actions": [
                    "స్థానిక విపత్తు నిర్వహణ మరియు జీహెచ్‌ఎంసీ సమాచారాన్ని పర్యవేక్షించండి.",
                    "అండర్‌పాస్‌లు, చెరువులు మరియు మూసీ నది పరీవాహక ప్రాంతాలకు దూరంగా ఉండండి.",
                    "ముఖ్యమైన వస్తువులు మరియు పత్రాలను పై అంతస్తులలో భద్రపరచుకోండి."
                ]
            }
        elif language == "hi":
            fallback = {
                "advisory_title": f"बाढ़ सतर्कता चेतावनी: {loc_name}",
                "advisory_markdown": f"स्वचालित चेतावनी। संभावित बाढ़ जोखिम: {(prob * 100):.1f}%. गंभीरता: {sev}. जलभराव वाले रास्तों से बचें।",
                "recommended_actions": [
                    "आपदा प्रबंधन प्राधिकरण और नगरपालिका बुलेटिन पर नजर रखें।",
                    "अंडरपास, नालों और निचले जलभराव वाले मार्गों से दूर रहें।",
                    "आपातकालीन किट तैयार रखें और सुरक्षित स्थान पर शरण लें।"
                ]
            }
        else:
            fallback = {
                "advisory_title": f"Flood Alert: {loc_name}",
                "advisory_markdown": f"Automated alert. Susceptibility: {(prob * 100):.1f}%. Severity: {sev}.",
                "recommended_actions": [
                    "Monitor civil defense and municipal radar feeds.",
                    "Avoid underpasses, riverbanks, and low-lying stormwater drains.",
                    "Prepare essential supplies and be ready to move to higher ground."
                ]
            }

        if not self.is_configured or not self.client:
            return fallback

        lang_instruction = "Respond entirely in English."
        if language == "te":
            lang_instruction = "Respond entirely in Telugu (తెలుగు) with natural language and terminology."
        elif language == "hi":
            lang_instruction = "Respond entirely in Hindi (हिन्दी) with authoritative emergency phrasing."

        system_prompt = (
            "You are an Emergency Disaster Management AI for the HackWave Flood Engine. "
            "Based on the provided context, generate a tactical emergency advisory in JSON format. "
            f"{lang_instruction} "
            "Output must be valid JSON with keys: 'advisory_title', 'advisory_markdown', 'recommended_actions' (list of strings)."
        )
        
        user_content = json.dumps(context, indent=2)
        
        try:
            response = self.client.chat.completions.create(
                model=settings.featherless_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=450,
                temperature=0.3,
                response_format={ "type": "json_object" }
            )
            result = json.loads(response.choices[0].message.content.strip())
            return {
                "advisory_title": result.get("advisory_title", fallback["advisory_title"]),
                "advisory_markdown": result.get("advisory_markdown", fallback["advisory_markdown"]),
                "recommended_actions": result.get("recommended_actions", fallback["recommended_actions"])
            }
        except Exception as exc:
            print(f"[FeatherlessAgent] AI advisory generation failed: {exc}")
            return fallback
