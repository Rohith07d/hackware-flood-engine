"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

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
  selectedRoad = null,
  onRoadSelect = null,
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
  const roadLayersRef = useRef([]);
  const zoneLayersRef = useRef([]);
  const evacuationLayerRef = useRef(null);
  const rasterLayerRef = useRef(null);
  const clickCallbackRef = useRef(onMapClick);
  const onRoadSelectRef = useRef(onRoadSelect);

  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "submerged" | "passable"

  clickCallbackRef.current = onMapClick;
  onRoadSelectRef.current = onRoadSelect;

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
  const primaryColor = RISK_COLORS[riskTier] || "#3b82f6";

  const roads = selectedArea?.affected_roads || [];
  const zones = selectedArea?.vicinity_zones || [];

  // 1. Initialize Leaflet Map Instance
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

  // 2. Handle Evacuation Route
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

  // 3. Handle Reference Raster Overlay toggle
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

  // 4. Render Road Inundation Polylines & Vicinity Micro-Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old road and zone layers
    roadLayersRef.current.forEach((layer) => layer.remove());
    roadLayersRef.current = [];

    zoneLayersRef.current.forEach((layer) => layer.remove());
    zoneLayersRef.current = [];

    if (areaMarkerRef.current) {
      areaMarkerRef.current.remove();
      areaMarkerRef.current = null;
    }

    if (!selectedArea || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    // Camera fly to selected area
    map.flyTo([lat, lon], 14, { duration: 0.8 });

    // A. Render Vicinity Micro-Zones (Low-lying basins, nala corridors)
    zones.forEach((z) => {
      const polygonLayer = L.polygon(z.polygon, {
        color: z.gradient_color,
        weight: 1.5,
        dashArray: "4 4",
        fillColor: z.gradient_color,
        fillOpacity: z.fill_opacity || 0.18,
        zIndex: 5,
      }).addTo(map);

      polygonLayer.bindTooltip(
        `<div class="text-xs">
          <b>${z.name}</b><br/>
          <span style="color:${z.gradient_color}">● ${z.severity} (${z.avg_depth_m}m avg depth)</span><br/>
          <span class="text-slate-500">${z.type}</span>
        </div>`,
        { sticky: true }
      );
      zoneLayersRef.current.push(polygonLayer);
    });

    // B. Render Road Corridors with Gradients
    roads.forEach((r) => {
      const isSubmerged = r.inundation_tier in { Critical: 1, Severe: 1 };
      const isPassable = r.inundation_tier === "Passable";

      // Apply filter
      if (activeFilter === "submerged" && !isSubmerged) return;
      if (activeFilter === "passable" && !isPassable) return;

      const isRoadSelected = selectedRoad?.id === r.id;

      // Glow underlay for critical roads or selected road
      if (r.is_critical || isRoadSelected) {
        const glowLayer = L.polyline(r.coordinates, {
          color: isRoadSelected ? "#38bdf8" : r.gradient_color,
          weight: isRoadSelected ? 10 : 8,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round",
          zIndex: 8,
        }).addTo(map);
        roadLayersRef.current.push(glowLayer);
      }

      // Main Road Polyline
      const polyline = L.polyline(r.coordinates, {
        color: isRoadSelected ? "#38bdf8" : r.gradient_color,
        weight: isRoadSelected ? 6 : (r.is_critical ? 5 : 4),
        opacity: isRoadSelected ? 1.0 : (isPassable ? 0.85 : 0.98),
        dashArray: r.inundation_tier === "Critical" ? "6 3" : undefined,
        lineCap: "round",
        lineJoin: "round",
        zIndex: isRoadSelected ? 15 : (r.is_critical ? 12 : 9),
      }).addTo(map);

      // Popup Content
      const popupHtml = `
        <div style="font-family: inherit; min-width: 220px; padding: 2px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px;">
            <b style="font-size: 12px; color: #0f172a;">${r.road_name}</b>
            <span style="background:${r.gradient_color}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
              ${r.inundation_tier}
            </span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <b>Type:</b> ${r.road_type} (${r.length_km} km)
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <b>Water Depth:</b> <span style="font-weight:700; color:${r.gradient_color};">${r.predicted_water_depth_m} m</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
            <b>Status:</b> <span style="font-weight:700; color:${r.gradient_color};">${r.traffic_status}</span>
          </div>
          <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; font-style: italic;">
            ${r.advisory}
          </div>
        </div>
      `;

      polyline.bindTooltip(
        `<b>${r.road_name}</b>: ${r.predicted_water_depth_m}m (${r.inundation_tier})`,
        { sticky: true }
      );
      polyline.bindPopup(popupHtml);

      polyline.on("click", () => {
        if (onRoadSelectRef.current) {
          onRoadSelectRef.current(r);
        }
      });

      roadLayersRef.current.push(polyline);
    });

    // C. Area Central Focal Marker
    const customIcon = L.divIcon({
      className: "custom-area-marker",
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        ">
          <div style="
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background-color: ${primaryColor};
            opacity: 0.35;
          "></div>
          <div style="
            position: relative;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: ${primaryColor};
            border: 2px solid #ffffff;
            box-shadow: 0 0 10px ${primaryColor};
          "></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    areaMarkerRef.current = L.marker([lat, lon], { icon: customIcon, zIndexOffset: 500 })
      .addTo(map)
      .bindTooltip(
        `<b>${areaName}</b><br/>LightGBM Susceptibility: ${(score * 100).toFixed(1)}% (${riskTier})`,
        { permanent: false, direction: "top", offset: [0, -10] }
      );
  }, [lat, lon, areaName, riskTier, score, primaryColor, selectedArea, selectedRoad, activeFilter]);

  // Handle zooming directly to selected road
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedRoad?.coordinates || selectedRoad.coordinates.length === 0) return;

    try {
      const bounds = L.latLngBounds(selectedRoad.coordinates);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } catch (e) {
      // safe fallback
    }
  }, [selectedRoad]);

  const submergedCount = roads.filter((r) => r.inundation_tier in { Critical: 1, Severe: 1 }).length;
  const passableCount = roads.filter((r) => r.inundation_tier === "Passable").length;

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: "100%", width: "100%", cursor: "crosshair" }}
      />

      {/* Map Interactive Guide */}
      <div className="pointer-events-none absolute top-3 left-4 z-[400] flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/85 px-3 py-1.5 shadow-md backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[11.5px] font-medium text-slate-300">
          Click map anywhere to analyze localized flood risk
        </span>
      </div>

      {/* Road Filter Toggle Chips */}
      {roads.length > 0 && (
        <div className="absolute top-3 right-4 z-[400] flex items-center gap-1 rounded-xl border border-white/15 bg-slate-900/90 p-1 shadow-xl backdrop-blur-md text-[11px]">
          <button
            onClick={() => setActiveFilter("all")}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              activeFilter === "all" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-300 hover:bg-white/10"
            }`}
          >
            All Roads ({roads.length})
          </button>
          <button
            onClick={() => setActiveFilter("submerged")}
            className={`rounded-lg px-2.5 py-1 font-medium transition flex items-center gap-1 ${
              activeFilter === "submerged" ? "bg-red-500 text-white font-semibold" : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Submerged ({submergedCount})
          </button>
          <button
            onClick={() => setActiveFilter("passable")}
            className={`rounded-lg px-2.5 py-1 font-medium transition flex items-center gap-1 ${
              activeFilter === "passable" ? "bg-emerald-500 text-white font-semibold" : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Passable ({passableCount})
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-slate-900/95 px-4 py-2.5 shadow-2xl">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <span className="text-[12.5px] font-medium text-slate-200">
              Featherless AI Modeling Road Inundation...
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

      {/* Road Inundation Gradient Legend (Bottom Right) */}
      <div className="absolute bottom-5 right-4 z-[400] rounded-xl border border-white/15 bg-slate-900/90 p-2.5 shadow-xl backdrop-blur-md text-[10.5px]">
        <div className="font-semibold text-white mb-1.5 text-[11px] flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          Road Flood Gradients
        </div>
        <div className="space-y-1 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-5 rounded bg-red-500 shadow-sm" />
            <span>Critical Submersion (&ge;0.7m)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-5 rounded bg-orange-500 shadow-sm" />
            <span>Severe Waterlogging (0.4–0.7m)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-5 rounded bg-amber-500 shadow-sm" />
            <span>Moderate Caution (0.2–0.4m)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-5 rounded bg-yellow-500 shadow-sm" />
            <span>Minor Ponding (0.05–0.2m)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-5 rounded bg-emerald-500 shadow-sm" />
            <span>Passable / Clear (&lt;0.05m)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
