"""
AquaSense behaviour tests.   Run from the backend folder:   python -m pytest -q test_api.py
(or plain:  python test_api.py)

These check what the system DOES, not just that fields exist:
calm weather stays calm, storms are warned before flooding, alerts are unique,
the assistant answers the right question, what-if inputs matter, the model beats its baseline.
"""
import json, pathlib
from fastapi.testclient import TestClient

import main
from main import app

client = TestClient(app)
sim = main.simulator
LEVEL = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "SEVERE": 3}


def reset():
    client.post("/api/simulation/control?action=reset")


def test_trained_model_is_loaded_and_beats_baseline():
    m = client.get("/api/model").json()
    assert m["version"].startswith("AquaSense-XGB")
    tuned, base, rule = m["metrics"]["tuned_xgb_14"], m["metrics"]["baseline_xgb_12"], m["metrics"]["rule_rain_threshold"]
    assert tuned["pr_auc"] > base["pr_auc"] > rule["pr_auc"]
    assert tuned["roc_auc"] > 0.75
    assert m["thresholds"]["MEDIUM"] < m["thresholds"]["HIGH"] < m["thresholds"]["SEVERE"]


def test_calm_weather_produces_no_false_alarms():
    reset()
    for _ in range(24):
        sim.step()
    risk = client.get("/api/risk/current").json()
    assert risk["high_risk_zones_count"] == 0
    assert client.get("/api/alerts?status=ACTIVE").json()["active_count"] == 0


def test_storm_is_warned_before_it_floods():
    reset()
    client.post("/api/simulation/control?action=storm_mode")
    threats = client.get("/api/threats").json()["threats"]
    assert len(threats) >= 3, "the incoming storm should show up as threats while it is still dry"
    assert sim.rain_hist[-1].max() < 5, "no heavy rain yet at the moment of the warning"
    for _ in range(12):
        sim.step()
    v = client.get("/api/verification").json()
    assert v["flood_events"] >= 3
    assert v["warned_in_advance"] / v["flood_events"] >= 0.8
    assert v["median_lead_time_h"] >= 2


def test_alert_ids_are_unique_and_lifecycle_works():
    alerts = client.get("/api/alerts").json()["alerts"]
    ids = [a["id"] for a in alerts]
    assert len(ids) == len(set(ids)) and len(ids) > 0
    assert any(a["trigger_type"] == "FORECAST_THREAT" for a in alerts)
    target = alerts[-1]["id"]
    assert client.post(f"/api/alerts/{target}/acknowledge").json()["alert"]["status"] == "ACKNOWLEDGED"
    others = [a for a in client.get("/api/alerts").json()["alerts"] if a["id"] != target]
    assert all(a["status"] != "ACKNOWLEDGED" for a in others), "acknowledging one alert must not touch another"
    assert client.post("/api/alerts/nope/resolve").status_code == 404


def test_assistant_routes_questions_correctly():
    a = client.post("/api/ai/query", json={"query": "Why is Bellandur at high risk?"}).json()
    assert a["answer"].startswith("**Bellandur") and "SHAP" in a["answer"]
    b = client.post("/api/ai/query", json={"query": "Which high-risk zones overlap with critical infrastructure?"}).json()
    assert "infrastructure" in b["confidence_level"]
    c = client.post("/api/ai/query", json={"query": "What is the forecast for the next 24 hours?"}).json()
    assert "outlook" in c["answer"].lower()


def test_what_if_inputs_change_the_result():
    base = {"rainfall_intensity_mm_h": 45, "duration_hours": 2, "antecedent_rainfall_mm": 40, "drainage_capacity_pct": 100, "lake_fill_pct": 80}
    run = lambda **kw: client.post("/api/scenarios", json={**base, **kw}).json()
    reset()
    short, long_ = run(duration_hours=1), run(duration_hours=6)
    assert long_["scenario_affected_area_sq_km"] >= short["scenario_affected_area_sq_km"]
    assert sum(d["scenario_prob"] for d in long_["zone_deltas"]) > sum(d["scenario_prob"] for d in short["zone_deltas"])
    choked, clear = run(drainage_capacity_pct=50), run(drainage_capacity_pct=120)
    assert choked["scenario_high_risk_zones"] >= clear["scenario_high_risk_zones"]
    assert run(rainfall_intensity_mm_h=10, duration_hours=1)["scenario_high_risk_zones"] == 0


def test_spike_gate_quarantines_bad_gauge():
    reset()
    for _ in range(30):
        sim.step()
    dq = client.get("/api/data-quality").json()
    assert dq["anomalies_detected"], "a gauge glitch is injected about once a day of simulated time"
    assert sim.rain_hist.max() < 150, "spikes must never reach the model"


def test_open_meteo_adapter_drives_live_predictions(monkeypatch):
    """Offline check of the public-data path with a payload shaped like Open-Meteo's real response."""
    import pandas as pd
    from datetime import datetime
    from seed_data import PILOT_ZONES
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    times = pd.date_range(now - pd.Timedelta(hours=96), now + pd.Timedelta(hours=48), freq="h")
    rain = [0.0] * len(times)
    for k in range(98, 102):          # a 4-hour, 40 mm/h burst forecast 2-5 h from now
        rain[k] = 40.0
    payload = [{"latitude": z["center"]["lat"], "longitude": z["center"]["lng"],
                "hourly": {"time": [t.strftime("%Y-%m-%dT%H:%M") for t in times], "precipitation": rain}} for z in PILOT_ZONES]
    monkeypatch.setattr(sim.open_meteo, "fetch", lambda: sim.open_meteo.parse(payload))
    r = client.post("/api/data-source?mode=open-meteo").json()
    assert r["mode"] == "open-meteo" and r["error"] is None
    threats = client.get("/api/threats").json()["threats"]
    assert threats, "a forecast 40 mm/h burst should raise threats"
    assert client.post("/api/simulation/control?action=storm_mode").status_code == 409

    def boom():
        raise OSError("network unreachable")
    monkeypatch.setattr(sim.open_meteo, "fetch", boom)
    sim.step()
    ds = client.get("/api/data-source").json()
    assert ds["mode"] == "simulator" and "unavailable" in ds["error"]
    client.post("/api/data-source?mode=simulator")


def test_citizen_role_is_read_only():
    h = {"X-AquaSense-Role": "Citizen"}
    assert client.post("/api/simulation/control?action=storm_mode", headers=h).status_code == 403
    assert client.post("/api/data-source?mode=open-meteo", headers=h).status_code == 403
    assert client.get("/api/zones", headers=h).status_code == 200          # reading is fine
    a = client.post("/api/ai/query", json={"query": "Is Koramangala safe?", "role": "Citizen"}).json()
    assert "SHAP" not in a["answer"] and "BBMP" in a["answer"]


def test_rainfall_timeline_and_rain_questions():
    r = client.get("/api/rainfall/timeline").json()
    assert len(r["past_48h"]) == 48 and len(r["zones"]) == 18 and "today_mm" in r["city"]
    a = client.post("/api/ai/query", json={"query": "Will it rain heavily in the next 6 hours?"}).json()
    assert a["answer"].startswith("**Expect")


def test_backend_llm_provider_is_used(monkeypatch):
    import genai_service
    seen = {}
    def fake(provider, key, model, system, user, timeout=15):
        seen.update(provider=provider, model=model, has_live_data="LIVE DATA" in user)
        return "**LLM answer** grounded in live data."
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("AQUASENSE_LLM_PROVIDER", "groq")
    monkeypatch.setattr(genai_service, "call_llm", fake)
    a = client.post("/api/ai/query", json={"query": "Which areas are at risk?"}).json()
    assert a["answer"].startswith("**LLM answer**") and seen["provider"] == "groq" and seen["has_live_data"]
    assert client.get("/api/ai/status").json()["configured"] is True

    def broken(*a, **k):
        raise RuntimeError("401 bad key test-key")
    monkeypatch.setattr(genai_service, "call_llm", broken)
    b = client.post("/api/ai/query", json={"query": "Which areas are at risk?"}).json()
    assert not b["answer"].startswith("**LLM answer**")            # falls back to grounded template
    st = client.get("/api/ai/status").json()
    assert st["last_error"] and "test-key" not in st["last_error"]  # key never leaks


def test_forecast_and_backtest_are_computed():
    f = client.get("/api/risk/forecast").json()
    assert len(f["hourly"]) == 49 and [h["horizon"] for h in f["horizons"]][0] == "NOW"
    bt = client.get("/api/backtest/2022").json()
    assert bt["zones_flooded"] >= 1 and bt["zones_warned_before_flooding"] >= 1


if __name__ == "__main__":
    import inspect, sys
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and inspect.isfunction(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn(); print(f"PASS  {name}")
        except AssertionError as e:
            failed += 1; print(f"FAIL  {name}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
