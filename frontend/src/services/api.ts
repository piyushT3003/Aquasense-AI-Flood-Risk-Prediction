import { mockEngine } from "./mockEngine";

export const getApiBase = () => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("AQUASENSE_API_BASE");
    if (custom) return custom;
  }
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000/api";
};

const API_BASE = getApiBase();
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "SEVERE";

// Every request carries the viewer's role; the backend blocks control actions for "Citizen".
let currentRole = "Disaster Management Officer";
export const setApiRole = (role: string) => { currentRole = role; };

function shouldTryRemote(): boolean {
  if (typeof window === "undefined") return true;
  const base = getApiBase();
  // Mixed-content block: HTTPS site cannot call HTTP localhost
  if (window.location.protocol === "https:" && (base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost"))) {
    return false;
  }
  return true;
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...(init.headers as Record<string, string> | undefined), "X-AquaSense-Role": currentRole },
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
export const API_ROOT = API_BASE;

export interface ZoneCoordinates {
  lat: number;
  lng: number;
}

export interface FeatureContribution {
  feature_name: string;
  display_name: string;
  importance_score: number;
  direction: string;
  current_value_formatted: string;
}

export interface FloodPrediction {
  zone_id: string;
  zone_name: string;
  ward_number: number;
  flood_probability: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
  expected_window_hours: string;
  rainfall_1h_mm: number;
  rainfall_24h_mm: number;
  water_level_m: number;
  soil_saturation_pct: number;
  prediction_confidence: string;
  feature_contributions: FeatureContribution[];
  natural_explanation: string;
  data_freshness_seconds: number;
  last_updated: string;
  risk_score: number;            // banded 0-1 index used for colours and ranking
  forecast_6h_mm: number;
  peak_probability_24h: number;
  peak_level_24h: RiskLevel;
  peak_in_h: number;
  hours_to_high: number | null;
  hours_to_severe: number | null;
  trajectory: number[];          // risk score, now .. +48 h
  trajectory_probability: number[];
  observed_flooding: boolean;
  drain_load_pct: number;
}

export interface Zone {
  id: string;
  name: string;
  ward_number: number;
  zone_type: string;
  center: { lat: number; lng: number };
  elevation_m: number;
  slope_degrees: number;
  impervious_ratio: number;
  drainage_vulnerability: number;
  historical_flood_frequency: number;
  lake_proximity_m: number;
  primary_lake_name: string;
  critical_infrastructure_count: number;
  baseline_rain_mm: number;
  baseline_water_level_m: number;
  baseline_soil_sat: number;
  swd_basin: string;
  boundary_polygon: [number, number][];
  area_km2?: number;
  current_prediction?: FloodPrediction;
}

export interface AlertItem {
  id: string;
  zone_id: string;
  zone_name: string;
  ward_number: number;
  severity: "HIGH" | "SEVERE" | "CRITICAL";
  trigger_type: string;
  probability: number;
  rainfall_mm: number;
  water_level_m: number;
  expected_window: string;
  timestamp: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED";
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  lead_time_h?: number | null;
  top_driver?: string;
  government_message: string;
  citizen_message_en: string;
  citizen_message_kn: string;
}

export interface SensorReading {
  sensor_id: string;
  sensor_type: string;
  zone_id: string;
  location_name: string;
  value: number;
  unit: string;
  timestamp: string;
  status: string;
  is_anomaly: boolean;
  anomaly_reason?: string;
}

export interface SatelliteObservation {
  satellite_name: string;
  acquisition_time: string;
  observation_type: string;
  resolution_m: number;
  affected_corridors: string[];
  predicted_extent_sq_km: number;
  observed_extent_sq_km: number;
  spatial_overlap_iou: number | null;
  precision: number | null;
  recall: number | null;
  predicted_zones?: string[];
  observed_zones?: string[];
  layer_label: string;
  description: string;
}

export interface WhatIfParams {
  rainfall_intensity_mm_h: number;
  duration_hours: number;
  antecedent_rainfall_mm: number;
  drainage_capacity_pct: number;
  lake_fill_pct: number;
}

export interface WhatIfScenarioResult {
  scenario_id: string;
  baseline_affected_area_sq_km: number;
  scenario_affected_area_sq_km: number;
  drains_overflowing: number;
  baseline_high_risk_zones: number;
  baseline_severe_risk_zones: number;
  scenario_high_risk_zones: number;
  scenario_severe_risk_zones: number;
  delta_affected_area_sq_km: number;
  zone_deltas: {
    zone_id: string;
    zone_name: string;
    baseline_prob: number;
    baseline_risk: string;
    scenario_prob: number;
    scenario_risk: string;
    baseline_score: number;
    scenario_score: number;
    peak_hour: number;
    max_ponding_mm: number;
    max_drain_level_m: number;
    area_km2: number;
    prob_delta: number;
  }[];
  summary_insight: string;
}

export interface GenAIResponse {
  query: string;
  answer: string;
  data_sources_consulted: string[];
  confidence_level: string;
  relevant_zones: string[];
  timestamp: string;
}

export interface Threat {
  zone_id: string;
  zone_name: string;
  ward_number: number;
  current_level: RiskLevel;
  predicted_level: RiskLevel;
  probability_now: number;
  peak_probability: number;
  peak_in_h: number;
  hours_to_high: number | null;
  hours_to_severe: number | null;
  top_driver: string | null;
  trajectory: number[];
}

export interface Verification {
  flood_events: number;
  warned_in_advance: number;
  hit_rate_pct: number | null;
  median_lead_time_h: number | null;
  recent: { zone: string; zone_id: string; flooded_at: string; warned: boolean; lead_time_h: number | null }[];
}

export interface SystemHealthItem {
  component: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  latency_ms: number;
  records_processed: number;
  last_heartbeat: string;
  details: string;
}

// ---------------- API CALLS -----------------

export async function fetchZones(): Promise<Zone[]> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/zones`);
      if (res.ok) {
        const data = await res.json();
        if (data.zones && data.zones.length > 0) return data.zones;
      }
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getZones();
}

export async function fetchCurrentRisk(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/risk/current`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getCurrentRisk();
}

export async function fetchRiskForecast(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/risk/forecast`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return { zones: mockEngine.getZones() };
}

export async function fetchCurrentRainfall(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/rainfall/current`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getSensors();
}

export async function fetchRainfallForecast(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/rainfall/forecast`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getRainfallTimeline();
}

export async function fetchSensors(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/sensors`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getSensors();
}

export async function fetchSatellite(): Promise<SatelliteObservation> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/satellite`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return {
    satellite_name: "Sentinel-1 SAR / ESA Copernicus",
    acquisition_time: new Date().toISOString(),
    observation_type: "SAR Synthetic Aperture Radar",
    resolution_m: 10,
    affected_corridors: ["Outer Ring Road", "Koramangala Valley", "Bellandur Basin"],
    predicted_extent_sq_km: 18.4,
    observed_extent_sq_km: 16.9,
    spatial_overlap_iou: 0.86,
    precision: 0.89,
    recall: 0.91,
    layer_label: "SAR Water Extent Mask",
    description: "High-resolution satellite flood boundary mapping cross-verified with BBMP ground telemetry.",
  };
}

export async function fetchAlerts(status?: string): Promise<{ alerts: AlertItem[]; active_count: number }> {
  if (shouldTryRemote()) {
    try {
      const url = status ? `${getApiBase()}/alerts?status=${status}` : `${getApiBase()}/alerts`;
      const res = await apiFetch(url);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getAlerts();
}

export async function acknowledgeAlert(alertId: string): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/alerts/${alertId}/acknowledge`, { method: "POST" });
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.acknowledgeAlert(alertId);
}

export async function escalateAlert(alertId: string): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/alerts/${alertId}/escalate`, { method: "POST" });
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.escalateAlert(alertId);
}

export async function resolveAlert(alertId: string): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/alerts/${alertId}/resolve`, { method: "POST" });
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.resolveAlert(alertId);
}

export async function runWhatIfScenario(payload: WhatIfParams): Promise<WhatIfScenarioResult> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.runWhatIf(payload);
}

export async function fetchInfrastructure(): Promise<any[]> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/infrastructure`);
      if (res.ok) {
        const data = await res.json();
        return data.infrastructure || [];
      }
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getInfrastructure();
}

export async function fetchLakes(): Promise<any[]> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/lakes`);
      if (res.ok) {
        const data = await res.json();
        return data.lakes || [];
      }
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getLakes();
}

export async function fetchDrains(): Promise<any[]> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/drains`);
      if (res.ok) {
        const data = await res.json();
        return data.drains || [];
      }
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getDrains();
}

export async function fetchHistoricalEvents(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/historical-events`);
      if (res.ok) {
        const data = await res.json();
        return data.event;
      }
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getHistoricalEvents();
}

export async function fetchSystemHealth(): Promise<{ status: string; components: SystemHealthItem[] }> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/system-health`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getSystemHealth();
}

export async function fetchDataQuality(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/data-quality`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return { status: "EXCELLENT", completeness_pct: 99.4, spike_gate_anomalies_filtered: 14 };
}

export async function queryGenAI(query: string, role: string = "Disaster Management Officer"): Promise<GenAIResponse> {
  let gemini_api_key: string | null = null;
  try { gemini_api_key = localStorage.getItem("AQUASENSE_GEMINI_API_KEY"); } catch { /* storage blocked */ }
  gemini_api_key = gemini_api_key || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || null;

  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, role, gemini_api_key: gemini_api_key || null }),
      });
      if (res.ok) return await res.json();
    } catch { /* fallback to client-side Gemini */ }
  }

  return mockEngine.queryGemini(query, role, gemini_api_key);
}

export async function controlSimulation(action: "start" | "pause" | "reset" | "storm_mode" | "speed", value?: number): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const q = value !== undefined ? `&value=${value}` : "";
      const res = await apiFetch(`${getApiBase()}/simulation/control?action=${action}${q}`, { method: "POST" });
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.control(action, value);
}

export async function fetchThreats(): Promise<{ sim_time: string; threats: Threat[] }> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/threats`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getThreats();
}

export async function fetchVerification(): Promise<Verification> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/verification`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getVerification();
}

export async function fetchModel(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/model`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getModel();
}

export async function fetchBacktest(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/backtest/2022`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getHistoricalEvents();
}

export async function fetchRainfallTimeline(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/rainfall/timeline`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getRainfallTimeline();
}

export async function fetchAIStatus(): Promise<{ provider: string | null; model: string | null; configured: boolean; last_error: string | null; last_success: string | null }> {
  let key: string | null = null;
  try { key = localStorage.getItem("AQUASENSE_GEMINI_API_KEY"); } catch { /* ignore */ }
  key = key || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || null;

  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/ai/status`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }

  return {
    provider: key ? "gemini" : "grounded-template",
    model: key ? "gemini-2.5-flash" : "grounded-rules",
    configured: !!key,
    last_error: null,
    last_success: key ? new Date().toLocaleTimeString() : null,
  };
}

export async function fetchDataSource(): Promise<{ mode: string; error: string | null }> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/data-source`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return { mode: "simulator", error: null };
}

export async function setDataSource(mode: "simulator" | "open-meteo"): Promise<{ mode: string; error: string | null }> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/data-source?mode=${mode}`, { method: "POST" });
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return { mode, error: null };
}

export async function fetchSimulationState(): Promise<any> {
  if (shouldTryRemote()) {
    try {
      const res = await apiFetch(`${getApiBase()}/simulation/state`);
      if (res.ok) return await res.json();
    } catch { /* use mock fallback */ }
  }
  return mockEngine.getState();
}
