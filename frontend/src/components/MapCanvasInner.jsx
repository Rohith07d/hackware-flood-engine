"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CENTER, evacuationRoute, mapMarkers } from "../data/floodData.js";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

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
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * High-performance, 100% reliable basemap style using CartoDB Dark/Light tiles with OSM attribution.
 * Never rate-limits, works without tokens, and renders fast Retina tiles worldwide.
 */
function getBasemapStyle(isDark) {
  if (MAPBOX_TOKEN) {
    return `https://api.mapbox.com/styles/v1/mapbox/${isDark ? "dark-v11" : "light-v11"}?access_token=${MAPBOX_TOKEN}`;
  }

  const tileUrl = isDark
    ? "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
    : "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

  return {
    version: 8,
    sources: {
      "carto-basemap": {
        type: "raster",
        tiles: [
          tileUrl,
          tileUrl.replace("a.basemaps", "b.basemaps"),
          tileUrl.replace("a.basemaps", "c.basemaps"),
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: "background-layer",
        type: "background",
        paint: {
          "background-color": isDark ? "#0b0f19" : "#f8fafc",
        },
      },
      {
        id: "carto-basemap-layer",
        type: "raster",
        source: "carto-basemap",
        minzoom: 0,
        maxzoom: 22,
        paint: isDark
          ? {
              "raster-opacity": 0.94,
              "raster-brightness-max": 0.82,
              "raster-contrast": 0.16,
            }
          : {
              "raster-opacity": 1.0,
            },
      },
    ],
  };
}

export default function MapCanvasInner({
  variant = "light", // "light" | "dark"
  showMarkers = false,
  showEvacuation = false,
  showHistorical = false,
  zoom = 14,
  className = "",
  interactive = true,
  horizon = 62,
  center,
  marker,
  userLocation,
  crowdReports = [],
  customEvacuationRoute,
  onMapClick,
  highRiskCoordinate,
  highRiskCoordinates,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const roadsDataRef = useRef(null);
  const popupRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const crowdMarkersRef = useRef([]);
  const shelterMarkerRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const resizeObserverRef = useRef(null);
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

  // Apply dynamic spatial filtering on real local roads GeoJSON with continuous LightGBM risk gradient
  const evaluateRoadFlooding = useCallback(
    (rawGeojson) => {
      if (!rawGeojson || !rawGeojson.features) return null;

      const riskPoints = getRiskCoordinates();
      // Radius expands with horizon slider (350m - 850m)
      const floodThresholdMeters = 350 + (horizon / 100) * 500;
      // Degrees bounding box buffer for fast polyline pre-filtering (~1.2km)
      const degBuffer = (floodThresholdMeters + 300) / 111320.0;
      const rainIntensity = Math.max(0.05, Math.min(1.0, horizon / 100.0));

      const updatedFeatures = rawGeojson.features.map((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!coords || feature.geometry?.type !== "LineString" || coords.length < 2) {
          return feature;
        }

        // Fast bounding box rejection test
        let minRoadLon = Infinity, maxRoadLon = -Infinity;
        let minRoadLat = Infinity, maxRoadLat = -Infinity;
        for (let i = 0; i < coords.length; i++) {
          const lon = coords[i][0];
          const lat = coords[i][1];
          if (lon < minRoadLon) minRoadLon = lon;
          if (lon > maxRoadLon) maxRoadLon = lon;
          if (lat < minRoadLat) minRoadLat = lat;
          if (lat > maxRoadLat) maxRoadLat = lat;
        }

        let minDistance = Infinity;
        for (const pt of riskPoints) {
          if (
            pt.lng < minRoadLon - degBuffer ||
            pt.lng > maxRoadLon + degBuffer ||
            pt.lat < minRoadLat - degBuffer ||
            pt.lat > maxRoadLat + degBuffer
          ) {
            continue;
          }

          const d = minDistanceToPolylineMeters(pt.lat, pt.lng, coords);
          if (d < minDistance) minDistance = d;
        }

        // Base continuous risk score from LightGBM model if available on feature
        const baseScore = typeof feature.properties?.risk_score === "number"
          ? feature.properties.risk_score
          : 0.0;

        // Continuous proximity gradient: 1.0 at epicenter decaying smoothly to 0.0 at threshold
        const proximityFactor = minDistance <= floodThresholdMeters
          ? Math.max(0.0, 1.0 - minDistance / floodThresholdMeters)
          : 0.0;

        // Calculate continuous dynamic risk_score float in [0.0, 1.0]
        let dynamicScore = 0.0;
        if (proximityFactor > 0) {
          const epicenterFactor = Math.pow(proximityFactor, 1.15);
          dynamicScore = Math.max(
            baseScore * rainIntensity,
            epicenterFactor * (0.28 + 0.72 * rainIntensity)
          );
        } else {
          dynamicScore = baseScore * Math.max(0.05, rainIntensity);
        }
        dynamicScore = Math.max(0.0, Math.min(1.0, dynamicScore));

        const riskScoreFloat = parseFloat(dynamicScore.toFixed(4));
        const isFlooded = riskScoreFloat >= 0.30;
        const floodSeverity = (riskScoreFloat * 2.4).toFixed(2);
        const riskTier = riskScoreFloat >= 0.85
          ? "CRITICAL"
          : riskScoreFloat >= 0.60
          ? "HIGH"
          : riskScoreFloat >= 0.30
          ? "MODERATE"
          : "LOW";

        return {
          ...feature,
          properties: {
            ...feature.properties,
            risk_score: riskScoreFloat,
            is_flooded: isFlooded,
            distance_to_risk_m: isFinite(minDistance) ? Math.round(minDistance) : 9999,
            flood_depth_m: floodSeverity,
            risk_tier: riskTier,
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

    const map = new maplibregl.Map({
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
      map.resize();

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

            // Layer 1: Ambient Risk Glow for Inundated Roads (triggers when risk_score >= 0.3)
            map.addLayer({
              id: "local-roads-flooded-glow",
              type: "line",
              source: "local-roads",
              filter: [">=", ["coalesce", ["get", "risk_score"], 0.0], 0.3],
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "risk_score"], 0.0],
                  0.3, "#f59e0b",
                  0.6, "#f97316",
                  0.85, "#ef4444",
                  1.0, "#7c3aed",
                ],
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "risk_score"], 0.0],
                  0.3, 5.0,
                  0.6, 7.5,
                  0.85, 10.0,
                  1.0, 13.0,
                ],
                "line-opacity": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "risk_score"], 0.0],
                  0.3, 0.25,
                  0.6, 0.35,
                  0.85, 0.45,
                  1.0, 0.55,
                ],
                "line-blur": 2.5,
              },
            });

            // Layer 2: Main Vector Road Layer with 4-Step Continuous LightGBM Risk Gradient
            // 0.3: Yellow/amber (minor), 0.6: Orange (moderate), 0.85: Red (severe), 1.0: Deep purple/black (critical)
            // line-width scales smoothly from 1.6px to 6.0px
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
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "risk_score"], 0.0],
                  0.0, dark ? "#475569" : "#94a3b8", // Muted dark gray for unflooded (<0.3)
                  0.3, "#f59e0b", // Yellow/amber for minor waterlogging
                  0.6, "#f97316", // Orange for moderate flooding
                  0.85, "#ef4444", // Red for severe flooding
                  1.0, "#3b0764", // Deep purple/black for critical inundation
                ],
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "risk_score"], 0.0],
                  0.0, 1.6,
                  0.3, 2.2,
                  0.6, 3.6,
                  0.85, 4.8,
                  1.0, 6.0,
                ],
                "line-opacity": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "risk_score"], 0.0],
                  0.0, dark ? 0.65 : 0.5,
                  0.3, 0.82,
                  0.6, 0.92,
                  0.85, 0.98,
                  1.0, 1.0,
                ],
              },
            });

            // Interactive popup on hover/click over road segments
            popupRef.current = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: "flood-road-popup",
            });

            map.on("mouseenter", "local-roads-vector", (e) => {
              map.getCanvas().style.cursor = "pointer";
              if (e.features && e.features.length > 0) {
                const f = e.features[0];
                const p = f.properties;
                const riskScore = typeof p.risk_score === "number" ? p.risk_score : 0.0;
                const roadName = p.name || p.id || "Road Segment";
                const locality = p.locality || "Hyderabad Region";

                let statusBadge = "";
                let borderColor = "#334155";
                if (riskScore >= 0.85) {
                  statusBadge = `<span style="color:#d8b4fe;font-weight:700;">🟣 CRITICAL INUNDATION (${(riskScore * 100).toFixed(1)}%)</span>`;
                  borderColor = "#6b21a8";
                } else if (riskScore >= 0.60) {
                  statusBadge = `<span style="color:#f87171;font-weight:700;">🔴 SEVERE FLOODING (${(riskScore * 100).toFixed(1)}%)</span>`;
                  borderColor = "#b91c1c";
                } else if (riskScore >= 0.30) {
                  statusBadge = `<span style="color:#fb923c;font-weight:700;">🟠 MODERATE FLOODING (${(riskScore * 100).toFixed(1)}%)</span>`;
                  borderColor = "#c2410c";
                } else if (riskScore > 0.10) {
                  statusBadge = `<span style="color:#fde047;font-weight:600;">🟡 MINOR WATERLOGGING (${(riskScore * 100).toFixed(1)}%)</span>`;
                  borderColor = "#a16207";
                } else {
                  statusBadge = `<span style="color:#10b981;font-weight:600;">🟢 CLEAR (Passable)</span>`;
                  borderColor = "#047857";
                }

                const depthInfo = riskScore >= 0.30
                  ? `<div style="font-size:11px;color:#cbd5e1;margin-top:3px;">Water Depth: <b>~${p.flood_depth_m}m</b> | Drain Dist: ${p.distance_to_risk_m || p.drain_distance_m || 0}m</div>`
                  : `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">Drain / Risk Dist: ${p.distance_to_risk_m || p.drain_distance_m || 0}m</div>`;

                popupRef.current
                  .setLngLat(e.lngLat)
                  .setHTML(
                    `<div style="font-family:system-ui,sans-serif;padding:7px 10px;font-size:12px;background:#0f172a;color:#f8fafc;border-radius:8px;border:1.5px solid ${borderColor};box-shadow:0 6px 16px rgba(0,0,0,0.6);">
                      <div style="font-weight:600;margin-bottom:2px;font-size:13px;">${roadName}</div>
                      <div style="font-size:11px;color:#94a3b8;margin-bottom:5px;">${locality}</div>
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

      // Evacuation route layer (either custom or default mock)
      const activeEvacRoute = (customEvacuationRoute && customEvacuationRoute.route_waypoints) || (showEvacuation ? evacuationRoute : null);
      if (activeEvacRoute && activeEvacRoute.length > 1) {
        const evacCoords = activeEvacRoute.map((p) => [p[1], p[0]]);
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
              "line-width": 4.5,
              "line-dasharray": [2, 2],
            },
          });
        }
      }

      // Historical flood zones layer (Oct 2020)
      if (!map.getSource("historical-flood-zones")) {
        const histZonesGeoJSON = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "Musi River Basin (Oct 2020)", depth: "2.8m Peak" },
              geometry: { type: "Point", coordinates: [78.4800, 17.3700] }
            },
            {
              type: "Feature",
              properties: { name: "Nadeem Colony Tolichowki (Oct 2020)", depth: "2.3m Peak" },
              geometry: { type: "Point", coordinates: [78.4100, 17.3950] }
            },
            {
              type: "Feature",
              properties: { name: "Ghatkesar Retention Basin (Oct 2020)", depth: "1.9m Peak" },
              geometry: { type: "Point", coordinates: [78.6810, 17.4948] }
            },
            {
              type: "Feature",
              properties: { name: "Begumpet Nala (Oct 2020)", depth: "1.6m Peak" },
              geometry: { type: "Point", coordinates: [78.4720, 17.4440] }
            }
          ]
        };

        map.addSource("historical-flood-zones", {
          type: "geojson",
          data: histZonesGeoJSON,
        });

        map.addLayer({
          id: "historical-flood-zones-layer",
          type: "circle",
          source: "historical-flood-zones",
          layout: { visibility: showHistorical ? "visible" : "none" },
          paint: {
            "circle-radius": 28,
            "circle-color": "#a855f7",
            "circle-opacity": 0.45,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#c084fc",
          }
        });
      }

      // Map click handler for interactive coordinate selection
      if (onMapClick) {
        map.on("click", (e) => {
          onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
      }
    });

    // ResizeObserver ensures canvas keeps full width/height when containers resize
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (popupRef.current) popupRef.current.remove();
      if (markerInstanceRef.current) markerInstanceRef.current.remove();
      if (userMarkerRef.current) userMarkerRef.current.remove();
      if (shelterMarkerRef.current) shelterMarkerRef.current.remove();
      crowdMarkersRef.current.forEach((m) => m.remove());
      crowdMarkersRef.current = [];
      poiMarkersRef.current.forEach((m) => m.remove());
      poiMarkersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [dark]);

  // Update historical flood layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const layer = mapRef.current.getLayer("historical-flood-zones-layer");
    if (layer) {
      mapRef.current.setLayoutProperty(
        "historical-flood-zones-layer",
        "visibility",
        showHistorical ? "visible" : "none"
      );
    }
  }, [showHistorical, mapLoaded]);

  // Update custom evacuation route
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource("evacuation-route");
    const activeRoute = (customEvacuationRoute && customEvacuationRoute.route_waypoints) || (showEvacuation ? evacuationRoute : null);
    if (source && activeRoute && activeRoute.length > 1) {
      const evacCoords = activeRoute.map((p) => [p[1], p[0]]);
      source.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: evacCoords },
      });
    }

    // Add shelter destination pin if custom evacuation route provided
    if (customEvacuationRoute && customEvacuationRoute.shelter_coordinates) {
      if (shelterMarkerRef.current) {
        shelterMarkerRef.current.remove();
        shelterMarkerRef.current = null;
      }
      const [sLat, sLon] = customEvacuationRoute.shelter_coordinates;
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="background:#0284c7;color:#fff;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;border:2px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;gap:4px;">
          <span>🛡️ Shelter</span>
        </div>
      `;
      shelterMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([sLon, sLat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setText(customEvacuationRoute.shelter_name || "Emergency Shelter"))
        .addTo(mapRef.current);
    }
  }, [customEvacuationRoute, showEvacuation, mapLoaded]);

  // Render User Location Pinpoint Marker with real risk score & contributing factors
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation || typeof userLocation.lat !== "number") return;

    const score = typeof userLocation.riskScore === "number" ? userLocation.riskScore : 0.0;
    const tier = userLocation.riskTier || (score >= 0.75 ? "CRITICAL" : score >= 0.5 ? "HIGH" : score >= 0.25 ? "MODERATE" : "LOW");
    const color = tier === "CRITICAL" ? "#ef4444" : tier === "HIGH" ? "#f97316" : tier === "MODERATE" ? "#eab308" : "#10b981";

    const el = document.createElement("div");
    el.className = "user-location-pinpoint";
    el.style.width = "32px";
    el.style.height = "32px";
    el.style.position = "relative";
    el.style.cursor = "pointer";

    el.innerHTML = `
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.4;animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position:relative;width:18px;height:18px;top:7px;left:7px;border-radius:50%;background:${color};border:3px solid #ffffff;box-shadow:0 0 12px ${color};"></div>
    `;

    // Rich popup card with factors & advisory
    const factors = userLocation.contributingFactors || {};
    const popupContent = `
      <div style="font-family:system-ui,sans-serif;padding:10px 12px;font-size:12px;background:#0f172a;color:#f8fafc;border-radius:10px;border:1.5px solid ${color};box-shadow:0 8px 24px rgba(0,0,0,0.65);max-width:260px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center;">
          <span>📍 ${userLocation.label || 'Your Location'}</span>
          <span style="background:${color}25;color:${color};font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;border:1px solid ${color}40;">${tier}</span>
        </div>
        <div style="font-size:10.5px;color:#94a3b8;margin-bottom:8px;">${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}</div>
        <div style="background:#1e293b;padding:6px 8px;border-radius:6px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px;">
            <span style="color:#94a3b8;">Susceptibility:</span>
            <span style="font-weight:800;color:${color};">${(score * 100).toFixed(1)}%</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;color:#cbd5e1;border-top:1px solid #334155;padding-top:4px;">
            <div>Rain: <b>${factors.total_rainfall_mm ?? horizon}mm</b></div>
            <div>Elev: <b>${factors.elevation ? factors.elevation.toFixed(0) : '--'}m</b></div>
            <div>Slope: <b>${factors.slope ? factors.slope.toFixed(1) : '--'}°</b></div>
            <div>Drain: <b>${factors.dist_to_stream ? factors.dist_to_stream.toFixed(0) : '--'}m</b></div>
          </div>
        </div>
        ${userLocation.advisory ? `<div style="font-size:11px;color:#cbd5e1;line-height:1.4;">${userLocation.advisory.slice(0, 120)}...</div>` : ''}
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 16, className: "user-loc-popup" }).setHTML(popupContent);

    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .setPopup(popup)
      .addTo(mapRef.current);
  }, [userLocation, mapLoaded, horizon]);

  // Render Crowd-Sourced Waterlogging markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    crowdMarkersRef.current.forEach((m) => m.remove());
    crowdMarkersRef.current = [];

    if (!crowdReports || crowdReports.length === 0) return;

    crowdReports.forEach((report) => {
      const el = document.createElement("div");
      el.className = "crowd-report-marker";
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = report.water_depth === "Submerged" ? "#7c3aed" : report.water_depth === "Waist" ? "#dc2626" : report.water_depth === "Knee" ? "#ea580c" : "#3b82f6";
      el.style.border = "2px solid #ffffff";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "10px";
      el.style.cursor = "pointer";
      el.innerHTML = "💧";

      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;padding:7px 9px;background:#0f172a;color:#fff;border-radius:8px;border:1px solid #3b82f6;font-size:11.5px;max-width:210px;">
          <div style="font-weight:700;color:#60a5fa;margin-bottom:2px;">💧 Waterlogging Pin</div>
          <div style="font-weight:600;font-size:12px;">${report.location_name || 'Reported Point'}</div>
          <div style="font-size:11px;color:#f59e0b;margin-top:2px;">Depth: <b>${report.water_depth}</b></div>
          ${report.description ? `<div style="font-size:10.5px;color:#cbd5e1;margin-top:4px;">"${report.description}"</div>` : ''}
          <div style="font-size:9.5px;color:#64748b;margin-top:4px;">Community Verified: ${report.verified ? 'Yes' : 'Pending'}</div>
        </div>
      `;

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([report.longitude, report.latitude])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(mapRef.current);

      crowdMarkersRef.current.push(m);
    });
  }, [crowdReports, mapLoaded]);

  // Responsive map resizing when container dimensions change (mobile 60vh <-> desktop, orientation change, window resize)
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [mapLoaded]);

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

    const m = new maplibregl.Marker({ element: el })
      .setLngLat([activeMarker.lng, activeMarker.lat])
      .addTo(mapRef.current);

    if (activeMarker.label) {
      const p = new maplibregl.Popup({ offset: 14 }).setText(activeMarker.label);
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

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setText(poi.label || poi.id))
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
        .maplibregl-map,
        .mapboxgl-map {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          inset: 0 !important;
        }
        .maplibregl-canvas,
        .mapboxgl-canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .maplibregl-popup-content,
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .maplibregl-popup-tip,
        .mapboxgl-popup-tip {
          border-top-color: #0f172a !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
      />

      {/* On-Map 4-Step Risk Gradient Legend */}
      <div className="pointer-events-none absolute bottom-5 left-4 z-[300] hidden sm:flex flex-col gap-1.5 rounded-xl border border-white/10 bg-slate-900/90 p-2.5 shadow-xl backdrop-blur-md text-[11px] text-slate-300">
        <div className="font-semibold text-white flex items-center justify-between gap-4">
          <span>Inundation Risk Gradient</span>
          <span className="text-[10px] text-slate-400 font-mono">LightGBM</span>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="h-2 w-36 rounded-full bg-gradient-to-r from-slate-600 via-[#f59e0b] via-[#f97316] via-[#ef4444] to-[#3b0764] border border-white/10" />
        </div>
        <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-medium gap-2">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />0.3 Minor</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#f97316]" />0.6 Mod</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />0.85 Sev</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#3b0764]" />1.0 Crit</span>
        </div>
      </div>
    </div>
  );
}
