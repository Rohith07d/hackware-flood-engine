// Mock data standing in for the AI flood-prediction backend.
// Centered on Ghatkesar, Telangana as a realistic reference point.

export const CENTER = [17.4948, 78.681];

export const currentRisk = {
  level: "high", // low | moderate | high | severe
  waterDepthMin: 0.6,
  waterDepthMax: 1.1,
  etaHours: 2,
  confidence: 84,
  location: "Ghatkesar Main Road",
};

export const riskLevelMeta = {
  low: { label: "Low Risk", color: "#2dd4bf" },
  moderate: { label: "Moderate Risk", color: "#f5b942" },
  high: { label: "High Risk", color: "#e2483d" },
  severe: { label: "Severe Risk", color: "#a3172e" },
};

// Rough polygon outlining a flood-prone stretch near the center point.
export const floodZone = [
  [17.5008, 78.672],
  [17.5015, 78.6795],
  [17.499, 78.6865],
  [17.4935, 78.6895],
  [17.4885, 78.686],
  [17.4875, 78.6795],
  [17.4905, 78.6735],
  [17.496, 78.671],
];

export const severeZone = [
  [17.4975, 78.6785],
  [17.4978, 78.6835],
  [17.4945, 78.6858],
  [17.4915, 78.6825],
  [17.4925, 78.6775],
  [17.4955, 78.676],
];

export const evacuationRoute = [
  [17.4948, 78.681],
  [17.499, 78.6865],
  [17.5035, 78.691],
  [17.508, 78.696],
];

export const predictionDrivers = [
  { label: "Rainfall", value: 88, unit: "mm", bars: [3, 4, 5, 6, 5, 7, 8, 6, 7, 8] },
  { label: "River Level", value: 4.8, unit: "m", bars: [2, 2, 3, 4, 5, 6, 7, 7, 8, 8] },
  { label: "Terrain Elevation (DEM)", value: null, unit: "", bars: [8, 7, 6, 5, 4, 5, 4, 3, 4, 5] },
  { label: "Historical Pattern Match", value: 88, unit: "%", bars: [4, 5, 5, 6, 6, 7, 7, 8, 8, 8] },
];

export const dashboardStats = {
  affectedArea: "5.2 km²",
  maxDepth: "2.4 m",
  highRiskStreets: 31,
  confidence: "94%",
};

// type: gauge | infrastructure | police | critical | risk
export const mapMarkers = [
  { id: "g1", type: "gauge", lat: 17.5045, lng: 78.6705, label: "Musi River Gauge — Ghatkesar" },
  { id: "g2", type: "gauge", lat: 17.499, lng: 78.6665, label: "Upstream Gauge — Bibinagar Rd" },
  { id: "g3", type: "gauge", lat: 17.4855, lng: 78.678, label: "Downstream Gauge — Keesara" },
  { id: "i1", type: "infrastructure", lat: 17.502, lng: 78.6825, label: "Pump Station 04" },
  { id: "i2", type: "infrastructure", lat: 17.4925, lng: 78.691, label: "Retention Basin" },
  { id: "p1", type: "police", lat: 17.4965, lng: 78.684, label: "Ghatkesar Police Station" },
  { id: "p2", type: "police", lat: 17.489, lng: 78.6745, label: "Traffic Outpost" },
  { id: "c1", type: "critical", lat: 17.4938, lng: 78.6795, label: "Community Hospital" },
  { id: "c2", type: "critical", lat: 17.5005, lng: 78.6875, label: "Govt. High School (Shelter)" },
  { id: "c3", type: "critical", lat: 17.4875, lng: 78.6825, label: "Electrical Substation" },
];
