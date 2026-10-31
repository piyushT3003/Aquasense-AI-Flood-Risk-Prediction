"""
AQUASENSE - Live telemetry world (1 tick = 1 simulated hour).

Two data modes:
  simulator   weather generated from moving storm cells; the 48 h forecast is the scheduled
              weather x a per-storm forecast error, so the model sees storms coming before
              they arrive. Drain levels and waterlogging come from the hydrology model, so
              every warning can be checked against what actually happens ("verification").
  open-meteo  real rainfall for each zone (past 4 days + 48 h forecast) from the free
              Open-Meteo API; drain levels are modelled from that rainfall. Falls back to the
              simulator if the API cannot be reached.

Gauge readings pass through the same spike gate used in training (pipeline/cleaning.py).
"""
from __future__ import annotations
import math, random, threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import numpy as np

from seed_data import PILOT_ZONES
from models import SensorReading
from pipeline.hydrology import HydroState, step, zone_params
from pipeline.sources import OpenMeteoSource

HIST_H, FC_H = 120, 48
LAT = np.array([z["center"]["lat"] for z in PILOT_ZONES])
LNG = np.array([z["center"]["lng"] for z in PILOT_ZONES])
KX = 111.32 * math.cos(math.radians(12.97))


@dataclass
class Storm:
    start: datetime
    duration: float
    peak: float
    lat: float
    lng: float
    radius: float
    v_lat: float = 0.0
    v_lng: float = 0.0
    forecast_factor: float = 1.0
    label: str = "convective shower"

    def rain(self, t: datetime) -> np.ndarray:
        k = (t - self.start).total_seconds() / 3600.0
        if k < 0 or k > self.duration + 1:
            return np.zeros(len(LAT))
        shape = max(0.0, 1.0 - abs(k - self.duration / 2.5) / (self.duration / 1.6 + 0.5))
        d2 = ((LNG - (self.lng + self.v_lng * k)) * KX) ** 2 + ((LAT - (self.lat + self.v_lat * k)) * 110.57) ** 2
        return self.peak * shape * np.exp(-d2 / (2 * self.radius ** 2))


class TelemetrySimulator:
    def __init__(self, alert_manager, engine, seed: int = 11):
        self.alert_manager, self.engine = alert_manager, engine
        self.lock = threading.RLock()
        self.seed = seed
        self.is_running = True
        self.simulation_speed = 1.0
        self.data_mode = "simulator"
        self.open_meteo = OpenMeteoSource(PILOT_ZONES)
        self.data_mode_error: str | None = None
        self.reset()

    # ------------------------------------------------------------------ setup
    def reset(self):
        with self.lock:
            self.rng = np.random.default_rng(self.seed)
            self.py_rng = random.Random(self.seed)
            self.params = zone_params(PILOT_ZONES)
            self.sim_time = datetime.now().replace(minute=0, second=0, microsecond=0)
            self.tick_count = 0
            self.storm_scenario_active = False
            self.storm_step = 0
            self.storms: list[Storm] = []
            self.hydro = HydroState(len(PILOT_ZONES))
            self.rain_hist = np.zeros((HIST_H, len(PILOT_ZONES)))
            self.level_hist = np.full((HIST_H, len(PILOT_ZONES)), 0.3)
            self.raw_rain_now = np.zeros(len(PILOT_ZONES))
            self.flooded = np.zeros(len(PILOT_ZONES), dtype=bool)
            self.ponding = np.zeros(len(PILOT_ZONES))
            self.anomaly_log: list[dict] = []
            self.sensor_readings: list[SensorReading] = []
            self.verification = {"events": [], "open_warnings": {}}
            self.alert_manager.reset()
            # warm-up: 5 calm days so all the rolling windows are populated
            t = self.sim_time - timedelta(hours=HIST_H)
            self._schedule_background(t, self.sim_time + timedelta(hours=FC_H))
            for h in range(HIST_H):
                ts = t + timedelta(hours=h + 1)
                rain = self._true_rain(ts)
                out = step(self.hydro, rain, self.params)
                self.rain_hist[h] = rain
                self.level_hist[h] = out["water_level_m"]
            self.ponding = self.hydro.ponding.copy()
            self._refresh()

    def _schedule_background(self, t0: datetime, t1: datetime, rate_scale: float = 1.0):
        """Calm-weather convective showers, mostly in the afternoon/evening."""
        t = t0
        while t < t1:
            evening = 0.05 if 14 <= t.hour <= 22 else 0.012
            if self.rng.random() < evening * rate_scale:
                self.storms.append(Storm(
                    start=t, duration=float(1 + self.rng.gamma(1.5, 0.8)),
                    peak=float(min(30, self.rng.lognormal(math.log(6), 0.6))),
                    lat=float(self.rng.uniform(12.83, 13.12)), lng=float(self.rng.uniform(77.5, 77.78)),
                    radius=float(self.rng.uniform(4, 10)), v_lat=float(self.rng.normal(0, 0.01)),
                    v_lng=float(self.rng.normal(0, 0.01)), forecast_factor=float(self.rng.lognormal(0, 0.3))))
            t += timedelta(hours=1)
        self._background_until = t1

    def _true_rain(self, t: datetime) -> np.ndarray:
        r = np.zeros(len(PILOT_ZONES))
        for s in self.storms:
            r += s.rain(t)
        return np.round(r, 1)

    def forecast(self) -> np.ndarray:
        """Forecast rain (mm/h) for the next FC_H hours as the model sees it."""
        if self.data_mode == "open-meteo" and getattr(self, "_om_forecast", None) is not None:
            return self._om_forecast
        out = np.zeros((FC_H, len(PILOT_ZONES)))
        for h in range(FC_H):
            t = self.sim_time + timedelta(hours=h + 1)
            for s in self.storms:
                out[h] += s.rain(t) * s.forecast_factor
        return np.round(out, 1)

    # ------------------------------------------------------------------ tick
    def step(self):
        if not self.is_running:
            return
        with self.lock:
            if self.data_mode == "open-meteo":
                self._step_open_meteo()
                return
            self.tick_count += 1
            self.sim_time += timedelta(hours=1)
            if self.sim_time + timedelta(hours=FC_H) > self._background_until:
                self._schedule_background(self._background_until, self.sim_time + timedelta(hours=FC_H),
                                          rate_scale=0.5 if self.storm_scenario_active else 1.0)
            self.storms = [s for s in self.storms if s.start + timedelta(hours=s.duration + 2) > self.sim_time - timedelta(hours=1)
                           or s.start > self.sim_time]
            true_rain = self._true_rain(self.sim_time)
            raw = self._gauge_readings(true_rain)
            clean = self._spike_gate(raw)
            out = step(self.hydro, true_rain, self.params)
            level = out["water_level_m"] + self.rng.normal(0, 0.02, len(PILOT_ZONES))
            self.rain_hist = np.vstack([self.rain_hist[1:], clean])
            self.level_hist = np.vstack([self.level_hist[1:], level])
            self.ponding = out["ponding_mm"]
            was = self.flooded.copy()
            self.flooded = self.rng.random(len(PILOT_ZONES)) < out["p_incident"]
            if self.storm_scenario_active:
                self.storm_step += 1
                if self.storm_step > 14 and not self.flooded.any():
                    self.storm_scenario_active = False
            self._refresh(newly_flooded=self.flooded & ~was)

    def _gauge_readings(self, true_rain: np.ndarray) -> np.ndarray:
        raw = np.maximum(0, true_rain + self.rng.normal(0, 0.15, len(true_rain)) * (true_rain > 0)).round(1)
        if self.tick_count % 23 == 7:                      # a gauge glitches now and then
            i = int(self.rng.integers(len(raw)))
            raw[i] = float(self.rng.uniform(380, 440)).__round__(1)
        self.raw_rain_now = raw
        return raw

    def _spike_gate(self, raw: np.ndarray) -> np.ndarray:
        """Same rule as pipeline/cleaning.py: > 150 mm/h, or > 60 mm/h while neighbours are far lower."""
        clean = raw.copy()
        for i, v in enumerate(raw):
            neigh = float(np.median(np.delete(raw, i)))
            if v > 150 or (v > 60 and v > 8 * neigh + 30):
                clean[i] = round(neigh, 1)
                self.anomaly_log.insert(0, {
                    "sensor_id": f"RG-{PILOT_ZONES[i]['ward_number']}-01", "zone": PILOT_ZONES[i]["name"],
                    "value": f"{v:.1f} mm/h", "replaced_with": f"{neigh:.1f} mm/h (median of other gauges)",
                    "timestamp": self.sim_time.strftime("%Y-%m-%d %H:%M"), "type": "SPIKE_EXCEEDANCE",
                    "action": "Reading quarantined; spatial median used for prediction."})
        self.anomaly_log = self.anomaly_log[:50]
        return clean

    def _step_open_meteo(self):
        try:
            data = self.open_meteo.fetch()
            t, rain = data["time"], data["rain"]
            now = datetime.now().replace(minute=0, second=0, microsecond=0)
            idx = int(np.searchsorted(t.values, np.datetime64(now), side="right")) - 1
            if idx < HIST_H // 2:
                raise ValueError("not enough history returned")
            past = rain[max(0, idx - HIST_H + 1): idx + 1]
            if len(past) < HIST_H:
                past = np.vstack([np.zeros((HIST_H - len(past), past.shape[1])), past])
            fc = rain[idx + 1: idx + 1 + FC_H]
            if len(fc) < FC_H:
                fc = np.vstack([fc, np.zeros((FC_H - len(fc), fc.shape[1]))])
            hydro = HydroState(len(PILOT_ZONES)); levels = np.zeros_like(past)
            for h in range(len(past)):
                levels[h] = step(hydro, past[h], self.params)["water_level_m"]
            self.hydro, self.rain_hist, self.level_hist = hydro, past, levels
            self._om_forecast = np.round(fc, 1)
            self.sim_time = now
            self.ponding = hydro.ponding.copy()
            self.flooded = np.zeros(len(PILOT_ZONES), dtype=bool)
            self.raw_rain_now = past[-1]
            self.tick_count += 1
            self.data_mode_error = None
            self._refresh()
        except Exception as e:  # network blocked, API down...
            self.data_mode_error = f"Open-Meteo unavailable ({e}); switched back to simulator"
            self.data_mode = "simulator"
            self._om_forecast = None

    def set_data_mode(self, mode: str):
        with self.lock:
            if mode not in ("simulator", "open-meteo"):
                raise ValueError("mode must be 'simulator' or 'open-meteo'")
            if mode == "simulator" and self.data_mode != "simulator":
                self.data_mode = "simulator"; self._om_forecast = None
                self.reset()
            elif mode == "open-meteo":
                self.data_mode = "open-meteo"
                self.storm_scenario_active = False
                self._step_open_meteo()
        return self.data_mode

    # ------------------------------------------------------------------ demo storm
    def trigger_storm_scenario(self):
        """Schedule a severe cell over the East/South corridor 5 h from now (live demo).
        The forecast sees it immediately, so warnings go out before the rain arrives."""
        with self.lock:
            if self.data_mode != "simulator":
                raise RuntimeError("Storm demo is only available in simulator mode")
            self.storm_scenario_active = True
            self.storm_step = 0
            start = self.sim_time + timedelta(hours=5)
            self.storms.append(Storm(start=start, duration=6.0, peak=78.0, lat=12.915, lng=77.69, radius=7.5,
                                     v_lat=0.006, v_lng=-0.008, forecast_factor=0.9, label="severe convective cell"))
            self.storms.append(Storm(start=start - timedelta(hours=1), duration=8.0, peak=9.0, lat=12.94, lng=77.65,
                                     radius=11.0, forecast_factor=1.0, label="widespread rain band"))
            self._refresh()

    # ------------------------------------------------------------------ derived state
    def _refresh(self, newly_flooded: np.ndarray | None = None):
        fc = self.forecast()
        self.latest = self.engine.evaluate(self.rain_hist, self.level_hist, fc, self.hydro)
        self.latest_forecast = fc
        self.by_zone = {z["zone_id"]: z for z in self.latest["zones"]}
        self._update_sensors()
        self._verify(newly_flooded)
        self.alert_manager.evaluate(self)

    def _update_sensors(self):
        ts = self.sim_time.strftime("%Y-%m-%d %H:%M")
        readings = []
        for i, z in enumerate(PILOT_ZONES):
            raw, clean = float(self.raw_rain_now[i]), float(self.rain_hist[-1, i])
            anomaly = abs(raw - clean) > 50
            readings += [
                SensorReading(sensor_id=f"RG-{z['ward_number']}-01", sensor_type="rain_gauge", zone_id=z["id"],
                              location_name=f"{z['name']} rain gauge", value=round(raw, 1), unit="mm/h", timestamp=ts,
                              status="ANOMALY" if anomaly else "ONLINE", is_anomaly=anomaly,
                              anomaly_reason=f"Spike gate: {raw:.0f} mm/h vs neighbours ~{clean:.1f}; quarantined" if anomaly else None),
                SensorReading(sensor_id=f"WL-{z['ward_number']}-SWD", sensor_type="water_level_ultrasonic", zone_id=z["id"],
                              location_name=f"{z['name']} drain level sensor", value=round(float(self.level_hist[-1, i]), 2),
                              unit="m", timestamp=ts, status="ONLINE"),
                SensorReading(sensor_id=f"AWS-BBMP-{z['ward_number']}", sensor_type="weather_station", zone_id=z["id"],
                              location_name=f"{z['name']} weather station", value=round(float(self.rain_hist[-24:, i].sum()), 1),
                              unit="mm/24h", timestamp=ts, status="ONLINE"),
            ]
        self.sensor_readings = readings

    def _verify(self, newly_flooded):
        """Check warnings against simulated ground truth: was each flood warned in advance?"""
        if self.data_mode != "simulator":
            return
        ow = self.verification["open_warnings"]
        for i, z in enumerate(PILOT_ZONES):
            zs = self.by_zone[z["id"]]
            if zs["risk_level"] in ("HIGH", "SEVERE") and z["id"] not in ow:
                ow[z["id"]] = self.sim_time
            if newly_flooded is not None and newly_flooded[i]:
                warned_at = ow.get(z["id"])
                lead = (self.sim_time - warned_at).total_seconds() / 3600 if warned_at and warned_at < self.sim_time else None
                self.verification["events"].insert(0, {
                    "zone": z["name"], "zone_id": z["id"], "flooded_at": self.sim_time.strftime("%Y-%m-%d %H:%M"),
                    "warned": lead is not None, "lead_time_h": lead})
                self.alert_manager.observed_flooding(self, i)
            if zs["risk_level"] in ("LOW",) and not self.flooded[i] and z["id"] in ow:
                del ow[z["id"]]

    # ------------------------------------------------------------------ helpers for the API
    def zone_index(self, zone_id: str) -> int:
        return next(i for i, z in enumerate(PILOT_ZONES) if z["id"] == zone_id)

    def verification_summary(self) -> dict:
        ev = self.verification["events"]
        warned = [e for e in ev if e["warned"]]
        leads = [e["lead_time_h"] for e in warned]
        return {"flood_events": len(ev), "warned_in_advance": len(warned),
                "hit_rate_pct": round(100 * len(warned) / len(ev), 1) if ev else None,
                "median_lead_time_h": float(np.median(leads)) if leads else None,
                "recent": ev[:10]}
