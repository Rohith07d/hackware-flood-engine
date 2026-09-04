"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CENTER, floodZone, severeZone, evacuationRoute, mapMarkers } from "../data/floodData.js";

const markerColors = {
  gauge: "#f5b942",
  infrastructure: "#2dd4bf",
  police: "#4d8bf5",
  critical: "#e2483d",
};

// Spatial bounding box of Hyderabad flood susceptibility raster derived from real DEM
const SUSCEPTIBILITY_BOUNDS = [
  [16.99930555555556, 77.99986111111112],
  [18.00013888888889, 79.00069444444445],
];

export default function MapCanvasInner({
  variant = "light", // "light" | "dark"
  showMarkers = false,
  showEvacuation = false,
  showOverlay = true,
  overlayOpacity = 0.65,
  zoom = 14,
  className = "",
  interactive = true,
  horizon = 62,
  center,
  marker,
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const severeZoneRef = useRef(null);
  const floodZoneRef = useRef(null);
  const dark = variant === "dark";

  useEffect(() => {
    if (!containerRef.current) return;

    // Tear down any existing Leaflet map on this container to prevent "Map container is already initialized"
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (containerRef.current._leaflet_id) {
      containerRef.current._leaflet_id = null;
    }

    const map = L.map(containerRef.current, {
      center: center || CENTER,
      zoom: zoom,
      zoomControl: false,
      scrollWheelZoom: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    });
    mapInstanceRef.current = map;

    // TileLayer (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Real LightGBM AI Flood Susceptibility Overlay Raster
    if (showOverlay) {
      L.imageOverlay("/flood_overlay.png", SUSCEPTIBILITY_BOUNDS, {
        opacity: overlayOpacity,
        zIndex: 5,
      }).addTo(map);
    }

    // Moderate risk outer zone
    floodZoneRef.current = L.polygon(floodZone, {
      color: "#e2483d",
      weight: 1.5,
      fillColor: "#e2483d",
      fillOpacity: dark ? 0.22 : 0.26,
    }).addTo(map);

    // Severe risk inner zone
    severeZoneRef.current = L.polygon(severeZone, {
      color: "#a3172e",
      weight: 1.5,
      fillColor: "#a3172e",
      fillOpacity: dark ? 0.38 : 0.42,
    }).addTo(map);

    // Evacuation route
    if (showEvacuation) {
      L.polyline(evacuationRoute, {
        color: "#1493ab",
        weight: 4,
        dashArray: "1 10",
        lineCap: "round",
      }).addTo(map);
    }

    // Dynamic marker
    if (marker) {
      const circle = L.circleMarker([marker.lat, marker.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#e2483d",
        fillOpacity: 1,
      });
      if (marker.label) {
        circle.bindTooltip(marker.label, { direction: "top", offset: [0, -8] });
      }
      circle.addTo(map);
    }

    // Markers
    if (showMarkers && mapMarkers && mapMarkers.length > 0) {
      mapMarkers.forEach((m) => {
        const marker = L.circleMarker([m.lat, m.lng], {
          radius: 6,
          color: dark ? "#0a0f1a" : "#ffffff",
          weight: 2,
          fillColor: markerColors[m.type] || "#ffffff",
          fillOpacity: 1,
        });
        marker.bindTooltip(m.label, { direction: "top", offset: [0, -6] });
        marker.addTo(map);
      });
    }

    // Invalidate size once container layout stabilizes
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
  }, [dark, zoom, interactive, showEvacuation, showMarkers, showOverlay, overlayOpacity, center ? center.join(',') : '', marker ? `${marker.lat},${marker.lng}` : '']);

  useEffect(() => {
    if (!severeZoneRef.current || !floodZoneRef.current) return;
    
    // Determine the offset to translate polygons to the searched center
    const targetCenter = center || CENTER;
    const latOffset = targetCenter[0] - CENTER[0];
    const lngOffset = targetCenter[1] - CENTER[1];
    
    // Scale factor based on horizon (0 to 100)
    const factor = 0.5 + (horizon / 100) * 1.5;
    
    const scaledSevereZone = severeZone.map(([lat, lng]) => [
      targetCenter[0] + (lat + latOffset - targetCenter[0]) * factor,
      targetCenter[1] + (lng + lngOffset - targetCenter[1]) * factor,
    ]);
    
    const scaledFloodZone = floodZone.map(([lat, lng]) => [
      targetCenter[0] + (lat + latOffset - targetCenter[0]) * factor,
      targetCenter[1] + (lng + lngOffset - targetCenter[1]) * factor,
    ]);
    
    severeZoneRef.current.setLatLngs(scaledSevereZone);
    floodZoneRef.current.setLatLngs(scaledFloodZone);
    
    const intensity = Math.min(1, Math.max(0, horizon / 100));
    
    // Inner polygon transitions from orange (#f5b942) to severe red (#a3172e)
    const rInner = Math.round(245 - (245 - 163) * intensity);
    const gInner = Math.round(185 - (185 - 23) * intensity);
    const bInner = Math.round(66 - (66 - 46) * intensity);
    
    const innerColor = `rgb(${rInner}, ${gInner}, ${bInner})`;
    severeZoneRef.current.setStyle({
      color: innerColor,
      fillColor: innerColor,
      fillOpacity: dark ? 0.2 + 0.5 * intensity : 0.3 + 0.5 * intensity,
    });
    
    // Outer polygon transitions from yellow/orange to moderate red (#e2483d)
    const rOuter = Math.round(250 - (250 - 226) * intensity);
    const gOuter = Math.round(204 - (204 - 72) * intensity);
    const bOuter = Math.round(21 - (21 - 61) * intensity);
    
    const outerColor = `rgb(${rOuter}, ${gOuter}, ${bOuter})`;
    floodZoneRef.current.setStyle({
      color: outerColor,
      fillColor: outerColor,
      fillOpacity: dark ? 0.15 + 0.3 * intensity : 0.2 + 0.3 * intensity,
    });
    
  }, [horizon, dark, center ? center.join(',') : '']);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className={`h-full w-full ${dark ? "map-dark" : ""}`}
        style={{ minHeight: "100%", width: "100%" }}
      />
    </div>
  );
}
