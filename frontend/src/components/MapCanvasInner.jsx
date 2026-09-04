"use client";

import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { CENTER, floodZone, severeZone, evacuationRoute, mapMarkers } from "../data/floodData.js";

const markerColors = {
  gauge: "#f5b942",
  infrastructure: "#2dd4bf",
  police: "#4d8bf5",
  critical: "#e2483d",
};

function MarkerDot({ marker, dark }) {
  return (
    <CircleMarker
      center={[marker.lat, marker.lng]}
      radius={6}
      pathOptions={{
        color: dark ? "#0a0f1a" : "#ffffff",
        weight: 2,
        fillColor: markerColors[marker.type],
        fillOpacity: 1,
      }}
    >
      <Tooltip direction="top" offset={[0, -6]}>
        {marker.label}
      </Tooltip>
    </CircleMarker>
  );
}

export default function MapCanvasInner({
  variant = "light", // "light" | "dark"
  showMarkers = false,
  showEvacuation = false,
  zoom = 14,
  className = "",
  interactive = true,
}) {
  const dark = variant === "dark";

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <MapContainer
        center={CENTER}
        zoom={zoom}
        zoomControl={false}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        className={dark ? "map-dark" : ""}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Moderate risk outer zone */}
        <Polygon
          positions={floodZone}
          pathOptions={{
            color: "#e2483d",
            weight: 1.5,
            fillColor: "#e2483d",
            fillOpacity: dark ? 0.28 : 0.32,
          }}
        />

        {/* Severe risk inner zone */}
        <Polygon
          positions={severeZone}
          pathOptions={{
            color: "#a3172e",
            weight: 1.5,
            fillColor: "#a3172e",
            fillOpacity: dark ? 0.45 : 0.5,
          }}
        />

        {showEvacuation && (
          <Polyline
            positions={evacuationRoute}
            pathOptions={{ color: "#1493ab", weight: 4, dashArray: "1 10", lineCap: "round" }}
          />
        )}

        {showMarkers && mapMarkers.map((m) => <MarkerDot key={m.id} marker={m} dark={dark} />)}
      </MapContainer>
    </div>
  );
}
