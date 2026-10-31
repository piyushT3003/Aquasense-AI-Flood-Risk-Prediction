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

interface LiveWeatherData {
  temperature_c: number;
  humidity_pct: number;
  precipitation_now: number;
  weather_code: number;
  wind_speed_kmh: number;
  last_updated: string;
  source: string;
  past_48h: { h: number; time: string; city_mm: number; max_mm: number }[];
  next_48h: { h: number; time: string; city_mm: number; max_mm: number }[];
  today_mm: number;
  last_24h_mm: number;
  next_6h_mm: number;
  next_24h_mm: number;
}

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
  private liveWeather: LiveWeatherData | null = null;
  private isFetchingLive: boolean = false;

  constructor() {
    this.simTime.setMinutes(0, 0, 0);
    this.startTicker();
    this.updateLiveOpenMeteo();
    if (typeof window !== "undefined") {
      setInterval(() => this.updateLiveOpenMeteo(), 300000); // Poll live Open-Meteo every 5 minutes
    }
  }

  public async updateLiveOpenMeteo() {
    if (this.isFetchingLive) return;
    this.isFetchingLive = true;
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation,rain&past_days=2&forecast_days=2&timezone=Asia%2FKolkata";
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const curr = data.current || {};
        const hourly = data.hourly || {};
        const times: string[] = hourly.time || [];
        const precips: number[] = hourly.precipitation || [];

        const nowStr = curr.time || new Date().toISOString().slice(0, 13) + ":00";
        let currIdx = times.findIndex((t) => t.startsWith(nowStr.slice(0, 13)));
        if (currIdx === -1) currIdx = Math.floor(times.length / 2);

        const pastSlice: { h: number; time: string; city_mm: number; max_mm: number }[] = [];
        for (let k = 0; k < 48; k++) {
          const idx = Math.max(0, currIdx - 47 + k);
          const tStr = times[idx] || "";
          const val = Number((precips[idx] || 0).toFixed(1));
          const dt = tStr ? new Date(tStr) : new Date(Date.now() - (47 - k) * 3600000);
          pastSlice.push({
            h: -47 + k,
            time: dt.toLocaleDateString([], { weekday: "short" }) + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            city_mm: val,
            max_mm: Number((val * 1.25).toFixed(1)),
          });
        }

        const nextSlice: { h: number; time: string; city_mm: number; max_mm: number }[] = [];
        for (let k = 0; k < 48; k++) {
          const idx = Math.min(times.length - 1, currIdx + 1 + k);
          const tStr = times[idx] || "";
          const val = Number((precips[idx] || 0).toFixed(1));
          const dt = tStr ? new Date(tStr) : new Date(Date.now() + (k + 1) * 3600000);
          nextSlice.push({
            h: k + 1,
            time: dt.toLocaleDateString([], { weekday: "short" }) + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            city_mm: val,
            max_mm: Number((val * 1.25).toFixed(1)),
          });
        }

        const todayHours = pastSlice.slice(-Math.min(24, new Date().getHours() + 1));
        const today_mm = Number(todayHours.reduce((acc, x) => acc + x.city_mm, 0).toFixed(1));
        const last_24h_mm = Number(pastSlice.slice(-24).reduce((acc, x) => acc + x.city_mm, 0).toFixed(1));
        const next_6h_mm = Number(nextSlice.slice(0, 6).reduce((acc, x) => acc + x.city_mm, 0).toFixed(1));
        const next_24h_mm = Number(nextSlice.slice(0, 24).reduce((acc, x) => acc + x.city_mm, 0).toFixed(1));

        this.liveWeather = {
          temperature_c: Number(curr.temperature_2m ?? 21.5),
          humidity_pct: Number(curr.relative_humidity_2m ?? 80),
          precipitation_now: Number(curr.precipitation ?? 0.0),
          weather_code: Number(curr.weather_code ?? 0),
          wind_speed_kmh: Number(curr.wind_speed_10m ?? 10.0),
          last_updated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          source: "Open-Meteo Live API (Bengaluru 12.97°N, 77.59°E)",
          past_48h: pastSlice,
          next_48h: nextSlice,
          today_mm,
          last_24h_mm,
          next_6h_mm,
          next_24h_mm,
        };
      }
    } catch {
      // Fallback stays in place
    } finally {
      this.isFetchingLive = false;
    }
  }

  private startTicker() {
    if (typeof window !== "undefined") {
      this.tickerInterval = setInterval(() => {
        if (!this.isRunning) return;
        this.simTime = new Date(this.simTime.getTime() + 3600000); // advance 1 hour
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
    if (action === "refresh_live") {
      this.updateLiveOpenMeteo();
    }
    return { ok: true, is_running: this.isRunning, storm: this.isStormActive, speed: this.speed };
  }

  public getState() {
    return {
      sim_time: this.isStormActive ? this.simTime.toISOString() : new Date().toISOString(),
      is_running: this.isRunning,
      storm_scenario_active: this.isStormActive,
      storm_step: this.stormStep,
      speed: this.speed,
      data_mode: this.isStormActive ? "simulator" : "open-meteo",
      tick_count: this.stormStep,
      live_weather: this.liveWeather,
    };
  }

  public getZones(): Zone[] {
    const stormIntensity = this.isStormActive ? Math.sin((this.stormStep / 12) * Math.PI) : 0;

    return seed.zones.map((baseZone, idx) => {
      // Hotspots that suffer most during cloudbursts: Bellandur, Silk Board, Koramangala, HSR, Rainbow Drive, Ecospace
      const isHotspot = ["zone-1", "zone-2", "zone-3", "zone-4", "zone-5", "zone-6"].includes(baseZone.id);
      const zoneMultiplier = isHotspot ? 1.6 : 0.8;

      let rain1h = this.liveWeather?.precipitation_now ?? 0.0;
      let rain24h = this.liveWeather?.last_24h_mm ?? 0.0;
      let waterLevel = Number((0.35 + (idx % 3) * 0.04).toFixed(2));
      let soilSat = Number((22.0 + (idx % 4) * 2.5).toFixed(0));
      let prob = 0.005; // 0.5% nominal, zero projected flood risk in calm live state

      if (this.isStormActive) {
        rain1h = 55 + 25 * stormIntensity * zoneMultiplier;
        rain24h = 92 + 35 * stormIntensity;
        waterLevel = Number((1.8 + 1.1 * stormIntensity * (baseZone.drainage_vulnerability || 0.8)).toFixed(2));
        soilSat = Math.min(99, Math.round(75 + 22 * stormIntensity));
        prob = Math.min(0.96, Number(((isHotspot ? 0.72 : 0.35) + 0.22 * stormIntensity * zoneMultiplier).toFixed(3)));
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
            pFuture = Math.max(0.02, prob * Math.exp(-(stepOffset - 12) / 8));
          }
        } else {
          // In calm state: stays strictly at calm baseline
          pFuture = 0.005;
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
          direction: "NEUTRAL",
          current_value_formatted: `${((baseZone.impervious_ratio || 0.85) * 100).toFixed(0)}%`,
        },
      ];

      const current_prediction: FloodPrediction = {
        zone_id: baseZone.id,
        zone_name: baseZone.name,
        ward_number: baseZone.ward_number,
        flood_probability: prob,
        risk_level: riskLevel,
        expected_window_hours: this.isStormActive && prob >= 0.5 ? "Next 1-3 hours" : "Nominal (zero threat projected)",
        rainfall_1h_mm: Number(rain1h.toFixed(1)),
        rainfall_24h_mm: Number(rain24h.toFixed(1)),
        water_level_m: waterLevel,
        soil_saturation_pct: soilSat,
        prediction_confidence: this.isStormActive ? "94.2% (calibrated XGBoost)" : "99.8% (Real-Time Live Telemetry)",
        feature_contributions: features,
        natural_explanation:
          this.isStormActive && prob >= 0.5
            ? `High storm runoff exceeding SWD discharge capacity near ${baseZone.primary_lake_name}. Localized waterlogging anticipated within 1-3 hours.`
            : `Nominal live telemetry. Drain water levels and soil absorption within safe operational thresholds. Zero flood threat projected.`,
        data_freshness_seconds: 2,
        last_updated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        risk_score: Number(prob.toFixed(3)),
        forecast_6h_mm: this.isStormActive ? Number((rain1h * 3.5).toFixed(1)) : (this.liveWeather?.next_6h_mm ?? 0.0),
        peak_probability_24h: Number(Math.max(...trajectoryProb.slice(0, 24)).toFixed(3)),
        peak_level_24h: riskLevel,
        peak_in_h: this.isStormActive ? Math.max(1, 4 - this.stormStep) : 0,
        hours_to_high: this.isStormActive ? (prob >= 0.5 ? 0 : 2) : null,
        hours_to_severe: this.isStormActive ? (prob >= 0.75 ? 0 : 4) : null,
        trajectory,
        trajectory_probability: trajectoryProb,
        observed_flooding: this.isStormActive && prob >= 0.85,
        drain_load_pct: this.isStormActive
          ? Math.min(100, Math.round((waterLevel / 2.5) * 95))
          : Math.min(25, Math.round((waterLevel / 2.5) * 100)),
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
    const rainNow = pred?.rainfall_1h_mm ?? 0.0;
    const fcRain = pred?.forecast_6h_mm ?? 0.0;

    let historyRain: number[] = [];
    let fcArray: number[] = [];

    if (this.isStormActive) {
      historyRain = Array.from({ length: 48 }, (_, i) => Number((Math.max(0.5, 30 * Math.sin(i / 10))).toFixed(1)));
      fcArray = Array.from({ length: 48 }, (_, i) => {
        const decay = Math.max(0.2, (fcRain / 6) * Math.exp(-i / 12));
        return Number(decay.toFixed(1));
      });
    } else {
      historyRain = (this.liveWeather?.past_48h ?? []).map((x) => x.city_mm);
      if (historyRain.length < 48) historyRain = new Array(48).fill(0.0);
      fcArray = (this.liveWeather?.next_48h ?? []).map((x) => x.city_mm);
      if (fcArray.length < 48) fcArray = new Array(48).fill(0.0);
    }

    return {
      zone,
      prediction: pred,
      history: {
        rain_mm: historyRain,
        water_level_m: Array.from({ length: 48 }, () => Number(((pred?.water_level_m ?? 0.35) * (0.95 + Math.random() * 0.1)).toFixed(2))),
      },
      forecast_rain_mm: fcArray,
      critical_infrastructure: this.getInfrastructure().filter((i) => i.zone_id === zoneId),
    };
  }

  public getAlerts(): { alerts: AlertItem[]; active_count: number } {
    // When no storm demo is running, zero active alerts
    if (!this.isStormActive) {
      return { alerts: [], active_count: 0 };
    }

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
          government_message: `CRITICAL FLOOD ADVISORY: ${z.name} (Ward ${z.ward_number}) drain level at ${pred.water_level_m}m. Deploy SDRF/BBMP suction pumps to ${z.primary_lake_name || "basin"}.`,
          citizen_message_en: `BBMP Safety Alert: Elevated waterlogging expected in ${z.name} within next 1-3 hours. Avoid low-lying underpasses and arterial roads.`,
          citizen_message_kn: `ಬಿಬಿಎಂಪಿ ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆ: ಮುಂದಿನ 1-3 ಗಂಟೆಗಳಲ್ಲಿ ${z.name} ನಲ್ಲಿ ನೀರಿನ ಮಟ್ಟ ಹೆಚ್ಚಾಗುವ ಸಾಧ್ಯತೆ ಇದೆ. ತಗ್ಗು ಪ್ರದೇಶದ ಅಂಡರ್‌ಪಾಸ್‌ಗಳನ್ನು ತಪ್ಪಿಸಿ.`,
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
    // When no storm demo is running, zero projected threats
    if (!this.isStormActive) {
      return { sim_time: this.simTime.toISOString(), threats: [] };
    }

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
      timestamp: this.isStormActive ? this.simTime.toISOString() : new Date().toISOString(),
      zones_monitored: 18,
      model_calibrated: true,
      data_mode: this.isStormActive ? "simulator" : "open-meteo",
      zones_flooded_now: zones.filter((z) => z.current_prediction?.observed_flooding).length,
    };
  }

  public getRiskForecast() {
    const t0 = this.simTime;
    const hourly: any[] = [];
    const horizons: any[] = [];

    for (let h = 0; h <= 48; h++) {
      const stepTime = new Date(t0.getTime() + h * 3600000);
      const timeLabel =
        stepTime.toLocaleDateString([], { weekday: "short" }) + " " + stepTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (!this.isStormActive) {
        const fcRain = this.liveWeather?.next_48h?.[h]?.city_mm ?? 0.0;
        hourly.push({
          h,
          time: timeLabel,
          avg_risk_score: 0.01,
          high_risk_zones: 0,
          severe_zones: 0,
          city_rain_mm_h: fcRain,
          city_risk: "LOW",
        });
      } else {
        const stormIntensity = h <= 12 ? Math.sin((h / 12) * Math.PI) : 0;
        const highZones = h >= 1 && h <= 8 ? Math.round(2 + 4 * stormIntensity) : 0;
        const severeZones = h >= 2 && h <= 6 ? Math.round(1 + 3 * stormIntensity) : 0;
        const rainMm = Number((Math.max(1, 55 * stormIntensity)).toFixed(1));
        const riskLevel = severeZones > 0 ? "SEVERE" : highZones > 0 ? "HIGH" : h < 12 ? "MEDIUM" : "LOW";

        hourly.push({
          h,
          time: timeLabel,
          avg_risk_score: Number((0.08 + 0.65 * stormIntensity).toFixed(2)),
          high_risk_zones: highZones,
          severe_zones: severeZones,
          city_rain_mm_h: rainMm,
          city_risk: riskLevel,
        });
      }
    }

    const horizonMap: [string, number][] = [
      ["NOW", 0],
      ["+3H", 3],
      ["+6H", 6],
      ["+12H", 12],
      ["+24H", 24],
      ["+48H", 48],
    ];

    for (const [label, h] of horizonMap) {
      const hr = hourly[h] || hourly[0];
      const hotspots =
        this.isStormActive && (hr.high_risk_zones > 0 || hr.severe_zones > 0)
          ? ["Bellandur", "Silk Board", "Koramangala 4th Block", "Rainbow Drive"]
          : [];

      horizons.push({
        ...hr,
        horizon: label,
        hours: h,
        expected_rain_mm: Number(hourly.slice(0, Math.max(1, h)).reduce((acc, x) => acc + x.city_rain_mm_h, 0).toFixed(1)),
        affected_hotspots: hotspots,
      });
    }

    return {
      model: "AquaSense-XGB-v3",
      thresholds: { MEDIUM: 0.02, HIGH: 0.1296, SEVERE: 0.45 },
      horizons,
      hourly,
    };
  }

  public getSensors() {
    const zones = this.getZones();
    return {
      timestamp: this.isStormActive ? this.simTime.toISOString() : new Date().toISOString(),
      total_sensors: 54,
      sensors_online: 54,
      sensors: zones.flatMap((z) => [
        {
          id: `sensor-rain-${z.id}`,
          zone_id: z.id,
          zone_name: z.name,
          type: "RAIN_GAUGE",
          status: "ONLINE",
          value: z.current_prediction?.rainfall_1h_mm ?? 0.0,
          unit: "mm/h",
          battery_pct: 95,
          last_seen: new Date().toISOString(),
        },
        {
          id: `sensor-water-${z.id}`,
          zone_id: z.id,
          zone_name: z.name,
          type: "WATER_LEVEL_RADAR",
          status: "ONLINE",
          value: z.current_prediction?.water_level_m ?? 0.35,
          unit: "m",
          battery_pct: 92,
          last_seen: new Date().toISOString(),
        },
        {
          id: `sensor-soil-${z.id}`,
          zone_id: z.id,
          zone_name: z.name,
          type: "SOIL_MOISTURE_TDR",
          status: "ONLINE",
          value: z.current_prediction?.soil_saturation_pct ?? 25,
          unit: "%",
          battery_pct: 89,
          last_seen: new Date().toISOString(),
        },
      ]),
    };
  }

  public getSystemHealth(): { status: string; components: SystemHealthItem[] } {
    const isLive = !this.isStormActive;
    return {
      status: "HEALTHY",
      components: [
        {
          component: "Telemetry Core Engine",
          status: "ONLINE",
          latency_ms: 12,
          records_processed: 48920,
          last_heartbeat: new Date().toISOString(),
          details: isLive ? "Live Telemetry Feed · Open-Meteo Bengaluru API" : "Simulated Storm Deluge Runtime Active",
        },
        {
          component: "XGBoost Prediction Engine",
          status: "ONLINE",
          latency_ms: 24,
          records_processed: 18,
          last_heartbeat: new Date().toISOString(),
          details: "14 Monotone Features, Calibrated IsoReg",
        },
        {
          component: "Hydrology Hydraulic Core",
          status: "ONLINE",
          latency_ms: 18,
          records_processed: 18,
          last_heartbeat: new Date().toISOString(),
          details: "SWD primary drain & retention basin solver",
        },
        {
          component: "Open-Meteo Integration",
          status: "ONLINE",
          latency_ms: 85,
          records_processed: 18,
          last_heartbeat: new Date().toISOString(),
          details: this.liveWeather?.source ?? "Open-Meteo API Connected (12.97°N, 77.59°E)",
        },
        {
          component: "Early Warning Threat Radar",
          status: "ONLINE",
          latency_ms: 15,
          records_processed: 18,
          last_heartbeat: new Date().toISOString(),
          details: isLive ? "Calm · 0 threats projected" : "Active storm tracking in progress",
        },
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
    const t0 = this.simTime;

    if (!this.isStormActive) {
      const past_48h = this.liveWeather?.past_48h ?? Array.from({ length: 48 }, (_, k) => ({
        h: -47 + k,
        time: (new Date(t0.getTime() - (47 - k) * 3600000)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        city_mm: 0.0,
        max_mm: 0.0,
      }));

      const next_48h = this.liveWeather?.next_48h ?? Array.from({ length: 48 }, (_, k) => ({
        h: k + 1,
        time: (new Date(t0.getTime() + (k + 1) * 3600000)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        city_mm: 0.0,
        max_mm: 0.0,
      }));

      const rainNow = this.liveWeather?.precipitation_now ?? 0.0;
      const todayMm = this.liveWeather?.today_mm ?? 0.0;
      const last24hMm = this.liveWeather?.last_24h_mm ?? 0.0;
      const next6hMm = this.liveWeather?.next_6h_mm ?? 0.0;
      const next24hMm = this.liveWeather?.next_24h_mm ?? 0.0;

      const rainfallZones = zones.map((z) => ({
        zone_id: z.id,
        zone_name: z.name,
        now_mm_h: rainNow,
        last_3h_mm: Number((rainNow * 2.5).toFixed(1)),
        today_mm: todayMm,
        last_24h_mm: last24hMm,
        last_72h_mm: Number((last24hMm * 1.5).toFixed(1)),
        next_6h_mm: next6hMm,
        next_24h_mm: next24hMm,
        class_now: rainNow > 15 ? "Heavy" : rainNow > 2 ? "Moderate" : rainNow > 0.2 ? "Light" : "No rain",
        class_24h: last24hMm > 64 ? "Heavy" : last24hMm > 15 ? "Moderate" : "Light",
      }));

      return {
        sim_time: new Date().toISOString(),
        data_mode: "open-meteo",
        source: this.liveWeather?.source ?? "Live Open-Meteo Feed (Bengaluru 12.97°N, 77.59°E)",
        city: {
          now_mm_h: rainNow,
          class_now: rainNow > 15 ? "Heavy" : rainNow > 2 ? "Moderate" : rainNow > 0.2 ? "Light" : "None",
          today_mm: todayMm,
          last_24h_mm: last24hMm,
          next_6h_mm: next6hMm,
          next_24h_mm: next24hMm,
          raining_zones: rainNow >= 0.2 ? 18 : 0,
          wettest_zone: rainfallZones[0]?.zone_name ?? "Bellandur",
          wettest_24h_mm: last24hMm,
        },
        zones: rainfallZones,
        past_48h,
        next_48h,
      };
    }

    // Storm mode: Simulated Deluge
    const cityNow = 54.8;
    const past_48h: any[] = [];
    const next_48h: any[] = [];

    for (let k = 0; k < 48; k++) {
      const pastTime = new Date(t0.getTime() - (47 - k) * 3600000);
      const rainVal = k > 40 ? 12.0 + (k - 40) * 5.2 : Math.max(0.2, 2.0 + 1.5 * Math.sin(k / 4));
      past_48h.push({
        h: -47 + k,
        time: pastTime.toLocaleDateString([], { weekday: "short" }) + " " + pastTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        city_mm: Number(rainVal.toFixed(1)),
        max_mm: Number((rainVal * 1.3).toFixed(1)),
      });
    }

    for (let k = 0; k < 48; k++) {
      const futTime = new Date(t0.getTime() + (k + 1) * 3600000);
      const rainVal = k < 6 ? Math.max(8, 65.0 - k * 8.5) : Math.max(0.1, 4.0 * Math.exp(-(k - 6) / 8));
      next_48h.push({
        h: k + 1,
        time: futTime.toLocaleDateString([], { weekday: "short" }) + " " + futTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        city_mm: Number(rainVal.toFixed(1)),
        max_mm: Number((rainVal * 1.3).toFixed(1)),
      });
    }

    const rainfallZones = zones.map((z) => {
      const pred = z.current_prediction!;
      return {
        zone_id: z.id,
        zone_name: z.name,
        now_mm_h: pred.rainfall_1h_mm,
        last_3h_mm: Number((pred.rainfall_1h_mm * 2.8).toFixed(1)),
        today_mm: Number((pred.rainfall_24h_mm * 0.7).toFixed(1)),
        last_24h_mm: pred.rainfall_24h_mm,
        last_72h_mm: Number((pred.rainfall_24h_mm * 1.8).toFixed(1)),
        next_6h_mm: pred.forecast_6h_mm,
        next_24h_mm: Number((pred.forecast_6h_mm * 2.2).toFixed(1)),
        class_now: pred.rainfall_1h_mm > 35 ? "Heavy" : pred.rainfall_1h_mm > 15 ? "Moderate" : "Light",
        class_24h: pred.rainfall_24h_mm > 80 ? "Heavy" : "Moderate",
      };
    });

    const wettest = [...rainfallZones].sort((a, b) => b.last_24h_mm - a.last_24h_mm)[0];

    return {
      sim_time: t0.toISOString(),
      data_mode: "simulator",
      source: "Simulated Storm Deluge (Cloudburst Scenario)",
      city: {
        now_mm_h: cityNow,
        class_now: "Heavy",
        today_mm: 82.4,
        last_24h_mm: 98.6,
        next_6h_mm: 58.0,
        next_24h_mm: 110.0,
        raining_zones: 18,
        wettest_zone: wettest?.zone_name ?? "Bellandur",
        wettest_24h_mm: wettest?.last_24h_mm ?? 115.0,
      },
      zones: rainfallZones,
      past_48h,
      next_48h,
    };
  }

  public runWhatIf(payload: WhatIfParams): WhatIfScenarioResult {
    const zones = this.getZones();
    const rainFactor = payload.rainfall_intensity_mm_h / 40;
    const capacityFactor = 100 / Math.max(10, payload.drainage_capacity_pct);
    const lakeFactor = payload.lake_fill_pct / 80;

    let highCount = 0;
    let severeCount = 0;

    const zoneDeltas = zones.map((z) => {
      const baseProb = z.current_prediction?.flood_probability ?? 0.05;
      const vuln = z.drainage_vulnerability || 0.8;
      const scenProb = Math.min(
        0.98,
        Math.max(
          0.02,
          baseProb +
            (payload.rainfall_intensity_mm_h > 25 ? 0.35 * rainFactor * vuln : 0.05) *
              (capacityFactor * 0.7) *
              (lakeFactor * 0.6)
        )
      );

      if (scenProb >= 0.75) severeCount++;
      else if (scenProb >= 0.5) highCount++;

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
Current telemetry status:
${this.isStormActive ? "ACTIVE STORM DELUGE DEMO IN PROGRESS" : "LIVE REAL-TIME TELEMETRY (Open-Meteo Bengaluru Feed - Conditions Nominal)"}
Active storm mode: ${this.isStormActive ? "YES" : "NO"}.
Telemetry snapshot:
${contextSummary}
User role: ${role}.
Answer clearly, concisely, and factually based on this live telemetry. If the user asks about risk in an area or whether it is safe, give specific recommendations.`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${query}` }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 800,
            },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText) {
            return {
              query,
              answer: answerText,
              data_sources_consulted: ["Open-Meteo Live API", "BBMP Telemetry Grid", "Calibrated XGBoost Model"],
              confidence_level: "HIGH (Live Gemini 2.5 Flash)",
              relevant_zones: this.isStormActive ? ["Bellandur", "Silk Board", "Koramangala 4th Block"] : ["All corridors nominal"],
              timestamp: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Fallback to grounded rule-based template
      }
    }

    // Grounded template response
    const qLower = query.toLowerCase();
    if (this.isStormActive) {
      return {
        query,
        answer: `**Active Storm Alert**: Deluge scenario in progress. Heavy convective rainfall (55–80 mm/h) is causing water levels in Bellandur, Silk Board, and Koramangala basins to elevate. Avoid arterial underpasses along the Outer Ring Road.`,
        data_sources_consulted: ["Hydraulic Runoff Simulation", "BBMP SWD Grid", "Monotone XGBoost v3"],
        confidence_level: "HIGH (Grounded Telemetry)",
        relevant_zones: ["Bellandur", "Silk Board", "Koramangala 4th Block"],
        timestamp: new Date().toISOString(),
      };
    }

    if (qLower.includes("weather") || qLower.includes("rain") || qLower.includes("now")) {
      const rain = this.liveWeather?.precipitation_now ?? 0.0;
      const temp = this.liveWeather?.temperature_c ?? 21.5;
      return {
        query,
        answer: `**Live Weather for Bengaluru**: Currently **${temp}°C** with **${rain.toFixed(1)} mm/h** precipitation. All 18 monitored BBMP flood zones are nominal with zero flood threat projected.`,
        data_sources_consulted: ["Open-Meteo Live API (12.97°N, 77.59°E)", "18 BBMP Ground Stations"],
        confidence_level: "HIGH (Live Open-Meteo Telemetry)",
        relevant_zones: ["All 18 zones nominal"],
        timestamp: new Date().toISOString(),
      };
    }

    return {
      query,
      answer: `All 18 Bengaluru flood corridors are currently operating under nominal baseline conditions. Drains and lake outlets have full freeboard capacity. Zero flood risk is projected under current weather. Press **"Run the storm demo"** to project an incoming cloudburst scenario.`,
      data_sources_consulted: ["Open-Meteo Weather Feed", "18 Corridors Sensor Network"],
      confidence_level: "HIGH (Nominal Baseline)",
      relevant_zones: ["All corridors nominal"],
      timestamp: new Date().toISOString(),
    };
  }
}

export const mockEngine = new MockTelemetryEngine();
