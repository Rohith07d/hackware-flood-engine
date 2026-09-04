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

export async function analyzeArea(params) {
  try {
    const res = await fetch(`${API_BASE_URL}/analyze-area`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Area analysis failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error("analyzeArea error:", err);
    return null;
  }
}

export async function fetchFeatherlessHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health/featherless`);
    if (!res.ok) throw new Error(`Featherless health check failed (${res.status})`);
    return await res.json();
  } catch (err) {
    return { status: "error", connected: false, message: err.message };
  }
}

export async function fetchSearchSuggestions(query = "") {
  try {
    const res = await fetch(`${API_BASE_URL}/search-suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch (err) {
    console.error("fetchSearchSuggestions error:", err);
    return [];
  }
}

export async function searchAreaWithAI(query, rainfall_mm = 65) {
  try {
    const res = await fetch(`${API_BASE_URL}/search-area`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, rainfall_mm }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Search area failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error("searchAreaWithAI error:", err);
    return null;
  }
}

