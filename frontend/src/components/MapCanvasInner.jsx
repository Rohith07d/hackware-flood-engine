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

export default function MapCanvasInner({
  variant = "light", // "light" | "dark"
  showMarkers = false,
  showEvacuation = false,
  zoom = 14,
  className = "",
  interactive = true,
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
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
      center: CENTER,
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

    // Moderate risk outer zone
    L.polygon(floodZone, {
      color: "#e2483d",
      weight: 1.5,
      fillColor: "#e2483d",
      fillOpacity: dark ? 0.28 : 0.32,
    }).addTo(map);

    // Severe risk inner zone
    L.polygon(severeZone, {
      color: "#a3172e",
      weight: 1.5,
      fillColor: "#a3172e",
      fillOpacity: dark ? 0.45 : 0.5,
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
  }, [dark, zoom, interactive, showEvacuation, showMarkers]);

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
