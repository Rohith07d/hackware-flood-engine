export const APP_NAME = "FloodCast";

export const MAP_DEFAULTS = {
  latitude: 17.4948,
  longitude: 78.681,
  zoom: 14,
};

export const HYDERABAD_BOUNDS = {
  south: 16.9993,
  north: 18.0001,
  west: 77.9998,
  east: 79.0007,
};

export function isLocationInCoverage(lat, lon) {
  return (
    lat >= HYDERABAD_BOUNDS.south &&
    lat <= HYDERABAD_BOUNDS.north &&
    lon >= HYDERABAD_BOUNDS.west &&
    lon <= HYDERABAD_BOUNDS.east
  );
}

export const DEMO_LOCATIONS = [
  {
    name: "Ghatkesar Basin",
    lat: 17.4948,
    lng: 78.681,
    desc: "Critical Infrastructure & Retention Basin",
    rainfall: 110,
  },
  {
    name: "Musi River Corridor",
    lat: 17.3700,
    lng: 78.4800,
    desc: "Historic Flash Flood Channel",
    rainfall: 135,
  },
  {
    name: "Gachibowli",
    lat: 17.4400,
    lng: 78.3489,
    desc: "IT Urban Corridor & Storm Nala",
    rainfall: 85,
  },
  {
    name: "Nadeem Colony (Tolichowki)",
    lat: 17.3950,
    lng: 78.4100,
    desc: "Low-Elevation Waterlogging Depression",
    rainfall: 140,
  },
];

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "EN" },
  { code: "hi", label: "हिन्दी", flag: "HI" },
  { code: "te", label: "తెలుగు", flag: "TE" },
];

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
