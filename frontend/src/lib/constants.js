export const APP_NAME = "HackWave Flood Engine";

export const MAP_DEFAULTS = {
  latitude: 17.4948,
  longitude: 78.681,
  zoom: 14,
};

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
