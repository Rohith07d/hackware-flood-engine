"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { CENTER, evacuationRoute, mapMarkers } from "../data/floodData.js";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const markerColors = {
  gauge: "#f5b942",
  infrastructure: "#2dd4bf",
  police: "#4d8bf5",
  critical: "#e2483d",
};

// Equirectangular projection metric constants for Hyderabad (17.4°N, 78.4°E)
const REF_LAT = 17.4;
const METERS_PER_DEG_LAT = 111320.0;
const METERS_PER_DEG_LON = 111320.0 * Math.cos((REF_LAT * Math.PI) / 180.0);

/**
 * Calculates the minimum distance in meters from a query point (lat, lng)
 * to a multi-point polyline [[lon, lat], ...].
 */
function minDistanceToPolylineMeters(targetLat, targetLng, coordinates) {
  if (!coordinates || coordinates.length < 2) return Infinity;

  const qx = (targetLng - 78.4) * METERS_PER_DEG_LON;
  const qy = (targetLat - REF_LAT) * METERS_PER_DEG_LAT;
  let minDist = Infinity;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const x1 = (coordinates[i][0] - 78.4) * METERS_PER_DEG_LON;
    const y1 = (coordinates[i][1] - REF_LAT) * METERS_PER_DEG_LAT;
    const x2 = (coordinates[i + 1][0] - 78.4) * METERS_PER_DEG_LON;
    const y2 = (coordinates[i + 1][1] - REF_LAT) * METERS_PER_DEG_LAT;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((qx - x1) * dx + (qy - y1) * dy) / lenSq));
    }
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const dist = Math.hypot(qx - projX, qy - projY);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

/**
 * Fallback style with high-resolution Carto basemap tiles when no Mapbox token is supplied.
 */
function getBasemapStyle(isDark) {
  if (MAPBOX_TOKEN) {
    return isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";
  }

  return {
    version: 8,
    sources: {
      "carto-basemap": {
        type: "raster",
        tiles: [
          isDark
            ? "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
            : "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: "carto-basemap-layer",
        type: "raster",
        source: "carto-basemap",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

export default function MapCanvasInner({
  variant = "light", // "light" | "dark"
  showMarkers = false,
  showEvacuation = false,
  zoom = 14,
  className = "",
  interactive = true,
  horizon = 62,
  center,
  marker,
  highRiskCoordinate,
  highRiskCoordinates,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const roadsDataRef = useRef(null);
  const popupRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const dark = variant === "dark";

  // Target center coordinates in [lng, lat] for Mapbox
  const initialCenterLngLat = center
    ? [center[1], center[0]]
    : [CENTER[1], CENTER[0]];

  // Determine active high-risk coordinates for spatial intersection
  const getRiskCoordinates = useCallback(() => {
    const list = [];
    if (highRiskCoordinates && Array.isArray(highRiskCoordinates)) {
      highRiskCoordinates.forEach((c) => {
        if (Array.isArray(c) && c.length >= 2) list.push({ lat: c[0], lng: c[1] });
        else if (c && typeof c.lat === "number" && typeof c.lng === "number") list.push(c);
      });
    }
    if (highRiskCoordinate) {
      if (Array.isArray(highRiskCoordinate)) {
        list.push({ lat: highRiskCoordinate[0], lng: highRiskCoordinate[1] });
      } else if (typeof highRiskCoordinate.lat === "number") {
        list.push(highRiskCoordinate);
      }
    }
    if (marker && typeof marker.lat === "number") {
      list.push({ lat: marker.lat, lng: marker.lng });
    }
    if (center && Array.isArray(center)) {
      list.push({ lat: center[0], lng: center[1] });
    }
    if (list.length === 0) {
      list.push({ lat: CENTER[0], lng: CENTER[1] });
    }
    return list;
  }, [highRiskCoordinates, highRiskCoordinate, marker, center]);

  // Apply spatial filtering on local roads GeoJSON
  const evaluateRoadFlooding = useCallback(
    (rawGeojson) => {
      if (!rawGeojson || !rawGeojson.features) return null;

      const riskPoints = getRiskCoordinates();
      // Radius expands with horizon slider (300m - 750m)
      const floodThresholdMeters = 300 + (horizon / 100) * 450;

      const updatedFeatures = rawGeojson.features.map((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!coords || feature.geometry?.type !== "LineString") {
          return feature;
        }

        let minDistance = Infinity;
        for (const pt of riskPoints) {
          const d = minDistanceToPolylineMeters(pt.lat, pt.lng, coords);
          if (d < minDistance) minDistance = d;
        }

        const isFlooded = minDistance <= floodThresholdMeters;
        const floodSeverity = isFlooded
          ? Math.max(0.3, Math.min(2.0, (1 - minDistance / floodThresholdMeters) * 1.8)).toFixed(2)
          : "0.00";

        return {
          ...feature,
          properties: {
            ...feature.properties,
            is_flooded: isFlooded,
            distance_to_risk_m: Math.round(minDistance),
            flood_depth_m: floodSeverity,
            risk_tier: isFlooded ? "HIGH_FLOOD" : "CLEAR",
          },
        };
      });

      return {
        ...rawGeojson,
        features: updatedFeatures,
      };
    },
    [getRiskCoordinates, horizon]
  );

  // Initialize Mapbox Map Instance
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: getBasemapStyle(dark),
      center: initialCenterLngLat,
      zoom: zoom,
      interactive: interactive,
      attributionControl: true,
    });

    mapRef.current = map;

    // Load local roads GeoJSON and add layers when map style is ready
    map.on("load", () => {
      setMapLoaded(true);

      // Fetch roads GeoJSON
      fetch("/data/local_roads.geojson")
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          roadsDataRef.current = data;
          const filteredData = evaluateRoadFlooding(data);

          if (!map.getSource("local-roads")) {
            map.addSource("local-roads", {
              type: "geojson",
              data: filteredData,
            });

            // Layer 1: Ambient Red Glow for Flooded Roads
            map.addLayer({
              id: "local-roads-flooded-glow",
              type: "line",
              source: "local-roads",
              filter: ["==", ["get", "is_flooded"], true],
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": "#ef4444",
                "line-width": 11,
                "line-opacity": 0.45,
                "line-blur": 3.5,
              },
            });

            // Layer 2: Main Vector Road Layer with Dynamic Mapbox Spatial Expression
            // Flooded roads = Bold Red (#ef4444, 4.8px); Unflooded roads = Subtle Dark Gray (#475569, 1.5px)
            map.addLayer({
              id: "local-roads-vector",
              type: "line",
              source: "local-roads",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": [
                  "case",
                  ["==", ["get", "is_flooded"], true],
                  "#ef4444", // High-risk flooded roads in bold red
                  dark ? "#475569" : "#64748b", // Unflooded roads in subtle dark gray
                ],
                "line-width": [
                  "case",
                  ["==", ["get", "is_flooded"], true],
                  4.8, // Increased width for flooded roads
                  1.6, // Subtle width for passable roads
                ],
                "line-opacity": [
                  "case",
                  ["==", ["get", "is_flooded"], true],
                  1.0,
                  dark ? 0.75 : 0.65,
                ],
              },
            });

            // Interactive popup on hover/click over road segments
            popupRef.current = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: "flood-road-popup",
            });

            map.on("mouseenter", "local-roads-vector", (e) => {
              map.getCanvas().style.cursor = "pointer";
              if (e.features && e.features.length > 0) {
                const f = e.features[0];
                const p = f.properties;
                const isFlooded = p.is_flooded;
                const roadName = p.name || p.id || "Road Segment";
                const locality = p.locality || "Hyderabad Region";
                const statusBadge = isFlooded
                  ? '<span style="color:#ef4444;font-weight:700;">⚠️ FLOODED (High Risk)</span>'
                  : '<span style="color:#10b981;font-weight:600;">✅ CLEAR (Passable)</span>';
                const depthInfo = isFlooded
                  ? `<div style="font-size:11px;color:#f87171;margin-top:2px;">Est. Depth: ~${p.flood_depth_m}m | Distance: ${p.distance_to_risk_m}m</div>`
                  : `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">Nearest Drain/Risk: ${p.distance_to_risk_m}m</div>`;

                popupRef.current
                  .setLngLat(e.lngLat)
                  .setHTML(
                    `<div style="font-family:system-ui,sans-serif;padding:6px 8px;font-size:12px;background:#0f172a;color:#f8fafc;border-radius:6px;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                      <div style="font-weight:600;margin-bottom:2px;">${roadName}</div>
                      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">${locality}</div>
                      <div>${statusBadge}</div>
                      ${depthInfo}
                    </div>`
                  )
                  .addTo(map);
              }
            });

            map.on("mouseleave", "local-roads-vector", () => {
              map.getCanvas().style.cursor = "";
              if (popupRef.current) popupRef.current.remove();
            });
          }
        })
        .catch((err) => {
          console.warn("[MapCanvasInner] Could not load local roads vector GeoJSON:", err);
        });

      // Optional evacuation route layer
      if (showEvacuation && evacuationRoute && evacuationRoute.length > 1) {
        const evacCoords = evacuationRoute.map((p) => [p[1], p[0]]);
        if (!map.getSource("evacuation-route")) {
          map.addSource("evacuation-route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: evacCoords,
              },
            },
          });
          map.addLayer({
            id: "evacuation-route-layer",
            type: "line",
            source: "evacuation-route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#06b6d4",
              "line-width": 4,
              "line-dasharray": [2, 2],
            },
          });
        }
      }
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
      if (markerInstanceRef.current) markerInstanceRef.current.remove();
      poiMarkersRef.current.forEach((m) => m.remove());
      poiMarkersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [dark]);

  // Update center smoothly when prop changes
  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.flyTo({
      center: [center[1], center[0]],
      zoom: zoom,
      essential: true,
      duration: 1200,
    });
  }, [center ? `${center[0]},${center[1]}` : "", zoom]);

  // Update dynamic road spatial filter whenever center, marker, or horizon changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !roadsDataRef.current) return;

    const updated = evaluateRoadFlooding(roadsDataRef.current);
    const source = mapRef.current.getSource("local-roads");
    if (source && updated) {
      source.setData(updated);
    }
  }, [evaluateRoadFlooding, mapLoaded, horizon]);

  // Render high-risk epicenter marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (markerInstanceRef.current) {
      markerInstanceRef.current.remove();
      markerInstanceRef.current = null;
    }

    const activeMarker = marker || (center ? { lat: center[0], lng: center[1] } : null);
    if (!activeMarker) return;

    // Create pulsating radar marker element
    const el = document.createElement("div");
    el.className = "flood-marker-pulse";
    el.style.width = "24px";
    el.style.height = "24px";
    el.style.position = "relative";
    el.style.cursor = "pointer";

    el.innerHTML = `
      <div style="position:absolute;inset:0;border-radius:50%;background:#ef4444;opacity:0.75;animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position:relative;width:14px;height:14px;top:5px;left:5px;border-radius:50%;background:#dc2626;border:2.5px solid #ffffff;box-shadow:0 0 8px rgba(0,0,0,0.4);"></div>
    `;

    const m = new mapboxgl.Marker({ element: el })
      .setLngLat([activeMarker.lng, activeMarker.lat])
      .addTo(mapRef.current);

    if (activeMarker.label) {
      const p = new mapboxgl.Popup({ offset: 14 }).setText(activeMarker.label);
      m.setPopup(p);
    }

    markerInstanceRef.current = m;
  }, [marker ? `${marker.lat},${marker.lng}` : "", center ? `${center[0]},${center[1]}` : "", mapLoaded]);

  // Render POI / Gauge markers if enabled
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    poiMarkersRef.current.forEach((m) => m.remove());
    poiMarkersRef.current = [];

    if (!showMarkers || !mapMarkers || mapMarkers.length === 0) return;

    mapMarkers.forEach((poi) => {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = markerColors[poi.type] || "#ffffff";
      el.style.border = "2px solid #0f172a";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
      el.style.cursor = "pointer";

      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setText(poi.label || poi.id))
        .addTo(mapRef.current);

      poiMarkersRef.current.push(m);
    });
  }, [showMarkers, mapLoaded]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <style jsx global>{`
        @keyframes ping {
          75%,
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .mapboxgl-popup-tip {
          border-top-color: #0f172a !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className={`h-full w-full ${dark ? "map-dark" : ""}`}
        style={{ minHeight: "100%", width: "100%" }}
      />
    </div>
  );
}
