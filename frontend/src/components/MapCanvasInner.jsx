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

export default function MapCanvasInner({
  variant = "dark",
  selectedArea = null,
  onMapClick = null,
  showReferenceRaster = false,
  rainfall = 65,
  isLoading = false,
  className = "",
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const areaMarkerRef = useRef(null);
  const areaHaloRef = useRef(null);
  const areaBoundsRef = useRef(null);
  const rasterLayerRef = useRef(null);
  const clickCallbackRef = useRef(onMapClick);

  clickCallbackRef.current = onMapClick;

  const lat = selectedArea?.coordinates?.latitude ?? selectedArea?.latitude ?? 17.4401;
  const lon = selectedArea?.coordinates?.longitude ?? selectedArea?.longitude ?? 78.3489;
  const areaName = selectedArea?.area_name || "Selected Area";
  const riskTier = selectedArea?.risk_tier || "Moderate";
  const score = selectedArea?.susceptibility_score ?? 0.0;
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

    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 13.5,
      zoomControl: false,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
    });
    mapInstanceRef.current = map;

    // Dark/modern CartoDB or OpenStreetMap tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Map click handler for interactive area selection
    map.on("click", (e) => {
      if (clickCallbackRef.current) {
        clickCallbackRef.current({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
        });
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
    if (areaMarkerRef.current) areaMarkerRef.current.remove();
    if (areaHaloRef.current) areaHaloRef.current.remove();
    if (areaBoundsRef.current) areaBoundsRef.current.remove();

    // Fly camera smoothly to selected area
    map.flyTo([lat, lon], 14, { duration: 1.0 });

    // 1. Highlight bounding box if available
    if (bbox && bbox.length === 4) {
      // bbox is [south, west, north, east]
      const boundsLatLng = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
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
  }, [lat, lon, areaName, riskTier, score, primaryColor, bbox]);

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
    </div>
  );
}
