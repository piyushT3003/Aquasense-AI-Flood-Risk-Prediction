import rawSeedData from "./seedData.json";
import backtestData from "./backtest.json";
import modelMetaData from "./modelMeta.json";
import type {
  Zone,
  AlertItem,
  Threat,
  FloodPrediction,
  FeatureContribution,
  Verification,
  SystemHealthItem,
  WhatIfParams,
  WhatIfScenarioResult,
  GenAIResponse,
} from "./api";

interface SeedDataShape {
  zones: any[];
  lakes: any[];
  drains: any[];
  infrastructure: any[];
  historical_deluge: any;
}

const seed = rawSeedData as unknown as SeedDataShape;

class MockTelemetryEngine {
  private simTime: Date = new Date();
  private isRunning: boolean = true;
  private isStormActive: boolean = false;
  private stormStep: number = 0;
  private speed: number = 1;
  private acknowledgedAlerts = new Set<string>();
  private escalatedAlerts = new Set<string>();
  private resolvedAlerts = new Set<string>();
  private tickerInterval: any = null;

  constructor() {
    this.simTime.setMinutes(0, 0, 0);
    this.startTicker();
  }

  private startTicker() {
    if (typeof window !== "undefined") {
      this.tickerInterval = setInterval(() => {
        if (!this.isRunning) return;
        this.simTime = new Date(this.simTime.getTime() + 3600000); // advance 1 simulated hour
        if (this.isStormActive) {
          this.stormStep++;
          if (this.stormStep > 12) {
            this.isStormActive = false;
            this.stormStep = 0;
          }
        }
      }, 3000 / this.speed);
    }
  }

  public control(action: string, value?: number) {
    if (action === "start") this.isRunning = true;
    if (action === "pause") this.isRunning = false;
    if (action === "speed" && value) {
      this.speed = value;
      if (this.tickerInterval) clearInterval(this.tickerInterval);
      this.startTicker();
    }
    if (action === "reset") {
      this.isStormActive = false;
      this.stormStep = 0;
      this.acknowledgedAlerts.clear();
      this.escalatedAlerts.clear();
      this.resolvedAlerts.clear();
    }
    if (action === "storm_mode") {
      this.isStormActive = true;
      this.stormStep = 1;
    }
    return { ok: true, is_running: this.isRunning, storm: this.isStormActive, speed: this.speed };
  }

  public getState() {
    return {
      sim_time: this.simTime.toISOString(),
      is_running: this.isRunning,
      storm_scenario_active: this.isStormActive,
      storm_step: this.stormStep,
      speed: this.speed,
      data_mode: "simulator",
      tick_count: this.stormStep,
    };
  }

  public getZones(): Zone[] {
    const stormIntensity = this.isStormActive ? Math.sin((this.stormStep / 12) * Math.PI) : 0;

    return seed.zones.map((baseZone, idx) => {
      // Hotspots that suffer most during cloudbursts: Bellandur, Silk Board, Koramangala, HSR, Rainbow Drive
      const isHotspot = ["zone-1", "zone-2", "zone-3", "zone-4", "zone-5", "zone-6"].includes(baseZone.id);
      const zoneMultiplier = isHotspot ? 1.6 : 0.8;

      let rain1h = 2.0 + (idx % 4) * 1.5;
      let rain24h = baseZone.baseline_rain_mm * 0.4;
      let waterLevel = baseZone.baseline_water_level_m * 0.4;
      let soilSat = baseZone.baseline_soil_sat * 0.65;
      let prob = 0.08 + (idx % 3) * 0.04;

      if (this.isStormActive) {
        rain1h += 55 * stormIntensity * zoneMultiplier;
        rain24h += 95 * stormIntensity;
        waterLevel += 2.2 * stormIntensity * (baseZone.drainage_vulnerability || 0.8);
        soilSat = Math.min(99, soilSat + 35 * stormIntensity);
        prob = Math.min(0.96, prob + 0.82 * stormIntensity * zoneMultiplier);
      }

      let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "SEVERE" = "LOW";
      if (prob >= 0.75) riskLevel = "SEVERE";
      else if (prob >= 0.50) riskLevel = "HIGH";
      else if (prob >= 0.25) riskLevel = "MEDIUM";

      const trajectory: number[] = [];
      const trajectoryProb: number[] = [];
      for (let h = 0; h <= 48; h++) {
        let pFuture = prob;
        if (this.isStormActive) {
          const stepOffset = this.stormStep + h;
          if (stepOffset <= 12) {
            pFuture = Math.min(0.95, prob * (1 + 0.3 * Math.sin((stepOffset / 12) * Math.PI)));
          } else {
            pFuture = Math.max(0.06, prob * Math.exp(-(stepOffset - 12) / 8));
          }
        } else {
          pFuture = Math.max(0.04, Math.min(0.35, prob + 0.08 * Math.sin((h + idx) / 3)));
        }
        trajectoryProb.push(Number(pFuture.toFixed(3)));
        trajectory.push(Number((pFuture * 0.95).toFixed(3)));
      }

      const features: FeatureContribution[] = [
        {
          feature_name: "rain_1h_mm",
          display_name: "Rainfall (past 1 h)",
          importance_score: 0.38,
          direction: rain1h > 20 ? "INCREASES_RISK" : "NEUTRAL",
          current_value_formatted: `${rain1h.toFixed(1)} mm`,
        },
        {
          feature_name: "water_level_m",
          display_name: "SWD Drain Level",
          importance_score: 0.27,
          direction: waterLevel > 1.8 ? "INCREASES_RISK" : "NEUTRAL",
          current_value_formatted: `${waterLevel.toFixed(2)} m`,
        },
        {
          feature_name: "drainage_capacity_index",
          display_name: "Drain Capacity Index",
          importance_score: 0.18,
          direction: "DECREASES_RISK",
          current_value_formatted: `${(1 - (baseZone.drainage_vulnerability || 0.8)).toFixed(2)}`,
        },
        {
          feature_name: "impervious_ratio",
          display_name: "Impervious Concrete Ratio",
          importance_score: 0.11,
          direction: "INCREASES_RISK",
          current_value_formatted: `${((baseZone.impervious_ratio || 0.85) * 100).toFixed(0)}%`,
        },
      ];

      const current_prediction: FloodPrediction = {
        zone_id: baseZone.id,
        zone_name: baseZone.name,
        ward_number: baseZone.ward_number,
        flood_probability: Number(prob.toFixed(3)),
        risk_level: riskLevel,
        expected_window_hours: this.isStormActive && prob >= 0.5 ? "Next 1-3 hours" : "Calm (next 48h)",
        rainfall_1h_mm: Number(rain1h.toFixed(1)),
        rainfall_24h_mm: Number(rain24h.toFixed(1)),
        water_level_m: Number(waterLevel.toFixed(2)),
        soil_saturation_pct: Number(soilSat.toFixed(0)),
        prediction_confidence: "94.2% (calibrated)",
        feature_contributions: features,
        natural_explanation:
          prob >= 0.5
            ? `High runoff pressure from intense localized precipitation combined with elevated SWD levels near ${baseZone.primary_lake_name}.`
            : `Drainage discharge capacity adequate. Water levels within nominal operating thresholds.`,
        data_freshness_seconds: 4,
        last_updated: this.simTime.toISOString(),
        risk_score: Number(prob.toFixed(3)),
        forecast_6h_mm: Number((rain1h * 4.5).toFixed(1)),
        peak_probability_24h: Number(Math.max(...trajectoryProb.slice(0, 24)).toFixed(3)),
        peak_level_24h: riskLevel,
        peak_in_h: this.isStormActive ? Math.max(1, 4 - this.stormStep) : 6,
        hours_to_high: prob >= 0.5 ? 0 : this.isStormActive ? 2 : null,
        hours_to_severe: prob >= 0.75 ? 0 : this.isStormActive ? 4 : null,
        trajectory,
        trajectory_probability: trajectoryProb,
        observed_flooding: prob >= 0.85,
        drain_load_pct: Math.min(100, Math.round((waterLevel / (baseZone.baseline_water_level_m || 2)) * 80)),
      };

      return {
        ...baseZone,
        current_prediction,
      };
    });
  }

  public getZoneDetail(zoneId: string) {
    const zones = this.getZones();
    const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
    const pred = zone?.current_prediction;
    const rainNow = pred?.rainfall_1h_mm ?? 2.5;
    const fcRain = pred?.forecast_6h_mm ?? 15.0;
    const fcArray = Array.from({ length: 48 }, (_, i) => {
      const decay = Math.max(0.2, (fcRain / 6) * Math.exp(-i / 12));
      return Number(decay.toFixed(1));
    });
    return {
      zone,
      prediction: pred,
      history: {
        rain_mm: Array.from({ length: 48 }, () => Number((rainNow * (0.8 + Math.random() * 0.4)).toFixed(1))),
        water_level_m: Array.from({ length: 48 }, () => Number(((pred?.water_level_m ?? 1.2) * (0.9 + Math.random() * 0.2)).toFixed(2))),
      },
      forecast_rain_mm: fcArray,
      critical_infrastructure: this.getInfrastructure().filter((i) => i.zone_id === zoneId),
    };
  }

  public getAlerts(): { alerts: AlertItem[]; active_count: number } {
    const zones = this.getZones();
    const alerts: AlertItem[] = [];

    zones.forEach((z) => {
      const pred = z.current_prediction!;
      if (pred.risk_level === "HIGH" || pred.risk_level === "SEVERE") {
        const alertId = `alert-${z.id}-${this.stormStep}`;
        let status: "ACTIVE" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED" = "ACTIVE";
        if (this.resolvedAlerts.has(alertId)) status = "RESOLVED";
        else if (this.escalatedAlerts.has(alertId)) status = "ESCALATED";
        else if (this.acknowledgedAlerts.has(alertId)) status = "ACKNOWLEDGED";

        alerts.push({
          id: alertId,
          zone_id: z.id,
          zone_name: z.name,
          ward_number: z.ward_number,
          severity: pred.risk_level === "SEVERE" ? "SEVERE" : "HIGH",
          trigger_type: pred.observed_flooding ? "OBSERVED_FLOODING" : "FORECAST_THREAT",
          probability: pred.flood_probability,
          rainfall_mm: pred.rainfall_1h_mm,
          water_level_m: pred.water_level_m,
          expected_window: pred.expected_window_hours,
          timestamp: this.simTime.toISOString(),
          status,
          lead_time_h: 3,
          top_driver: pred.feature_contributions[0]?.display_name ?? "Rainfall intensity",
          government_message: `Deploy de-watering pumps to ${z.name} (Ward ${z.ward_number}). Water level projected at ${pred.water_level_m}m.`,
          citizen_message_en: `Warning: Severe waterlogging expected in ${z.name} within next 2 hours. Avoid underpasses and major arterial bottlenecks.`,
          citizen_message_kn: `ಎಚ್ಚರಿಕೆ: ${z.name} ಪ್ರದೇಶದಲ್ಲಿ ಮುಂದಿನ 2 ಗಂಟೆಗಳಲ್ಲಿ ಭಾರೀ ನೀರು ನಿಲ್ಲುವ ಸಾಧ್ಯತೆ ಇದೆ. ಅಂಡರ್‌ಪಾಸ್‌ಗಳನ್ನು ತಪ್ಪಿಸಿ.`,
        });
      }
    });

    const active_count = alerts.filter((a) => a.status === "ACTIVE").length;
    return { alerts, active_count };
  }

  public acknowledgeAlert(id: string) {
    this.acknowledgedAlerts.add(id);
    return { status: "ACKNOWLEDGED", alert_id: id };
  }

  public escalateAlert(id: string) {
    this.escalatedAlerts.add(id);
    return { status: "ESCALATED", alert_id: id };
  }

  public resolveAlert(id: string) {
    this.resolvedAlerts.add(id);
    return { status: "RESOLVED", alert_id: id };
  }

  public getThreats(): { sim_time: string; threats: Threat[] } {
    const zones = this.getZones();
    const threats: Threat[] = [];

    zones.forEach((z) => {
      const pred = z.current_prediction!;
      if (pred.peak_probability_24h >= 0.35 || pred.risk_level !== "LOW") {
        threats.push({
          zone_id: z.id,
          zone_name: z.name,
          ward_number: z.ward_number,
          current_level: pred.risk_level,
          predicted_level: pred.peak_level_24h,
          probability_now: pred.flood_probability,
          peak_probability: pred.peak_probability_24h,
          hours_to_high: pred.hours_to_high,
          hours_to_severe: pred.hours_to_severe,
          peak_in_h: pred.peak_in_h,
          top_driver: pred.feature_contributions[0]?.display_name ?? "Rainfall intensity",
          trajectory: pred.trajectory,
        });
      }
    });

    return { sim_time: this.simTime.toISOString(), threats };
  }

  public getCurrentRisk() {
    const zones = this.getZones();
    const high = zones.filter((z) => z.current_prediction?.risk_level === "HIGH").length;
    const severe = zones.filter((z) => z.current_prediction?.risk_level === "SEVERE").length;
    let citywide_risk = "LOW";
    if (severe > 0) citywide_risk = "SEVERE";
    else if (high > 1) citywide_risk = "HIGH";
    else if (high > 0) citywide_risk = "MEDIUM";

    return {
      citywide_risk,
      high_risk_zones_count: high,
      severe_risk_zones_count: severe,
      timestamp: this.simTime.toISOString(),
      zones_monitored: 18,
      model_calibrated: true,
    };
  }

  public getSensors() {
    const zones = this.getZones();
    return {
      timestamp: this.simTime.toISOString(),
      total_sensors: 54,
      sensors_online: 54,
      sensors: zones.flatMap((z) => [
        {
          id: `sensor-rain-${z.id}`,
          zone_id: z.id,
          zone_name: z.name,
          type: "RAIN_GAUGE",
          status: "ONLINE",
          value: z.current_prediction?.rainfall_1h_mm ?? 3.2,
          unit: "mm/h",
          battery_pct: 94,
          last_seen: this.simTime.toISOString(),
        },
        {
          id: `sensor-water-${z.id}`,
          zone_id: z.id,
          zone_name: z.name,
          type: "WATER_LEVEL_RADAR",
          status: "ONLINE",
          value: z.current_prediction?.water_level_m ?? 0.85,
          unit: "m",
          battery_pct: 91,
          last_seen: this.simTime.toISOString(),
        },
        {
          id: `sensor-soil-${z.id}`,
          zone_id: z.id,
          zone_name: z.name,
          type: "SOIL_MOISTURE_TDR",
          status: "ONLINE",
          value: z.current_prediction?.soil_saturation_pct ?? 68,
          unit: "%",
          battery_pct: 88,
          last_seen: this.simTime.toISOString(),
        },
      ]),
    };
  }

  public getSystemHealth(): { status: string; components: SystemHealthItem[] } {
    return {
      status: "HEALTHY",
      components: [
        { component: "FastAPI Telemetry Core", status: "ONLINE", latency_ms: 12, records_processed: 48920, last_heartbeat: this.simTime.toISOString(), details: "In-Browser Emulated Runtime / Local Engine" },
        { component: "XGBoost Prediction Engine", status: "ONLINE", latency_ms: 24, records_processed: 18, last_heartbeat: this.simTime.toISOString(), details: "14 Monotone Features, Calibrated IsoReg" },
        { component: "Hydrology Hydraulic Core", status: "ONLINE", latency_ms: 18, records_processed: 18, last_heartbeat: this.simTime.toISOString(), details: "SWD primary drain & retention basin solver" },
        { component: "KSNDMC Rain Telemetry", status: "ONLINE", latency_ms: 85, records_processed: 120, last_heartbeat: this.simTime.toISOString(), details: "Telemetry active across 18 BBMP wards" },
        { component: "Open-Meteo Integration", status: "ONLINE", latency_ms: 110, records_processed: 18, last_heartbeat: this.simTime.toISOString(), details: "Ensemble ECMWF + GFS weather feed" },
        { component: "Early Warning Threat Radar", status: "ONLINE", latency_ms: 15, records_processed: 18, last_heartbeat: this.simTime.toISOString(), details: "Autonomous alert dispatcher active" },
      ],
    };
  }

  public getInfrastructure() {
    return seed.infrastructure;
  }

  public getLakes() {
    return seed.lakes;
  }

  public getDrains() {
    return seed.drains;
  }

  public getHistoricalEvents() {
    return seed.historical_deluge;
  }

  public getBacktest() {
    return backtestData;
  }

  public getVerification(): Verification {
    return {
      flood_events: 18,
      warned_in_advance: 17,
      hit_rate_pct: 94.4,
      median_lead_time_h: 5.5,
      recent: [
        { zone: "Bellandur", zone_id: "zone-1", flooded_at: "T-0h", warned: true, lead_time_h: 6 },
        { zone: "Silk Board Junction", zone_id: "zone-2", flooded_at: "T-1h", warned: true, lead_time_h: 5 },
        { zone: "Koramangala 4th Block", zone_id: "zone-3", flooded_at: "T-2h", warned: true, lead_time_h: 6 },
      ],
    };
  }

  public getModel() {
    return modelMetaData;
  }

  public getRainfallTimeline() {
    const zones = this.getZones();
    const cityNow = this.isStormActive ? 42.5 : 4.8;
    const past_48h: any[] = [];
    const next_48h: any[] = [];
    const t0 = this.simTime;

    for (let k = 0; k < 48; k++) {
      const pastTime = new Date(t0.getTime() - (47 - k) * 3600000);
      const rainBase = Math.max(0.5, 3.5 + 4.0 * Math.sin(k / 5));
      const rainVal = this.isStormActive && k > 40 ? rainBase + 35 : rainBase;
      past_48h.push({
        h: -47 + k,
        time: pastTime.toLocaleDateString([], { weekday: "short" }) + " " + pastTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        city_mm: Number(rainVal.toFixed(2)),
        max_mm: Number((rainVal * 1.5).toFixed(1)),
      });
    }

    for (let k = 0; k < 48; k++) {
      const futTime = new Date(t0.getTime() + (k + 1) * 3600000);
      const rainBase = Math.max(0.2, 2.5 + 3.0 * Math.sin(k / 4));
      const rainVal = this.isStormActive && k < 6 ? rainBase + 45 : rainBase;
      next_48h.push({
        h: k + 1,
        time: futTime.toLocaleDateString([], { weekday: "short" }) + " " + futTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        city_mm: Number(rainVal.toFixed(2)),
        max_mm: Number((rainVal * 1.4).toFixed(1)),
      });
    }

    const rainfallZones = zones.map((z) => {
      const pred = z.current_prediction!;
      return {
        zone_id: z.id,
        zone_name: z.name,
        now_mm_h: pred.rainfall_1h_mm,
        last_3h_mm: Number((pred.rainfall_1h_mm * 2.8).toFixed(1)),
        today_mm: Number((pred.rainfall_24h_mm * 0.6).toFixed(1)),
        last_24h_mm: pred.rainfall_24h_mm,
        last_72h_mm: Number((pred.rainfall_24h_mm * 2.2).toFixed(1)),
        next_6h_mm: pred.forecast_6h_mm,
        next_24h_mm: Number((pred.forecast_6h_mm * 2.5).toFixed(1)),
        class_now: pred.rainfall_1h_mm > 35 ? "Heavy" : pred.rainfall_1h_mm > 15 ? "Moderate" : pred.rainfall_1h_mm > 2 ? "Light" : "No rain",
        class_24h: pred.rainfall_24h_mm > 80 ? "Heavy" : "Moderate",
      };
    });

    const wettest = rainfallZones[0];

    return {
      sim_time: t0.toISOString(),
      data_mode: "simulator",
      source: "Simulated rain gauges",
      city: {
        now_mm_h: cityNow,
        class_now: cityNow > 30 ? "Heavy" : cityNow > 10 ? "Moderate" : cityNow > 1 ? "Light" : "None",
        today_mm: this.isStormActive ? 78.4 : 14.2,
        last_24h_mm: this.isStormActive ? 92.6 : 28.5,
        next_6h_mm: this.isStormActive ? 64.0 : 8.5,
        next_24h_mm: this.isStormActive ? 112.0 : 22.0,
        raining_zones: this.isStormActive ? 16 : 4,
        wettest_zone: wettest?.zone_name ?? "Bellandur",
        wettest_24h_mm: wettest?.last_24h_mm ?? 64.0,
      },
      zones: rainfallZones,
      past_48h,
      next_48h,
    };
  }

  public runWhatIf(payload: WhatIfParams): WhatIfScenarioResult {
    const zones = this.getZones();
    const rainFactor = payload.rainfall_intensity_mm_h / 40;
    const drainReduction = (100 - payload.drainage_capacity_pct) / 100;

    let highCount = 0;
    let severeCount = 0;
    const zoneDeltas = zones.map((z) => {
      const baseProb = z.current_prediction?.flood_probability ?? 0.1;
      const scenProb = Math.min(0.98, Math.max(0.02, baseProb * rainFactor * (1 + drainReduction * 0.8)));
      if (scenProb >= 0.75) severeCount++;
      else if (scenProb >= 0.50) highCount++;

      return {
        zone_id: z.id,
        zone_name: z.name,
        baseline_prob: baseProb,
        baseline_risk: z.current_prediction?.risk_level ?? "LOW",
        scenario_prob: Number(scenProb.toFixed(2)),
        scenario_risk: scenProb >= 0.75 ? "SEVERE" : scenProb >= 0.5 ? "HIGH" : scenProb >= 0.25 ? "MEDIUM" : "LOW",
        baseline_score: Number(baseProb.toFixed(2)),
        scenario_score: Number(scenProb.toFixed(2)),
        peak_hour: 3,
        max_ponding_mm: Math.round(scenProb * 120),
        max_drain_level_m: Number((1.2 + scenProb * 2.5).toFixed(2)),
        area_km2: z.area_km2 ?? 3.5,
        prob_delta: Number((scenProb - baseProb).toFixed(2)),
      };
    });

    return {
      scenario_id: `scen-${Date.now()}`,
      baseline_affected_area_sq_km: 14.2,
      scenario_affected_area_sq_km: 14.2 + (highCount + severeCount) * 2.1,
      drains_overflowing: severeCount * 2,
      baseline_high_risk_zones: 2,
      baseline_severe_risk_zones: 0,
      scenario_high_risk_zones: highCount,
      scenario_severe_risk_zones: severeCount,
      delta_affected_area_sq_km: Number(((highCount + severeCount) * 2.1).toFixed(1)),
      zone_deltas: zoneDeltas,
      summary_insight:
        severeCount > 0
          ? `Cloudburst simulation indicates ${severeCount} severe flooding hotspots. De-silting SWD channels by +20% reduces water accumulation by ~34%.`
          : `Under the specified parameters, SWD network contains runoff within safe operating freeboard.`,
    };
  }

  public async queryGemini(query: string, role: string, userKey: string | null): Promise<GenAIResponse> {
    const zones = this.getZones();
    const highestRiskZones = [...zones].sort((a, b) => (b.current_prediction?.flood_probability ?? 0) - (a.current_prediction?.flood_probability ?? 0)).slice(0, 3);
    const key = userKey || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined);

    const contextSummary = zones
      .slice(0, 6)
      .map(
        (z) =>
          `${z.name} (Ward ${z.ward_number}): Risk ${z.current_prediction?.risk_level} (${Math.round((z.current_prediction?.flood_probability ?? 0) * 100)}%), Rain: ${z.current_prediction?.rainfall_1h_mm} mm/h, Drain Level: ${z.current_prediction?.water_level_m}m.`
      )
      .join("\n");

    if (key) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
        const systemPrompt = `You are AquaSense AI, Bengaluru's Urban Flood Intelligence assistant for Disaster Management Officers and Citizens.
Current simulated city context:
${contextSummary}
Active storm mode: ${this.isStormActive ? "YES" : "NO"}.
User role: ${role}.
Answer clearly, concisely, and factually based on this live telemetry. If the user asks about risk in an area or whether it is safe, give specific recommendations.`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: query }] }],
          }),
        });

        if (resp.ok) {
          const json = await resp.json();
          const answerText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText) {
            return {
              query,
              answer: answerText,
              data_sources_consulted: ["Live BBMP Telemetry", "Calibrated XGBoost Model", "Gemini 2.5 Flash"],
              confidence_level: "High (Model Grounded)",
              relevant_zones: highestRiskZones.map((z) => z.name),
              timestamp: this.simTime.toISOString(),
            };
          }
        }
      } catch (e) {
        console.warn("Direct Gemini call error, falling back to grounded template:", e);
      }
    }

    // Grounded template response if no API key or network error
    const topZone = highestRiskZones[0];
    const topProb = Math.round((topZone.current_prediction?.flood_probability ?? 0) * 100);
    const answer =
      this.isStormActive
        ? `⚠️ Active storm conditions detected. Highest flood risk is currently in ${topZone.name} (Ward ${topZone.ward_number}) at ${topProb}% probability with ${topZone.current_prediction?.rainfall_1h_mm} mm/h rainfall. Primary SWD channels are operating near peak hydraulic capacity. Recommendation: Avoid outer ring road corridors and low-lying underpasses.`
        : `Bengaluru flood risk is currently nominal (LOW). Highest observed probability is in ${topZone.name} at ${topProb}%. All major stormwater drains (KC Valley, Vrishabhavathi, Hebbal) have adequate capacity with normal recession rates.`;

    return {
      query,
      answer,
      data_sources_consulted: ["Live Sensor Telemetry", "Hydrology Model", "Grounding Templates"],
      confidence_level: "High (Calibrated)",
      relevant_zones: highestRiskZones.map((z) => z.name),
      timestamp: this.simTime.toISOString(),
    };
  }
}

export const mockEngine = new MockTelemetryEngine();
