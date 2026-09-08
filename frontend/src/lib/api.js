import { API_BASE_URL } from "./constants";

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchModelStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/model/status`);
    if (!res.ok) throw new Error(`Model status failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchHazardMapMetadata() {
  try {
    const res = await fetch(`${API_BASE_URL}/hazard-map/metadata`);
    if (!res.ok) throw new Error(`Hazard map metadata failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchRainfallTimeseries() {
  try {
    const res = await fetch(`${API_BASE_URL}/rainfall/timeseries`);
    if (!res.ok) throw new Error(`Rainfall timeseries failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function predictFlood(params) {
  try {
    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Prediction failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function evaluateHazard(params) {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluate-hazard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Hazard evaluation failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchFfsSnapshot(latitude = 17.4065, longitude = 78.4772) {
  try {
    const res = await fetch(`${API_BASE_URL}/ffs/snapshot?latitude=${latitude}&longitude=${longitude}`);
    if (!res.ok) throw new Error(`FFS snapshot failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchRecentAlerts() {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts`);
    if (!res.ok) throw new Error(`Fetch alerts failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function generateEmergencyAlert(params) {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Alert generation failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function analyzeArea(location, language = "en") {
  try {
    const res = await fetch(`${API_BASE_URL}/analyze-area`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, language }),
    });
    if (!res.ok) throw new Error(`Area analysis failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] analyzeArea error:", err);
    return null;
  }
}

export async function fetchLiveWeather(latitude = 17.4065, longitude = 78.4772) {
  try {
    const res = await fetch(`${API_BASE_URL}/weather/live?latitude=${latitude}&longitude=${longitude}`);
    if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] fetchLiveWeather error:", err);
    return null;
  }
}

export async function reverseGeocode(latitude, longitude) {
  try {
    const res = await fetch(`${API_BASE_URL}/reverse-geocode?latitude=${latitude}&longitude=${longitude}`);
    if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] reverseGeocode error:", err);
    return {
      latitude,
      longitude,
      address: `Coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      display_name: "Selected Location",
      is_in_coverage: true,
    };
  }
}

export async function fetchCrowdReports() {
  try {
    const res = await fetch(`${API_BASE_URL}/crowd-reports?limit=50`);
    if (!res.ok) throw new Error(`Crowd reports failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] fetchCrowdReports error:", err);
    return [];
  }
}

export async function submitCrowdReport(reportData) {
  try {
    const res = await fetch(`${API_BASE_URL}/crowd-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportData),
    });
    if (!res.ok) throw new Error(`Submit crowd report failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] submitCrowdReport error:", err);
    return null;
  }
}

export async function fetchEvacuationRoute(latitude, longitude) {
  try {
    const res = await fetch(`${API_BASE_URL}/evacuation-route?latitude=${latitude}&longitude=${longitude}`);
    if (!res.ok) throw new Error(`Evacuation route failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] fetchEvacuationRoute error:", err);
    return null;
  }
}

export async function subscribeAlerts(subscriptionData) {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscriptionData),
    });
    if (!res.ok) throw new Error(`Alert subscription failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] subscribeAlerts error:", err);
    return null;
  }
}

export async function fetchHistoricalFloodData() {
  try {
    const res = await fetch(`${API_BASE_URL}/historical/events`);
    if (!res.ok) throw new Error(`Historical data failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] fetchHistoricalFloodData error:", err);
    return null;
  }
}

export async function batchPredict(points) {
  try {
    const res = await fetch(`${API_BASE_URL}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });
    if (!res.ok) throw new Error(`Batch prediction failed (${res.status})`);
    return await res.json();
  } catch (err) {
    console.error("[api.js] batchPredict error:", err);
    return null;
  }
}

