"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Risk tier colors for dynamic area styling
const RISK_COLORS = {
  "Very High": "#ef4444",
  "High": "#f97316",
  "Moderate": "#f59e0b",
  "Low": "#0ea5e9",
  "Very Low": "#10b981",
  "Critical": "#dc2626",
};

const SUSCEPTIBILITY_BOUNDS = [
  [16.99930555555556, 77.99986111111112],
  [18.00013888888889, 79.00069444444445],
];

const DEFAULT_EVACUATION_ROUTE = [
  [17.4447, 78.4664],
  [17.4401, 78.4500],
  [17.4350, 78.4400],
  [17.4319, 78.4074],
];

export default function MapCanvasInner({
  variant = "dark",
  selectedArea = null,
  center = null,
  zoom = 13.5,
  onMapClick = null,
  showReferenceRaster = false,
  showEvacuation = false,
  rainfall = 65,
  isLoading = false,
  interactive = true,
  className = "",
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const areaMarkerRef = useRef(null);
  const areaHaloRef = useRef(null);
  const areaBoundsRef = useRef(null);
  const evacuationLayerRef = useRef(null);
  const rasterLayerRef = useRef(null);
  const clickCallbackRef = useRef(onMapClick);

  clickCallbackRef.current = onMapClick;

  // Robust coordinate resolution preventing any NaN propagation
  const rawLat = selectedArea?.coordinates?.latitude ?? selectedArea?.latitude ?? center?.[0];
  const rawLon = selectedArea?.coordinates?.longitude ?? selectedArea?.longitude ?? center?.[1];

  const parsedLat = Number(rawLat);
  const parsedLon = Number(rawLon);

  const lat = Number.isFinite(parsedLat) ? parsedLat : 17.4401;
  const lon = Number.isFinite(parsedLon) ? parsedLon : 78.3489;

  const areaName = selectedArea?.area_name || "Selected Area";
  const riskTier = selectedArea?.risk_tier || "Moderate";
  const rawScore = Number(selectedArea?.susceptibility_score);
  const score = Number.isFinite(rawScore) ? rawScore : 0.0;
  const bbox = selectedArea?.bounding_box;

  const primaryColor = RISK_COLORS[riskTier] || "#3b82f6";

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (containerRef.current._leaflet_id) {
      containerRef.current._leaflet_id = null;
    }

    const initialLat = Number.isFinite(lat) ? lat : 17.4401;
    const initialLon = Number.isFinite(lon) ? lon : 78.3489;
    const initialZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : 13.5;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLon],
      zoom: initialZoom,
      zoomControl: false,
      scrollWheelZoom: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
    });
    mapInstanceRef.current = map;

    // CartoDB Voyager tiles (with key parameter to remove watermark)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2wfl_1_2abafc0fe8da36eb5a7b4f5b",
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; OpenStreetMap',
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    // Map click handler for interactive area selection
    map.on("click", (e) => {
      if (clickCallbackRef.current && e?.latlng) {
        const clickLat = Number(e.latlng.lat);
        const clickLng = Number(e.latlng.lng);
        if (Number.isFinite(clickLat) && Number.isFinite(clickLng)) {
          clickCallbackRef.current({
            latitude: Number(clickLat.toFixed(6)),
            longitude: Number(clickLng.toFixed(6)),
          });
        }
      }
    });

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (containerRef.current && containerRef.current._leaflet_id) {
        containerRef.current._leaflet_id = null;
      }
    };
  }, []);

  // Handle Evacuation Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showEvacuation) {
      if (!evacuationLayerRef.current) {
        evacuationLayerRef.current = L.polyline(DEFAULT_EVACUATION_ROUTE, {
          color: "#0891b2",
          weight: 4,
          dashArray: "2 8",
          lineCap: "round",
          zIndex: 8,
        }).addTo(map);
      }
    } else {
      if (evacuationLayerRef.current) {
        evacuationLayerRef.current.remove();
        evacuationLayerRef.current = null;
      }
    }
  }, [showEvacuation]);

  // Handle Reference Raster Overlay toggle
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (showReferenceRaster) {
      if (!rasterLayerRef.current) {
        rasterLayerRef.current = L.imageOverlay("/flood_overlay.png", SUSCEPTIBILITY_BOUNDS, {
          opacity: 0.45,
          zIndex: 4,
        }).addTo(mapInstanceRef.current);
      }
    } else {
      if (rasterLayerRef.current) {
        rasterLayerRef.current.remove();
        rasterLayerRef.current = null;
      }
    }
  }, [showReferenceRaster]);

  // Update Selected Area Marker & Highlight Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean up previous area highlights
    if (areaMarkerRef.current) {
      areaMarkerRef.current.remove();
      areaMarkerRef.current = null;
    }
    if (areaHaloRef.current) {
      areaHaloRef.current.remove();
      areaHaloRef.current = null;
    }
    if (areaBoundsRef.current) {
      areaBoundsRef.current.remove();
      areaBoundsRef.current = null;
    }

    // Safety guard: only execute area flyTo and highlight if selectedArea is provided and valid
    if (!selectedArea || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    // Fly camera smoothly to selected area
    map.flyTo([lat, lon], 14, { duration: 1.0 });

    // 1. Highlight bounding box if available
    if (bbox && Array.isArray(bbox) && bbox.length === 4 && bbox.every((val) => Number.isFinite(Number(val)))) {
      const boundsLatLng = [
        [Number(bbox[0]), Number(bbox[1])],
        [Number(bbox[2]), Number(bbox[3])],
      ];
      areaBoundsRef.current = L.rectangle(boundsLatLng, {
        color: primaryColor,
        weight: 2,
        dashArray: "4 4",
        fillColor: primaryColor,
        fillOpacity: 0.12,
        zIndex: 10,
      }).addTo(map);
    }

    // 2. Pulsing Radial Halo
    areaHaloRef.current = L.circle([lat, lon], {
      radius: 900,
      color: primaryColor,
      weight: 1.5,
      fillColor: primaryColor,
      fillOpacity: Math.min(0.35, 0.10 + score * 0.25),
      zIndex: 11,
    }).addTo(map);

    // 3. Focal Point Marker
    const customIcon = L.divIcon({
      className: "custom-area-marker",
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
        ">
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: ${primaryColor};
            opacity: 0.4;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            position: relative;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: ${primaryColor};
            border: 3px solid #ffffff;
            box-shadow: 0 0 12px ${primaryColor};
          "></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    areaMarkerRef.current = L.marker([lat, lon], { icon: customIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip(
        `<b>${areaName}</b><br/>LightGBM Susceptibility: ${(score * 100).toFixed(1)}% (${riskTier})`,
        { permanent: false, direction: "top", offset: [0, -12] }
      );
  }, [lat, lon, areaName, riskTier, score, primaryColor, bbox, selectedArea]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: "100%", width: "100%", cursor: "crosshair" }}
      />

      {/* Map Interactive Guide */}
      <div className="pointer-events-none absolute top-4 left-4 z-[400] flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/85 px-3 py-1.5 shadow-md backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[11.5px] font-medium text-slate-300">
          Click map anywhere to analyze localized flood risk
        </span>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-slate-900/95 px-4 py-2.5 shadow-2xl">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <span className="text-[12.5px] font-medium text-slate-200">
              Featherless AI Orchestrating Analysis...
            </span>
          </div>
        </div>
      )}

      {/* Active Selected Area Floating Chip */}
      {selectedArea && Number.isFinite(lat) && Number.isFinite(lon) && (
        <div className="pointer-events-none absolute bottom-5 left-4 z-[400] flex items-center gap-2.5 rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2 shadow-xl backdrop-blur-md">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-white">{areaName}</span>
            <span className="text-[10px] text-slate-400">
              {lat.toFixed(4)}°N, {lon.toFixed(4)}°E • {(score * 100).toFixed(1)}% ({riskTier})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
