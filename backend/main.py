"""
AQUASENSE - FastAPI backend.   Run:  uvicorn main:app --port 8000   (from the backend folder)
AI-powered urban flood early warning for Bengaluru.
"""
import asyncio, json, os, time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Body, Header, Request

from settings_env import load_env
ENV_LOADED = load_env()
from fastapi.middleware.cors import CORSMiddleware

from models import (FloodPrediction, FeatureContribution, WhatIfRequest, WhatIfResponse,
                    GenAIQueryRequest, GenAIQueryResponse, SystemHealthItem)
from seed_data import (PILOT_ZONES, BENGALURU_LAKES, PRIMARY_STORMWATER_DRAINS,
                       CRITICAL_INFRASTRUCTURE, HISTORICAL_DELUGE_2022)
from engine import LiveEngine
from alert_service import AlertManager, RANK
from simulation import TelemetrySimulator
from genai_service import AquaSenseAIAssistant
from ml.model import MODEL_DIR

TICK_SECONDS = float(os.environ.get("AQUASENSE_TICK_SECONDS", "3"))
engine = LiveEngine(PILOT_ZONES)
alert_manager = AlertManager()
simulator = TelemetrySimulator(alert_manager, engine)
ai_assistant = AquaSenseAIAssistant(simulator, alert_manager, engine)
ZONE_BY_ID = {z["id"]: z for z in PILOT_ZONES}
STARTED = time.time()


async def simulation_loop():
    while True:
        try:
            await asyncio.to_thread(simulator.step)
        except Exception as e:
            print("Simulation loop exception:", repr(e))
        await asyncio.sleep(TICK_SECONDS / max(0.25, simulator.simulation_speed))


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(simulation_loop())
    yield
    task.cancel()


app = FastAPI(title="AquaSense Urban Flood Intelligence API", version="3.0.0", lifespan=lifespan,
              description="Live flood-risk prediction, 48 h risk trajectories and early-warning alerts for 18 Bengaluru zones.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------------------- roles
CITIZEN_BLOCKED = ("/api/simulation/control", "/api/data-source", "/api/alerts/")


@app.middleware("http")
async def role_guard(request: Request, call_next):
    """Citizens get a read-only view: no simulation control, data-source switching or alert actions."""
    role = request.headers.get("X-AquaSense-Role", "")
    if role == "Citizen" and request.method == "POST" and request.url.path.startswith(CITIZEN_BLOCKED):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "This action is not available in the Citizen view."}, status_code=403)
    return await call_next(request)


# ---------------------------------------------------------------------------- helpers
def prediction(zone_id: str) -> FloodPrediction:
    z, zs = ZONE_BY_ID[zone_id], simulator.by_zone[zone_id]
    f = zs["features"]
    i = simulator.zone_index(zone_id)
    fmt = {"m": "{:.2f} m", "mm": "{:.1f} mm"}
    contribs = [FeatureContribution(
        feature_name=s["feature_name"], display_name=s["display_name"], importance_score=s["importance_score"],
        direction=s["direction"], current_value_formatted=_fmt(s["feature_name"], s["value"])) for s in zs["shap"]]
    up = [c for c in contribs if c.importance_score > 0][:2]
    if zs["hours_to_high"] and RANK[zs["risk_level"]] < 2:
        window = f"Expected to reach HIGH in ~{zs['hours_to_high']} h"
    elif RANK[zs["risk_level"]] >= 2:
        window = "Elevated now" + (f"; peaks in ~{zs['peak_in_h']} h" if zs["peak_in_h"] else "")
    else:
        window = "No escalation expected in the next 24 h"
    drivers = " and ".join(f"{c.display_name.lower()} ({c.current_value_formatted})" for c in up) or "low rainfall"
    explanation = (f"{z['name']} (Ward {z['ward_number']}) is at {zs['risk_level']} risk: a "
                   f"{'less than 1' if zs['probability'] < 0.01 else round(100*zs['probability'])}% chance of waterlogging within the next 6 hours. "
                   f"The model's biggest risk drivers are {drivers}. {window}.")
    sat = min(100.0, 30 + float(simulator.hydro.antecedent[i]) / 1.5)
    return FloodPrediction(
        zone_id=zone_id, zone_name=z["name"], ward_number=z["ward_number"],
        flood_probability=round(zs["probability"], 4), risk_level=zs["risk_level"], expected_window_hours=window,
        rainfall_1h_mm=round(f["rain_1h_mm"], 1), rainfall_24h_mm=round(f["rain_24h_mm"], 1),
        water_level_m=round(f["water_level_m"], 2), soil_saturation_pct=round(sat, 1),
        prediction_confidence="High" if zs["probability"] < 0.02 or zs["probability"] > 0.6 else "Moderate",
        feature_contributions=contribs, natural_explanation=explanation,
        data_freshness_seconds=int(TICK_SECONDS), last_updated=simulator.sim_time.strftime("%Y-%m-%d %H:%M"),
        risk_score=zs["risk_score"], forecast_6h_mm=round(f["forecast_6h_mm"], 1),
        peak_probability_24h=round(zs["peak_prob_24h"], 4), peak_level_24h=zs["peak_level_24h"], peak_in_h=zs["peak_in_h"],
        hours_to_high=zs["hours_to_high"], hours_to_severe=zs["hours_to_severe"],
        trajectory=zs["trajectory_score"], trajectory_probability=zs["trajectory"],
        observed_flooding=bool(simulator.flooded[i]),
        drain_load_pct=round(min(150.0, 100 * (float(simulator.hydro.drain[i]) / 60.0)), 1))


def _fmt(name, v):
    if name.endswith("_mm") or name in ("rain_trend_3h",):
        return f"{v:.1f} mm"
    if name in ("water_level_m", "water_rise_1h"):
        return f"{v:.2f} m"
    if name == "elevation_m":
        return f"{v:.0f} m"
    if name == "lake_proximity_m":
        return f"{v:.0f} m"
    if name == "slope_degrees":
        return f"{v:.1f}°"
    if name == "impervious_ratio":
        return f"{100*v:.0f}%"
    if name == "incident_freq":
        return f"{v:.1f} / season"
    return f"{v:.2f}"


def city_level(levels):
    sev = sum(1 for l in levels if l == "SEVERE"); high = sum(1 for l in levels if RANK[l] >= 2)
    med = sum(1 for l in levels if RANK[l] >= 1)
    return "SEVERE" if sev >= 2 else "HIGH" if high >= 2 else "MEDIUM" if med >= 2 or high else "LOW"


# ---------------------------------------------------------------------------- 1. zones & risk
@app.get("/api/zones", summary="18 pilot zones with live predictions")
def get_zones():
    zones = [{**z, "area_km2": engine.areas[z["id"]], "current_prediction": prediction(z["id"])} for z in PILOT_ZONES]
    return {"count": len(zones), "sim_time": simulator.sim_time.isoformat(), "data_mode": simulator.data_mode,
            "data_disclaimer": "Simulated KSNDMC & BBMP telemetry" if simulator.data_mode == "simulator"
            else "Live Open-Meteo rainfall; drain levels modelled", "zones": zones}


@app.get("/api/zones/{zone_id}")
def get_zone_details(zone_id: str):
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(404, "Zone not found")
    i = simulator.zone_index(zone_id)
    return {"zone": {**ZONE_BY_ID[zone_id], "area_km2": engine.areas[zone_id]}, "prediction": prediction(zone_id),
            "history": {"rain_mm": simulator.rain_hist[-48:, i].round(1).tolist(),
                        "water_level_m": simulator.level_hist[-48:, i].round(2).tolist()},
            "forecast_rain_mm": simulator.latest_forecast[:, i].round(1).tolist(),
            "critical_infrastructure": [x for x in CRITICAL_INFRASTRUCTURE if x["zone_id"] == zone_id]}


@app.get("/api/risk/current")
def get_current_risk():
    preds = [prediction(z["id"]) for z in PILOT_ZONES]
    return {"citywide_risk": city_level([p.risk_level for p in preds]),
            "high_risk_zones_count": sum(1 for p in preds if RANK[p.risk_level] >= 2),
            "severe_risk_zones_count": sum(1 for p in preds if p.risk_level == "SEVERE"),
            "zones_flooded_now": int(simulator.flooded.sum()),
            "total_monitored_zones": len(preds), "sim_time": simulator.sim_time.isoformat(),
            "data_freshness": f"Updated every {TICK_SECONDS:g}s ({'simulated hour' if simulator.data_mode == 'simulator' else 'live data'})",
            "predictions": preds}


@app.get("/api/risk/forecast", summary="City risk over the next 48 h, computed from zone trajectories")
def get_risk_forecast():
    traj = simulator.latest["trajectory"]                 # [49, zones] probabilities
    lv = engine.model.level
    names = [z["name"] for z in PILOT_ZONES]
    hourly = []
    for h in range(traj.shape[0]):
        levels = [lv(float(p)) for p in traj[h]]
        hourly.append({"h": h, "time": (simulator.sim_time + timedelta(hours=h)).strftime("%a %H:%M"),
                       "avg_risk_score": round(float(np.mean([engine.risk_score(float(p)) for p in traj[h]])), 3),
                       "high_risk_zones": sum(1 for l in levels if RANK[l] >= 2),
                       "severe_zones": sum(1 for l in levels if l == "SEVERE"),
                       "city_rain_mm_h": round(float(simulator.latest_forecast[h - 1].mean()) if h else float(simulator.rain_hist[-1].mean()), 1),
                       "city_risk": city_level(levels)})
    horizons = []
    for label, h in [("NOW", 0), ("+3H", 3), ("+6H", 6), ("+12H", 12), ("+24H", 24), ("+48H", 48)]:
        order = np.argsort(-traj[h])[:3]
        horizons.append({**hourly[h], "horizon": label, "hours": h,
                         "expected_rain_mm": round(float(simulator.latest_forecast[:h].mean(axis=1).sum()), 1) if h else 0.0,
                         "affected_hotspots": [names[i] for i in order if traj[h][i] >= engine.model.thresholds["MEDIUM"]]})
    return {"model": engine.model.version, "thresholds": engine.model.thresholds,
            "evaluation_status": "Evaluated on held-out synthetic seasons - see /api/model",
            "horizons": horizons, "hourly": hourly}


@app.get("/api/threats", summary="Zones the model expects to reach HIGH/SEVERE within 24 h")
def get_threats():
    return {"sim_time": simulator.sim_time.isoformat(), "threats": alert_manager.threats(simulator)}


# ---------------------------------------------------------------------------- 2. rainfall
@app.get("/api/rainfall/current")
def get_current_rainfall():
    return {"status": "ONLINE", "readings": [
        {"zone_id": z["id"], "zone_name": z["name"], "rain_1h_rate_mm_h": round(float(simulator.rain_hist[-1, i]), 1),
         "rain_24h_mm": round(float(simulator.rain_hist[-24:, i].sum()), 1)} for i, z in enumerate(PILOT_ZONES)]}


@app.get("/api/rainfall/forecast")
def get_rainfall_forecast():
    fc = simulator.latest_forecast
    city = fc.mean(axis=1)
    out, prev = [], float(simulator.rain_hist[-1].mean())
    for label, a, b in [("Next 3 h", 0, 3), ("+3 to +6 h", 3, 6), ("+6 to +12 h", 6, 12), ("+12 to +24 h", 12, 24), ("+24 to +48 h", 24, 48)]:
        seg = city[a:b]
        peak = float(fc[a:b].max())
        trend = "Rising" if seg.mean() > prev + 0.5 else "Easing" if seg.mean() < prev - 0.5 else "Steady"
        prev = float(seg.mean())
        out.append({"time": label, "expected_rain_mm": round(float(seg.sum()), 1), "intensity_mm_h": round(float(seg.max()), 1),
                    "max_zone_intensity_mm_h": round(peak, 1), "trend": trend})
    return {"source": "Simulated storm-cell forecast" if simulator.data_mode == "simulator" else "Open-Meteo hourly forecast",
            "timeline": out, "hourly_city_mm_h": city.round(2).tolist()}


def _rain_class_hour(mm: float) -> str:
    return "None" if mm < 0.2 else "Light" if mm < 2.5 else "Moderate" if mm < 7.6 else "Heavy" if mm < 50 else "Violent"


def _rain_class_day(mm: float) -> str:   # IMD 24-hour categories
    return ("No rain" if mm < 2.5 else "Light" if mm < 15.6 else "Moderate" if mm < 64.5 else "Heavy" if mm < 115.6
            else "Very heavy" if mm < 204.5 else "Extremely heavy")


@app.get("/api/rainfall/timeline", summary="Live rainfall: last 48 h observed, next 48 h forecast, per-zone totals")
def get_rainfall_timeline():
    s = simulator
    hist, fc = s.rain_hist, s.latest_forecast
    t0 = s.sim_time
    since_midnight = t0.hour + 1
    city_now = float(hist[-1].mean())
    zones = []
    for i, z in enumerate(PILOT_ZONES):
        r = hist[:, i]
        zones.append({"zone_id": z["id"], "zone_name": z["name"], "now_mm_h": round(float(r[-1]), 1),
                      "last_3h_mm": round(float(r[-3:].sum()), 1), "today_mm": round(float(r[-since_midnight:].sum()), 1),
                      "last_24h_mm": round(float(r[-24:].sum()), 1), "last_72h_mm": round(float(r[-72:].sum()), 1),
                      "next_6h_mm": round(float(fc[:6, i].sum()), 1), "next_24h_mm": round(float(fc[:24, i].sum()), 1),
                      "class_now": _rain_class_hour(float(r[-1])), "class_24h": _rain_class_day(float(r[-24:].sum()))})
    past = [{"h": -47 + k, "time": (t0 - timedelta(hours=47 - k)).strftime("%a %H:%M"),
             "city_mm": round(float(hist[-48 + k].mean()), 2), "max_mm": round(float(hist[-48 + k].max()), 1)} for k in range(48)]
    future = [{"h": k + 1, "time": (t0 + timedelta(hours=k + 1)).strftime("%a %H:%M"),
               "city_mm": round(float(fc[k].mean()), 2), "max_mm": round(float(fc[k].max()), 1)} for k in range(min(48, len(fc)))]
    wettest = max(zones, key=lambda z: z["last_24h_mm"])
    return {"sim_time": t0.isoformat(), "data_mode": s.data_mode,
            "source": "Simulated rain gauges" if s.data_mode == "simulator" else "Open-Meteo (live)",
            "city": {"now_mm_h": round(city_now, 2), "class_now": _rain_class_hour(city_now),
                     "today_mm": round(float(hist[-since_midnight:].mean(axis=1).sum()), 1),
                     "last_24h_mm": round(float(hist[-24:].mean(axis=1).sum()), 1),
                     "next_6h_mm": round(float(fc[:6].mean(axis=1).sum()), 1),
                     "next_24h_mm": round(float(fc[:24].mean(axis=1).sum()), 1),
                     "raining_zones": sum(1 for z in zones if z["now_mm_h"] >= 0.2),
                     "wettest_zone": wettest["zone_name"], "wettest_24h_mm": wettest["last_24h_mm"]},
            "zones": sorted(zones, key=lambda z: -z["last_24h_mm"]), "past_48h": past, "next_48h": future}


# ---------------------------------------------------------------------------- 3. sensors & data quality
@app.get("/api/sensors")
def get_sensors():
    s = simulator.sensor_readings
    return {"total_sensors": len(s), "online_count": sum(1 for x in s if x.status == "ONLINE"),
            "anomaly_count": sum(1 for x in s if x.is_anomaly), "sensors": s}


@app.get("/api/data-quality")
def get_data_quality():
    rep = engine.model.meta.get("cleaning_report", {})
    return {"data_mode": simulator.data_mode, "data_mode_error": simulator.data_mode_error,
            "training_cleaning_report": rep,
            "quality_score_pct": round(100 * (1 - sum(rep.get(k, 0) for k in ("negative", "spike", "stuck", "gap")) / max(1, rep.get("rows", 1))), 2),
            "anomalies_detected": simulator.anomaly_log[:15],
            "validation_rules_active": ["Negative depth filter", "Physical spike gate (>150 mm/h, or >60 mm/h vs 8x neighbour median)",
                                        "Stuck-gauge detector (>=6 identical non-zero readings)", "Gap filling (spatial median / interpolation)"]}


@app.get("/api/data-source")
def get_data_source():
    return {"mode": simulator.data_mode, "error": simulator.data_mode_error, "available": ["simulator", "open-meteo"]}


@app.post("/api/data-source")
def set_data_source(mode: str = Query(...)):
    try:
        m = simulator.set_data_mode(mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"mode": m, "error": simulator.data_mode_error}


# ---------------------------------------------------------------------------- 4. satellite (computed comparison)
@app.get("/api/satellite")
def get_satellite():
    pred = {z["id"] for z in PILOT_ZONES if RANK[simulator.by_zone[z["id"]]["risk_level"]] >= 2}
    obs = {z["id"] for i, z in enumerate(PILOT_ZONES) if simulator.flooded[i] or simulator.ponding[i] > 8}
    area = lambda ids: round(sum(engine.areas[i] for i in ids), 2)
    inter, union = pred & obs, pred | obs
    return {"satellite_name": "Sentinel-1 SAR (simulated observation)",
            "acquisition_time": simulator.sim_time.strftime("%Y-%m-%d %H:%M"),
            "observation_type": "Zone-level flooded/not-flooded comparison", "resolution_m": 10,
            "affected_corridors": [ZONE_BY_ID[i]["name"] for i in sorted(obs)],
            "predicted_zones": sorted(pred), "observed_zones": sorted(obs),
            "predicted_extent_sq_km": area(pred), "observed_extent_sq_km": area(obs),
            "spatial_overlap_iou": round(area(inter) / area(union), 3) if union else None,
            "precision": round(area(inter) / area(pred), 3) if pred else None,
            "recall": round(area(inter) / area(obs), 3) if obs else None,
            "layer_label": "Simulated SAR observation (demo) - real Sentinel-1 ingestion not connected",
            "description": "Observed flooding comes from the simulator's ground truth; the scores compare it with zones the model "
                           "currently rates HIGH or SEVERE. Plug in Sentinel-1 flood masks to make this a real check."}


# ---------------------------------------------------------------------------- 5. alerts
@app.get("/api/alerts")
def get_alerts(status: Optional[str] = Query(None)):
    return {"alerts": alert_manager.get_alerts(status), "active_count": len(alert_manager.get_alerts("ACTIVE"))}


def _lifecycle(fn, alert_id, msg):
    res = fn(alert_id)
    if not res:
        raise HTTPException(404, "Alert not found")
    return {"message": msg, "alert": res}


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str): return _lifecycle(alert_manager.acknowledge_alert, alert_id, "Alert acknowledged")

@app.post("/api/alerts/{alert_id}/escalate")
def escalate_alert(alert_id: str): return _lifecycle(alert_manager.escalate_alert, alert_id, "Alert escalated to central control room")

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str): return _lifecycle(alert_manager.resolve_alert, alert_id, "Alert marked as resolved")


@app.get("/api/verification", summary="Were floods warned in advance? (simulator ground truth)")
def get_verification():
    return simulator.verification_summary()


# ---------------------------------------------------------------------------- 6. what-if
@app.post("/api/scenarios", response_model=WhatIfResponse)
def run_scenario(req: WhatIfRequest):
    s = simulator
    with s.lock:
        res = engine.scenario(s.rain_hist, s.level_hist, s.hydro, req.rainfall_intensity_mm_h, req.duration_hours,
                              req.antecedent_rainfall_mm, req.drainage_capacity_pct, req.lake_fill_pct)
    base = {z["zone_id"]: z for z in s.latest["zones"]}
    deltas, b_hi, b_sev, s_hi, s_sev, b_area, s_area = [], 0, 0, 0, 0, 0.0, 0.0
    for r in res:
        b = base[r["zone_id"]]
        bl = b["risk_level"]
        b_hi += RANK[bl] >= 2; b_sev += bl == "SEVERE"; s_hi += RANK[r["risk_level"]] >= 2; s_sev += r["risk_level"] == "SEVERE"
        b_area += r["area_km2"] if RANK[bl] >= 2 else 0; s_area += r["area_km2"] if RANK[r["risk_level"]] >= 2 else 0
        deltas.append({"zone_id": r["zone_id"], "zone_name": r["zone_name"], "baseline_prob": round(b["probability"], 4),
                       "baseline_risk": bl, "baseline_score": b["risk_score"], "scenario_prob": r["peak_prob"],
                       "scenario_risk": r["risk_level"], "scenario_score": r["risk_score"], "peak_hour": r["peak_hour"],
                       "max_ponding_mm": r["max_ponding_mm"], "max_drain_level_m": r["max_drain_level_m"],
                       "prob_delta": round(r["peak_prob"] - b["probability"], 4), "area_km2": r["area_km2"]})
    overflow = sum(1 for r in res if r["max_ponding_mm"] > 1)
    summary = (f"A {req.rainfall_intensity_mm_h:.0f} mm/h storm lasting {req.duration_hours:g} h, with drains at "
               f"{req.drainage_capacity_pct:.0f}% capacity and lakes {req.lake_fill_pct:.0f}% full, puts {s_hi} of 18 zones at "
               f"HIGH or SEVERE risk (now: {b_hi}). Predicted flood-prone area: {s_area:.1f} sq km. "
               f"Drains overflow onto streets in {overflow} zones.")
    return WhatIfResponse(scenario_id=f"SCEN-{int(time.time())}", baseline_high_risk_zones=b_hi, baseline_severe_risk_zones=b_sev,
                          scenario_high_risk_zones=s_hi, scenario_severe_risk_zones=s_sev,
                          delta_affected_area_sq_km=round(max(0.0, s_area - b_area), 1),
                          baseline_affected_area_sq_km=round(b_area, 1), scenario_affected_area_sq_km=round(s_area, 1),
                          drains_overflowing=overflow, zone_deltas=sorted(deltas, key=lambda d: -d["scenario_prob"]),
                          summary_insight=summary)


# ---------------------------------------------------------------------------- 7. GIS layers & history
@app.get("/api/infrastructure")
def get_infrastructure(): return {"infrastructure": CRITICAL_INFRASTRUCTURE}

@app.get("/api/lakes")
def get_lakes(): return {"lakes": BENGALURU_LAKES}

@app.get("/api/drains")
def get_drains(): return {"drains": PRIMARY_STORMWATER_DRAINS}

@app.get("/api/historical-events")
def get_historical_events(): return {"event": HISTORICAL_DELUGE_2022}


# ---------------------------------------------------------------------------- 8. model & backtest
@app.get("/api/model", summary="Training metrics, thresholds, feature importance, calibration")
def get_model():
    meta = dict(engine.model.meta)
    meta.pop("drainage_index", None)
    return meta


@app.get("/api/backtest/2022", summary="Sept 2022 deluge backtest (reconstructed rainfall)")
def get_backtest():
    p = MODEL_DIR / "backtest_2022.json"
    if not p.exists():
        raise HTTPException(404, "Run python -m ml.train to generate the backtest")
    return json.loads(p.read_text())


# ---------------------------------------------------------------------------- 9. assistant
@app.get("/api/ai/status", summary="Which LLM provider powers the assistant")
def ai_status():
    return ai_assistant.status()


@app.post("/api/ai/query", response_model=GenAIQueryResponse)
def query_ai(req: GenAIQueryRequest):
    return ai_assistant.answer_query(req.query, req.role, req.gemini_api_key)


# ---------------------------------------------------------------------------- 10. health
@app.get("/api/system-health")
def get_system_health():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    m = engine.model.meta
    om_ok = simulator.data_mode == "open-meteo" and not simulator.data_mode_error
    comps = [
        SystemHealthItem(component="REST API (FastAPI)", status="ONLINE", latency_ms=0, records_processed=simulator.tick_count,
                         last_heartbeat=now, details=f"Up {int(time.time() - STARTED)} s"),
        SystemHealthItem(component="Flood model (XGBoost, calibrated)", status="ONLINE", latency_ms=0,
                         records_processed=len(PILOT_ZONES) * 49 * max(1, simulator.tick_count), last_heartbeat=now,
                         details=f"{m['version']}, {len(m['features'])} features, test ROC-AUC {m['metrics']['tuned_xgb_14']['roc_auc']}"),
        SystemHealthItem(component="Telemetry stream", status="ONLINE" if simulator.is_running else "DEGRADED", latency_ms=0,
                         records_processed=simulator.tick_count * 54, last_heartbeat=now,
                         details=f"{simulator.data_mode} mode, 1 tick = 1 hour" if simulator.data_mode == "simulator" else "Open-Meteo, refreshed every 15 min"),
        SystemHealthItem(component="Public data adapter (Open-Meteo)", status="ONLINE" if om_ok else "OFFLINE", latency_ms=0,
                         records_processed=0, last_heartbeat=now, details=simulator.data_mode_error or ("Connected" if om_ok else "Not in use")),
        SystemHealthItem(component="Alert engine", status="ONLINE", latency_ms=0, records_processed=len(alert_manager.alerts),
                         last_heartbeat=now, details=f"{len(alert_manager.get_alerts('ACTIVE'))} active alerts"),
        SystemHealthItem(component="GenAI assistant", status="ONLINE" if not ai_assistant.last_error else "DEGRADED", latency_ms=0,
                         records_processed=0, last_heartbeat=now,
                         details=(f"{ai_assistant.status()['provider']} / {ai_assistant.status()['model']}" if ai_assistant.status()["configured"]
                                  else "Template answers (add an API key to backend/.env for an LLM)")
                                 + (f" - last error: {ai_assistant.last_error}" if ai_assistant.last_error else "")),
        SystemHealthItem(component="Database (PostgreSQL/PostGIS)", status="OFFLINE", latency_ms=0, records_processed=0,
                         last_heartbeat=now, details="Schema in backend/schema.sql; prototype runs in-memory"),
    ]
    return {"status": "ONLINE", "components": comps}


# ---------------------------------------------------------------------------- 11. simulation control
@app.get("/api/simulation/state")
def get_simulation_state():
    return {"is_running": simulator.is_running, "speed": simulator.simulation_speed, "tick_count": simulator.tick_count,
            "storm_scenario_active": simulator.storm_scenario_active, "storm_step": simulator.storm_step,
            "sim_time": simulator.sim_time.isoformat(), "data_mode": simulator.data_mode,
            "tick_seconds": TICK_SECONDS / max(0.25, simulator.simulation_speed)}


@app.post("/api/simulation/control")
def control_simulation(action: str = Query(..., description="start | pause | reset | storm_mode | speed"),
                       value: Optional[float] = Query(None)):
    try:
        if action == "start": simulator.is_running = True
        elif action == "pause": simulator.is_running = False
        elif action == "reset": simulator.reset()
        elif action == "storm_mode": simulator.trigger_storm_scenario()
        elif action == "speed": simulator.simulation_speed = float(min(4, max(0.25, value or 1)))
        else: raise HTTPException(400, "Invalid action")
    except RuntimeError as e:
        raise HTTPException(409, str(e))
    return {"status": "ok", "action": action, "simulation_state": get_simulation_state()}
