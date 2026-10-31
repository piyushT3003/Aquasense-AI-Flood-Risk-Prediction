"""
AQUASENSE - Live prediction engine.

Turns each zone's recent (cleaned) telemetry into model features, scores the trained
XGBoost model, projects risk 48 h ahead from the rainfall forecast, and explains each
prediction with exact SHAP values. Used by the API, alerts, what-if and the assistant.
"""
from __future__ import annotations
import math
import numpy as np

from ml.model import FloodModel
from pipeline.features import FEATURE_LABELS
from pipeline.hydrology import HydroState, step, zone_params

LEVEL_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "SEVERE": 3}


def polygon_area_km2(coords: list[list[float]]) -> float:
    """Shoelace area of a [lng, lat] ring, projected to km."""
    kx, ky = 111.32 * math.cos(math.radians(12.97)), 110.57
    pts = [(lng * kx, lat * ky) for lng, lat in coords]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2


def feature_row(rain: np.ndarray, level: np.ndarray, forecast_6h: float, zone: dict, model: FloodModel,
                drain_scale: float = 1.0) -> dict:
    """Features for the LAST hour of the given hourly histories (oldest first)."""
    r = rain
    r3 = float(r[-3:].sum()); r3_prev = float(r[-6:-3].sum()) if len(r) >= 6 else 0.0
    r24 = float(r[-24:].sum())
    return {
        "rain_1h_mm": float(r[-1]), "rain_3h_mm": r3, "rain_24h_mm": r24,
        "antecedent_72h_mm": float(r[-96:].sum()) - r24, "forecast_6h_mm": float(forecast_6h),
        "water_level_m": float(level[-1]),
        "drainage_capacity_index": model.drainage_index.get(zone["id"], 0.4) * drain_scale,
        "elevation_m": zone["elevation_m"], "slope_degrees": zone["slope_degrees"],
        "lake_proximity_m": zone["lake_proximity_m"], "impervious_ratio": zone["impervious_ratio"],
        "incident_freq": model.incident_freq.get(zone["id"], 0.0),
        "rain_trend_3h": r3 - r3_prev, "water_rise_1h": float(level[-1] - level[-2]) if len(level) > 1 else 0.0,
    }


class LiveEngine:
    def __init__(self, zones: list[dict]):
        self.zones = zones
        self.model = FloodModel()
        self.params = zone_params(zones)
        self.areas = {z["id"]: round(polygon_area_km2(z["boundary_polygon"]), 2) for z in zones}

    # ---- risk score: banded 0-1 index used for colours and ranking ------------------------
    def risk_score(self, p: float) -> float:
        t = self.model.thresholds
        bands = [(0.0, 0.0), (t["MEDIUM"], 0.35), (t["HIGH"], 0.65), (t["SEVERE"], 0.85), (1.0, 1.0)]
        for (p0, s0), (p1, s1) in zip(bands, bands[1:]):
            if p <= p1:
                return round(s0 + (s1 - s0) * (p - p0) / max(p1 - p0, 1e-9), 3)
        return 1.0

    # ---- full evaluation of the city at the current hour -----------------------------------
    def evaluate(self, rain_hist: np.ndarray, level_hist: np.ndarray, forecast: np.ndarray,
                 hydro: HydroState, horizon: int = 48) -> dict:
        """
        rain_hist, level_hist : [hours, zones] cleaned history, last row = now
        forecast              : [>=horizon, zones] forecast rain for hours now+1 ...
        hydro                 : current hydrological state (copied, not mutated)
        """
        n = len(self.zones)
        fc6_now = forecast[:6].sum(axis=0)
        rows_now = [feature_row(rain_hist[:, i], level_hist[:, i], fc6_now[i], z, self.model)
                    for i, z in enumerate(self.zones)]
        p_now = self.model.predict(rows_now)
        contribs = self.model.booster.predict(self.model._matrix(rows_now), pred_contribs=True)[:, :-1]

        # project forward with the hydrology model driven by the forecast
        st = hydro.copy()
        rain_ext = np.vstack([rain_hist, forecast[:horizon]])
        lvl_ext = np.vstack([level_hist, np.zeros((horizon, n))])
        base = len(rain_hist)
        fut_rows = []
        for h in range(1, horizon + 1):
            out = step(st, forecast[h - 1], self.params)
            lvl_ext[base + h - 1] = out["water_level_m"]
            fc6 = forecast[h:h + 6].sum(axis=0)
            for i, z in enumerate(self.zones):
                fut_rows.append(feature_row(rain_ext[:base + h, i], lvl_ext[:base + h, i], fc6[i], z, self.model))
        p_fut = self.model.predict(fut_rows).reshape(horizon, n)
        traj = np.vstack([p_now[None, :], p_fut])            # [horizon+1, zones]

        zones_out = []
        for i, z in enumerate(self.zones):
            pz = traj[:, i]
            levels = [self.model.level(float(p)) for p in pz]
            now_lvl = levels[0]
            first = lambda name: next((h for h, l in enumerate(levels) if LEVEL_ORDER[l] >= LEVEL_ORDER[name]), None)
            peak_h = int(np.argmax(pz[:25]))
            order = np.argsort(-np.abs(contribs[i]))[:6]
            zones_out.append({
                "zone_id": z["id"], "probability": float(pz[0]), "risk_score": self.risk_score(float(pz[0])),
                "risk_level": now_lvl,
                "trajectory": [round(float(v), 4) for v in pz],
                "trajectory_score": [self.risk_score(float(v)) for v in pz],
                "peak_prob_24h": float(pz[:25].max()), "peak_in_h": peak_h,
                "peak_level_24h": self.model.level(float(pz[:25].max())),
                "hours_to_high": first("HIGH"), "hours_to_severe": first("SEVERE"),
                "features": rows_now[i],
                "shap": [{"feature_name": self.model.features[j],
                          "display_name": FEATURE_LABELS.get(self.model.features[j], self.model.features[j]),
                          "importance_score": round(float(contribs[i][j]), 3),
                          "direction": "increases_risk" if contribs[i][j] > 0 else "decreases_risk",
                          "value": rows_now[i][self.model.features[j]]} for j in order],
            })
        return {"zones": zones_out, "trajectory": traj}

    # ---- what-if: run a hypothetical storm through hydrology + model ----------------------
    def scenario(self, rain_hist, level_hist, hydro: HydroState, intensity_mmhr: float, duration_h: float,
                 antecedent_mm: float, drain_capacity_pct: float, lake_fill_pct: float) -> list[dict]:
        n = len(self.zones)
        hours = int(math.ceil(duration_h)) + 6
        storm = np.zeros((hours, n))
        for k in range(int(math.ceil(duration_h))):
            frac = min(1.0, duration_h - k)
            shape = 0.6 + 0.4 * math.sin(math.pi * (k + 0.5) / max(duration_h, 1))
            storm[k] = intensity_mmhr * shape * frac
        # antecedent: replace the 3 days before the last 24 h with the chosen total, spread evenly
        rh = rain_hist.copy()
        if len(rh) >= 96:
            rh[-96:-24] = antecedent_mm / 72.0
        st = hydro.copy()
        st.antecedent[:] = antecedent_mm * 0.6 + rh[-24:].sum(axis=0) * 0.9
        st.lake_fill[:] = lake_fill_pct / 100.0
        params = dict(self.params)
        scale = max(0.2, drain_capacity_pct / 100.0)
        params["capacity"] = self.params["capacity"] * scale
        params["k"] = self.params["k"] * scale
        rain_ext = np.vstack([rh, storm]); lvl_ext = np.vstack([level_hist, np.zeros((hours, n))])
        base = len(rh); rows, ponding = [], np.zeros((hours, n))
        for h in range(hours):
            out = step(st, storm[h], params)
            lvl_ext[base + h] = out["water_level_m"]; ponding[h] = out["ponding_mm"]
            fc6 = storm[h + 1:h + 7].sum(axis=0)
            for i, z in enumerate(self.zones):
                rows.append(feature_row(rain_ext[:base + h + 1, i], lvl_ext[:base + h + 1, i], fc6[i], z,
                                        self.model, drain_scale=scale))
        p = self.model.predict(rows).reshape(hours, n)
        out = []
        for i, z in enumerate(self.zones):
            pk = int(np.argmax(p[:, i]))
            out.append({"zone_id": z["id"], "zone_name": z["name"], "peak_prob": round(float(p[pk, i]), 4),
                        "peak_hour": pk + 1, "risk_level": self.model.level(float(p[pk, i])),
                        "risk_score": self.risk_score(float(p[pk, i])),
                        "max_ponding_mm": round(float(ponding[:, i].max()), 1),
                        "max_drain_level_m": round(float(lvl_ext[base:, i].max()), 2),
                        "area_km2": self.areas[z["id"]]})
        return out
