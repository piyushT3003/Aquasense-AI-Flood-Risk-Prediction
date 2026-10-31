/**
 * AquaSense Frontend API Service
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000/api";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "SEVERE";

// Every request carries the viewer's role; the backend blocks control actions for "Citizen".
let currentRole = "Disaster Management Officer";
export const setApiRole = (role: string) => { currentRole = role; };
function apiFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "X-AquaSense-Role": currentRole } });
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
  const res = await apiFetch(`${API_BASE}/zones`);
  if (!res.ok) throw new Error(`zones ${res.status}`);
  const data = await res.json();
  return data.zones || [];
}

export async function fetchCurrentRisk(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/risk/current`);
  return res.json();
}

export async function fetchRiskForecast(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/risk/forecast`);
  return res.json();
}

export async function fetchCurrentRainfall(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/rainfall/current`);
  return res.json();
}

export async function fetchRainfallForecast(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/rainfall/forecast`);
  return res.json();
}

export async function fetchSensors(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/sensors`);
  return res.json();
}

export async function fetchSatellite(): Promise<SatelliteObservation> {
  const res = await apiFetch(`${API_BASE}/satellite`);
  return res.json();
}

export async function fetchAlerts(status?: string): Promise<{ alerts: AlertItem[]; active_count: number }> {
  const url = status ? `${API_BASE}/alerts?status=${status}` : `${API_BASE}/alerts`;
  const res = await apiFetch(url);
  return res.json();
}

export async function acknowledgeAlert(alertId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: "POST" });
  return res.json();
}

export async function escalateAlert(alertId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/alerts/${alertId}/escalate`, { method: "POST" });
  return res.json();
}

export async function resolveAlert(alertId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/alerts/${alertId}/resolve`, { method: "POST" });
  return res.json();
}

export async function runWhatIfScenario(payload: WhatIfParams): Promise<WhatIfScenarioResult> {
  const res = await apiFetch(`${API_BASE}/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchInfrastructure(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE}/infrastructure`);
  const data = await res.json();
  return data.infrastructure || [];
}

export async function fetchLakes(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE}/lakes`);
  const data = await res.json();
  return data.lakes || [];
}

export async function fetchDrains(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE}/drains`);
  const data = await res.json();
  return data.drains || [];
}

export async function fetchHistoricalEvents(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/historical-events`);
  const data = await res.json();
  return data.event;
}

export async function fetchSystemHealth(): Promise<{ status: string; components: SystemHealthItem[] }> {
  const res = await apiFetch(`${API_BASE}/system-health`);
  return res.json();
}

export async function fetchDataQuality(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/data-quality`);
  return res.json();
}

export async function queryGenAI(query: string, role: string = "Disaster Management Officer"): Promise<GenAIResponse> {
  let gemini_api_key: string | null = null;
  try { gemini_api_key = localStorage.getItem("AQUASENSE_GEMINI_API_KEY"); } catch { /* storage blocked */ }
  const res = await apiFetch(`${API_BASE}/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, role, gemini_api_key: gemini_api_key || null })
  });
  if (!res.ok) throw new Error(`AI query failed (${res.status})`);
  return res.json();
}

export async function controlSimulation(action: "start" | "pause" | "reset" | "storm_mode" | "speed", value?: number): Promise<any> {
  const q = value !== undefined ? `&value=${value}` : "";
  const res = await apiFetch(`${API_BASE}/simulation/control?action=${action}${q}`, { method: "POST" });
  return res.json();
}

export async function fetchThreats(): Promise<{ sim_time: string; threats: Threat[] }> {
  const res = await apiFetch(`${API_BASE}/threats`);
  return res.json();
}

export async function fetchVerification(): Promise<Verification> {
  const res = await apiFetch(`${API_BASE}/verification`);
  return res.json();
}

export async function fetchModel(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/model`);
  return res.json();
}

export async function fetchBacktest(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/backtest/2022`);
  return res.json();
}

export async function fetchRainfallTimeline(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/rainfall/timeline`);
  if (!res.ok) throw new Error(`rainfall ${res.status}`);
  return res.json();
}

export async function fetchAIStatus(): Promise<{ provider: string | null; model: string | null; configured: boolean; last_error: string | null; last_success: string | null }> {
  const res = await apiFetch(`${API_BASE}/ai/status`);
  return res.json();
}

export async function fetchDataSource(): Promise<{ mode: string; error: string | null }> {
  const res = await apiFetch(`${API_BASE}/data-source`);
  return res.json();
}

export async function setDataSource(mode: "simulator" | "open-meteo"): Promise<{ mode: string; error: string | null }> {
  const res = await apiFetch(`${API_BASE}/data-source?mode=${mode}`, { method: "POST" });
  return res.json();
}

export async function fetchSimulationState(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/simulation/state`);
  return res.json();
}
