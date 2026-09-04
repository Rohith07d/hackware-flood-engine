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

export async function fetchFfsSnapshot(latitude = 17.4948, longitude = 78.681) {
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
