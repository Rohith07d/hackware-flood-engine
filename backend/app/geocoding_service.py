import math
import urllib.request
import urllib.parse
import json
from typing import Dict, Any, List, Optional, Tuple

# Comprehensive catalog of Hyderabad localities, IT corridors, and river basins
HYDERABAD_LOCALITIES: Dict[str, Dict[str, Any]] = {
    "gachibowli": {
        "display_name": "Gachibowli, Hyderabad",
        "latitude": 17.4401,
        "longitude": 78.3489,
        "bounding_box": [17.4200, 78.3300, 17.4600, 78.3700],
        "category": "IT Corridor / Low-lying Depressions",
    },
    "begumpet": {
        "display_name": "Begumpet, Hyderabad",
        "latitude": 17.4447,
        "longitude": 78.4664,
        "bounding_box": [17.4300, 78.4500, 17.4600, 78.4800],
        "category": "Hussain Sagar Outflow / High Inundation Risk",
    },
    "musi river basin": {
        "display_name": "Musi River Basin, Hyderabad",
        "latitude": 17.3700,
        "longitude": 78.4800,
        "bounding_box": [17.3500, 78.4500, 17.3900, 78.5200],
        "category": "Active River Floodplain",
    },
    "musi river": {
        "display_name": "Musi River Basin, Hyderabad",
        "latitude": 17.3700,
        "longitude": 78.4800,
        "bounding_box": [17.3500, 78.4500, 17.3900, 78.5200],
        "category": "Active River Floodplain",
    },
    "ghatkesar": {
        "display_name": "Ghatkesar, Hyderabad",
        "latitude": 17.4455,
        "longitude": 78.6844,
        "bounding_box": [17.4200, 78.6500, 17.4700, 78.7100],
        "category": "Eastern Inundation Catchment",
    },
    "madhapur": {
        "display_name": "Madhapur, Hyderabad",
        "latitude": 17.4483,
        "longitude": 78.3915,
        "bounding_box": [17.4350, 78.3750, 17.4600, 78.4050],
        "category": "Urban IT Hub / Durgam Cheruvu Catchment",
    },
    "hitec city": {
        "display_name": "HITEC City, Hyderabad",
        "latitude": 17.4435,
        "longitude": 78.3772,
        "bounding_box": [17.4300, 78.3600, 17.4550, 78.3900],
        "category": "Commercial IT Corridor",
    },
    "secunderabad": {
        "display_name": "Secunderabad, Hyderabad",
        "latitude": 17.4399,
        "longitude": 78.4983,
        "bounding_box": [17.4200, 78.4800, 17.4600, 78.5200],
        "category": "Northern Urban Transit Center",
    },
    "banjara hills": {
        "display_name": "Banjara Hills, Hyderabad",
        "latitude": 17.4156,
        "longitude": 78.4350,
        "bounding_box": [17.4000, 78.4150, 17.4300, 78.4550],
        "category": "Hilly Ridge / Moderate Runoff",
    },
    "jubilee hills": {
        "display_name": "Jubilee Hills, Hyderabad",
        "latitude": 17.4319,
        "longitude": 78.4074,
        "bounding_box": [17.4150, 78.3900, 17.4450, 78.4250],
        "category": "Elevated Rocky Ridge",
    },
    "charminar": {
        "display_name": "Charminar (Old City), Hyderabad",
        "latitude": 17.3616,
        "longitude": 78.4747,
        "bounding_box": [17.3450, 78.4600, 17.3750, 78.4900],
        "category": "Dense Historic Core / Musi South Bank",
    },
    "kukatpally": {
        "display_name": "Kukatpally, Hyderabad",
        "latitude": 17.4849,
        "longitude": 78.4138,
        "bounding_box": [17.4650, 78.3950, 17.5050, 78.4350],
        "category": "Major Residential / Lake Basin Surcharges",
    },
    "miyapur": {
        "display_name": "Miyapur, Hyderabad",
        "latitude": 17.4968,
        "longitude": 78.3546,
        "bounding_box": [17.4800, 78.3350, 17.5150, 78.3750],
        "category": "Northwestern Lake System Catchment",
    },
    "lb nagar": {
        "display_name": "LB Nagar, Hyderabad",
        "latitude": 17.3503,
        "longitude": 78.5524,
        "bounding_box": [17.3300, 78.5300, 17.3700, 78.5750],
        "category": "Southeastern Stormwater Discharge Zone",
    },
    "uppal": {
        "display_name": "Uppal, Hyderabad",
        "latitude": 17.4018,
        "longitude": 78.5602,
        "bounding_box": [17.3850, 78.5400, 17.4200, 78.5800],
        "category": "Eastern Musi Confluence Plains",
    },
    "nizampet": {
        "display_name": "Nizampet, Hyderabad",
        "latitude": 17.5169,
        "longitude": 78.3842,
        "bounding_box": [17.5000, 78.3650, 17.5300, 78.4000],
        "category": "Flood-Prone Urban Encroachment Zone",
    },
    "kondapur": {
        "display_name": "Kondapur, Hyderabad",
        "latitude": 17.4689,
        "longitude": 78.3578,
        "bounding_box": [17.4500, 78.3400, 17.4850, 78.3750],
        "category": "Elevated IT Fringe",
    },
    "manikonda": {
        "display_name": "Manikonda, Hyderabad",
        "latitude": 17.4019,
        "longitude": 78.3840,
        "bounding_box": [17.3850, 78.3650, 17.4200, 78.4050],
        "category": "Southwestern Reservoir Catchment",
    },
    "khairatabad": {
        "display_name": "Khairatabad, Hyderabad",
        "latitude": 17.4116,
        "longitude": 78.4619,
        "bounding_box": [17.3980, 78.4480, 17.4250, 78.4750],
        "category": "Hussain Sagar Inundation Shoreline",
    },
    "dilsukhnagar": {
        "display_name": "Dilsukhnagar, Hyderabad",
        "latitude": 17.3688,
        "longitude": 78.5247,
        "bounding_box": [17.3550, 78.5100, 17.3820, 78.5400],
        "category": "Dense Urban Commercial District",
    },
    "amberpet": {
        "display_name": "Amberpet, Hyderabad",
        "latitude": 17.3910,
        "longitude": 78.5180,
        "bounding_box": [17.3780, 78.5020, 17.4040, 78.5320],
        "category": "Musi River North Bank",
    },
    "tarnaka": {
        "display_name": "Tarnaka, Hyderabad",
        "latitude": 17.4283,
        "longitude": 78.5318,
        "bounding_box": [17.4150, 78.5150, 17.4420, 78.5480],
        "category": "University Ridge Zone",
    },
    "alwal": {
        "display_name": "Alwal, Hyderabad",
        "latitude": 17.5023,
        "longitude": 78.5038,
        "bounding_box": [17.4850, 78.4850, 17.5200, 78.5200],
        "category": "Northern Lake & Drainage Corridor",
    },
    "mehdipatnam": {
        "display_name": "Mehdipatnam, Hyderabad",
        "latitude": 17.3916,
        "longitude": 78.4398,
        "bounding_box": [17.3750, 78.4200, 17.4100, 78.4600],
        "category": "Southwest Transit Hub / Low-Lying Underpass Corridor",
    },
    "tolichowki": {
        "display_name": "Tolichowki, Hyderabad",
        "latitude": 17.4014,
        "longitude": 78.4116,
        "bounding_box": [17.3850, 78.3950, 17.4200, 78.4300],
        "category": "Nadeem Colony / Historical Severe Inundation Catchment",
    },
    "somajiguda": {
        "display_name": "Somajiguda, Hyderabad",
        "latitude": 17.4256,
        "longitude": 78.4583,
        "bounding_box": [17.4120, 78.4450, 17.4400, 78.4720],
        "category": "Raj Bhavan Road / Hussain Sagar Basin",
    },
    "panjagutta": {
        "display_name": "Panjagutta, Hyderabad",
        "latitude": 17.4265,
        "longitude": 78.4502,
        "bounding_box": [17.4150, 78.4380, 17.4400, 78.4650],
        "category": "Central Commercial Flyover Node",
    },
    "ameerpet": {
        "display_name": "Ameerpet, Hyderabad",
        "latitude": 17.4375,
        "longitude": 78.4482,
        "bounding_box": [17.4250, 78.4350, 17.4500, 78.4620],
        "category": "High-Density Commercial Underpass Hub",
    },
    "durgam cheruvu": {
        "display_name": "Durgam Cheruvu (Secret Lake), Hyderabad",
        "latitude": 17.4325,
        "longitude": 78.3882,
        "bounding_box": [17.4200, 78.3750, 17.4450, 78.4020],
        "category": "Major Lake Catchment & Spillway",
    },
    "hussain sagar": {
        "display_name": "Hussain Sagar Lake, Hyderabad",
        "latitude": 17.4239,
        "longitude": 78.4738,
        "bounding_box": [17.4100, 78.4600, 17.4450, 78.4900],
        "category": "Central Reservoir & Outflow Sluice Gates",
    },
    "attapur": {
        "display_name": "Attapur, Hyderabad",
        "latitude": 17.3712,
        "longitude": 78.4304,
        "bounding_box": [17.3550, 78.4150, 17.3900, 78.4480],
        "category": "Musi River Southern Floodplain Corridor",
    },
    "lingampally": {
        "display_name": "BHEL - Lingampally, Hyderabad",
        "latitude": 17.4935,
        "longitude": 78.3182,
        "bounding_box": [17.4780, 78.3000, 17.5100, 78.3350],
        "category": "Western Railway Hub / Industrial Catchment",
    },
    "chandanagar": {
        "display_name": "Chandanagar, Hyderabad",
        "latitude": 17.4932,
        "longitude": 78.3392,
        "bounding_box": [17.4780, 78.3220, 17.5100, 78.3550],
        "category": "Gangaram Cheruvu Outflow Catchment",
    },
    "malkajgiri": {
        "display_name": "Malkajgiri, Hyderabad",
        "latitude": 17.4526,
        "longitude": 78.5327,
        "bounding_box": [17.4380, 78.5150, 17.4700, 78.5500],
        "category": "Banda Cheruvu Urban Inundation Sector",
    },
    "shamshabad": {
        "display_name": "Shamshabad (Airport Zone), Hyderabad",
        "latitude": 17.2543,
        "longitude": 78.4312,
        "bounding_box": [17.2300, 78.4000, 17.2800, 78.4600],
        "category": "Southern Plateau / Airport Drainage Corridor",
    },
    "kacheguda": {
        "display_name": "Kacheguda, Hyderabad",
        "latitude": 17.3907,
        "longitude": 78.4983,
        "bounding_box": [17.3780, 78.4850, 17.4050, 78.5120],
        "category": "Railway Junction & Musi Outflow Lane",
    },
    "sanathnagar": {
        "display_name": "Sanathnagar, Hyderabad",
        "latitude": 17.4589,
        "longitude": 78.4410,
        "bounding_box": [17.4450, 78.4280, 17.4750, 78.4550],
        "category": "Industrial Catchment & Storm Drain Network",
    },
    "balanagar": {
        "display_name": "Balanagar, Hyderabad",
        "latitude": 17.4728,
        "longitude": 78.4450,
        "bounding_box": [17.4580, 78.4300, 17.4900, 78.4600],
        "category": "Northern Industrial Corridor Underpass",
    },
    "nagole": {
        "display_name": "Nagole, Hyderabad",
        "latitude": 17.3742,
        "longitude": 78.5627,
        "bounding_box": [17.3600, 78.5450, 17.3900, 78.5800],
        "category": "Eastern Musi River Confluence Plains",
    },
    "cyber towers": {
        "display_name": "Cyber Towers (HITEC City), Hyderabad",
        "latitude": 17.4504,
        "longitude": 78.3808,
        "bounding_box": [17.4380, 78.3680, 17.4620, 78.3950],
        "category": "Core IT Landmark / Shilparamam Junction",
    },
    "jubilee hills road 36": {
        "display_name": "Jubilee Hills Checkpost & Road 36, Hyderabad",
        "latitude": 17.4312,
        "longitude": 78.4118,
        "bounding_box": [17.4180, 78.3980, 17.4450, 78.4250],
        "category": "Elevated Commercial Arterial",
    },
    "chaderghat": {
        "display_name": "Chaderghat Causeway, Hyderabad",
        "latitude": 17.3820,
        "longitude": 78.4920,
        "bounding_box": [17.3700, 78.4800, 17.3950, 78.5050],
        "category": "Active River Causeway Submersion Point",
    },
    "moosarambagh": {
        "display_name": "Moosarambagh Bridge, Hyderabad",
        "latitude": 17.3765,
        "longitude": 78.5065,
        "bounding_box": [17.3650, 78.4950, 17.3900, 78.5200],
        "category": "Low Causeway Floodplain / Routine Closure Point",
    },
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in km."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    return 2.0 * r * math.asin(math.sqrt(a))


class GeocodingService:
    @staticmethod
    def search_suggestions(query: str, limit: int = 8) -> List[Dict[str, Any]]:
        """
        Return fast typeahead autocomplete suggestions for Hyderabad localities and landmarks.
        """
        q = (query or "").strip().lower()
        if not q:
            popular_keys = [
                "gachibowli", "begumpet", "musi river basin", "ghatkesar",
                "madhapur", "hitec city", "kukatpally", "charminar"
            ]
            return [
                {
                    "name": HYDERABAD_LOCALITIES[k]["display_name"],
                    "category": HYDERABAD_LOCALITIES[k]["category"],
                    "latitude": HYDERABAD_LOCALITIES[k]["latitude"],
                    "longitude": HYDERABAD_LOCALITIES[k]["longitude"],
                }
                for k in popular_keys if k in HYDERABAD_LOCALITIES
            ]

        results = []
        seen_names = set()
        for key, entry in HYDERABAD_LOCALITIES.items():
            disp = entry["display_name"]
            cat = entry["category"]
            if q in key or q in disp.lower() or q in cat.lower():
                if disp not in seen_names:
                    seen_names.add(disp)
                    results.append({
                        "name": disp,
                        "category": cat,
                        "latitude": entry["latitude"],
                        "longitude": entry["longitude"],
                    })
            if len(results) >= limit:
                break
        return results

    @staticmethod
    def resolve_location(
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Authoritative resolver that converts either a named area or coordinates
        into real latitude, longitude, and bounding box.
        """
        # Case 1: Coordinate-driven lookup / map click
        if latitude is not None and longitude is not None:
            return GeocodingService._reverse_geocode(latitude, longitude, preferred_name=location_name)

        # Case 2: Named location search
        clean_name = (location_name or "Gachibowli, Hyderabad").strip()
        lower_name = clean_name.lower()

        # Step A: Exact and Substring Match against local Hyderabad catalog
        for key, entry in HYDERABAD_LOCALITIES.items():
            if key in lower_name or lower_name in key:
                return {
                    "location_name": entry["display_name"],
                    "latitude": entry["latitude"],
                    "longitude": entry["longitude"],
                    "bounding_box": entry["bounding_box"],
                    "category": entry["category"],
                    "source": "local_hyderabad_catalog",
                    "status": "resolved"
                }

        # Step B: OSM Nominatim Geocoding Fallback
        osm_result = GeocodingService._query_nominatim(clean_name)
        if osm_result:
            return osm_result

        # Step C: Default to Gachibowli, Hyderabad if completely unresolved
        default_entry = HYDERABAD_LOCALITIES["gachibowli"]
        return {
            "location_name": f"{clean_name} (Mapped to Hyderabad)",
            "latitude": default_entry["latitude"],
            "longitude": default_entry["longitude"],
            "bounding_box": default_entry["bounding_box"],
            "category": default_entry["category"],
            "source": "default_fallback",
            "status": "resolved"
        }

    @staticmethod
    def _reverse_geocode(lat: float, lon: float, preferred_name: Optional[str] = None) -> Dict[str, Any]:
        """Find the closest neighborhood or locality in Hyderabad."""
        closest_name = None
        min_dist = float("inf")
        closest_entry = None

        for name, entry in HYDERABAD_LOCALITIES.items():
            dist = haversine_distance_km(lat, lon, entry["latitude"], entry["longitude"])
            if dist < min_dist:
                min_dist = dist
                closest_name = entry["display_name"]
                closest_entry = entry

        delta = 0.02
        bbox = [
            round(lat - delta, 4),
            round(lon - delta, 4),
            round(lat + delta, 4),
            round(lon + delta, 4),
        ]

        if min_dist <= 3.5 and closest_entry:
            disp_name = preferred_name or closest_entry["display_name"]
            category = closest_entry["category"]
        else:
            disp_name = preferred_name or f"Sector ({round(lat, 4)}, {round(lon, 4)}), Hyderabad"
            category = "Point Sector Analysis"

        return {
            "location_name": disp_name,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "bounding_box": bbox,
            "category": category,
            "source": "coordinate_reverse_lookup",
            "status": "resolved"
        }

    @staticmethod
    def _query_nominatim(query: str) -> Optional[Dict[str, Any]]:
        """Query OSM Nominatim API with safe timeout and error handling."""
        try:
            full_query = query if "hyderabad" in query.lower() else f"{query}, Hyderabad, India"
            encoded_query = urllib.parse.quote(full_query)
            url = f"https://nominatim.openstreetmap.org/search?q={encoded_query}&format=json&limit=1"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "HackWaveFloodEngine/1.0 (flood-prediction-agent)"}
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode())
                if data and len(data) > 0:
                    first = data[0]
                    lat = float(first["lat"])
                    lon = float(first["lon"])
                    bb = first.get("boundingbox", [lat - 0.02, lat + 0.02, lon - 0.02, lon + 0.02])
                    # Nominatim returns [south, north, west, east]
                    south, north, west, east = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
                    return {
                        "location_name": first.get("display_name", query).split(",")[0] + ", Hyderabad",
                        "latitude": lat,
                        "longitude": lon,
                        "bounding_box": [south, west, north, east],
                        "category": first.get("type", "Urban Locality"),
                        "source": "osm_nominatim",
                        "status": "resolved"
                    }
        except Exception as exc:
            print(f"[GeocodingService] Nominatim lookup exception for '{query}': {exc}")
        return None


geocoding_service = GeocodingService()
