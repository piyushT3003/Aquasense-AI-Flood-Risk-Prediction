"""
AQUASENSE - Model training, tuning, calibration and evaluation (Weeks 5-6).

    cd backend
    python -m ml.train                          # synthetic monsoon history (default)
    python -m ml.train --csv data/your_ksndmc_export.csv   # retrain on real data

Splits are by season (no shuffling), so the test seasons are genuinely unseen:
    train 2016-2021 | validation 2023 | test 2024-2025 | 2022 reserved for the deluge backtest
"""
from __future__ import annotations
import argparse, itertools, json, pathlib, sys, time
from datetime import datetime
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (roc_auc_score, average_precision_score, brier_score_loss,
                             precision_recall_curve, precision_score, recall_score, f1_score, confusion_matrix)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from seed_data import PILOT_ZONES
from pipeline.sources import SyntheticHistorySource, CsvSource, reconstruct_sept_2022
from pipeline.cleaning import clean
from pipeline.features import (BASELINE_FEATURES, ALL_FEATURES, FEATURE_LABELS, build_features,
                               estimate_drainage_index, incident_frequency)

MODEL_DIR = pathlib.Path(__file__).resolve().parents[1] / "models"
TRAIN, VAL, TEST = list(range(2016, 2022)), [2023], [2024, 2025]
MONOTONE = {  # +1: more of this can only raise risk, -1: can only lower it
    "rain_1h_mm": 1, "rain_3h_mm": 1, "rain_24h_mm": 1, "antecedent_72h_mm": 1, "forecast_6h_mm": 1,
    "water_level_m": 1, "drainage_capacity_index": -1, "elevation_m": -1, "slope_degrees": -1,
    "lake_proximity_m": -1, "impervious_ratio": 1, "incident_freq": 1, "rain_trend_3h": 0, "water_rise_1h": 1,
}


def log(msg): print(f"[train] {msg}", flush=True)


def fit_xgb(Xtr, ytr, Xva, yva, params, features, monotone=False):
    dtr = xgb.DMatrix(Xtr[features], label=ytr, feature_names=features)
    dva = xgb.DMatrix(Xva[features], label=yva, feature_names=features)
    p = {"objective": "binary:logistic", "eval_metric": "aucpr", "tree_method": "hist",
         "max_depth": params["max_depth"], "eta": params["eta"], "min_child_weight": params["min_child_weight"],
         "subsample": 0.85, "colsample_bytree": 0.9, "seed": 0}
    if monotone:
        p["monotone_constraints"] = "(" + ",".join(str(MONOTONE.get(f, 0)) for f in features) + ")"
    bst = xgb.train(p, dtr, num_boost_round=params["rounds"], evals=[(dva, "val")],
                    early_stopping_rounds=40, verbose_eval=False)
    return bst


def predict(bst, X, features):
    return bst.predict(xgb.DMatrix(X[features], feature_names=features), iteration_range=(0, bst.best_iteration + 1))


def pick_thresholds(y, p) -> dict:
    """MEDIUM (watch): catches >=85% of floods. HIGH (warning): best F2 - recall-weighted, because a
    missed flood costs more than a false alarm. SEVERE: lowest threshold where >=75% of warnings are right."""
    prec, rec, thr = precision_recall_curve(y, p)
    prec, rec = prec[:-1], rec[:-1]
    med = float(thr[rec >= 0.85].max()) if (rec >= 0.85).any() else float(thr.min())
    med = max(med, 0.02 if p.max() <= 1 else med)
    f2 = 5 * prec * rec / np.maximum(4 * prec + rec, 1e-9)
    high = float(thr[int(np.argmax(f2))])
    ok = prec >= 0.75
    sev = float(thr[ok].min()) if ok.any() else float(np.quantile(p, 0.999))
    high = max(high, med + 0.01)
    sev = max(sev, high + 0.05)
    return {"MEDIUM": round(med, 4), "HIGH": round(high, 4), "SEVERE": round(min(sev, 0.95), 4)}


def scores(y, p, thr_high, is_prob=True) -> dict:
    yhat = (p >= thr_high).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, yhat, labels=[0, 1]).ravel()
    return {"roc_auc": round(float(roc_auc_score(y, p)), 4), "pr_auc": round(float(average_precision_score(y, p)), 4),
            "brier": round(float(brier_score_loss(y, p)), 5) if is_prob else None,
            "precision_at_high": round(float(precision_score(y, yhat, zero_division=0)), 3),
            "recall_at_high": round(float(recall_score(y, yhat, zero_division=0)), 3),
            "f1_at_high": round(float(f1_score(y, yhat, zero_division=0)), 3),
            "confusion_at_high": {"tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)},
            "positives": int(y.sum()), "rows": int(len(y))}


def lead_times(df: pd.DataFrame, p: np.ndarray, thr: float, lookback=12) -> dict:
    """For each flood onset, how many hours earlier did the model first cross the HIGH threshold?"""
    df = df.assign(p=p).sort_values(["zone_id", "time"])
    leads, missed = [], 0
    for _, g in df.groupby("zone_id"):
        inc = g["incident"].to_numpy(); pr = g["p"].to_numpy()
        onsets = np.where((inc == 1) & (np.roll(inc, 1) == 0))[0]
        for o in onsets:
            if o < lookback:
                continue
            window = pr[o - lookback:o]
            hits = np.where(window >= thr)[0]
            if len(hits):
                leads.append(lookback - hits[0])
            else:
                missed += 1
    leads = np.array(leads)
    total = len(leads) + missed
    return {"flood_events": int(total), "warned_in_advance": int(len(leads)),
            "warned_pct": round(100 * len(leads) / max(1, total), 1),
            "median_lead_time_h": float(np.median(leads)) if len(leads) else 0.0,
            "warned_2h_plus_pct": round(100 * float((leads >= 2).sum()) / max(1, total), 1)}


def calibration_curve(y, p):
    edges = np.array([0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0])
    out = []
    for a, b in zip(edges[:-1], edges[1:]):
        m = (p >= a) & (p <= b)
        if m.sum():
            out.append({"predicted": round(float(p[m].mean()), 4), "observed": round(float(y[m].mean()), 4), "n": int(m.sum())})
    return out


def backtest_2022(bst, calibrator, features, thresholds, drainage_index, inc_freq) -> dict:
    raw, peak = reconstruct_sept_2022(PILOT_ZONES)
    feats = build_features(raw, PILOT_ZONES, drainage_index, inc_freq, with_target=False)
    feats["p"] = np.clip(calibrator.predict(predict(bst, feats, features)), 0.001, 0.99)
    feats["hours_to_peak"] = ((feats["time"] - pd.Timestamp(peak)) / pd.Timedelta(hours=1)).astype(int)
    window = feats[feats["hours_to_peak"].between(-36, 12)]
    names = {z["id"]: z["name"] for z in PILOT_ZONES}
    timeline = []
    for h, g in window.groupby("hours_to_peak"):
        timeline.append({"h": int(h), "city_rain_mm": round(float(g["rain_mm"].mean()), 1),
                         "mean_prob": round(float(g["p"].mean()), 3),
                         "zones_high": int((g["p"] >= thresholds["HIGH"]).sum()),
                         "zones_severe": int((g["p"] >= thresholds["SEVERE"]).sum()),
                         "zones_flooded": int(g["incident"].sum())})
    zones = []
    for zid, g in window.groupby("zone_id"):
        g = g.sort_values("hours_to_peak")
        first_inc = g.loc[g["incident"] == 1, "hours_to_peak"]
        first_high = g.loc[g["p"] >= thresholds["HIGH"], "hours_to_peak"]
        first_sev = g.loc[g["p"] >= thresholds["SEVERE"], "hours_to_peak"]
        row = {"zone_id": zid, "zone": names[zid], "peak_prob": round(float(g["p"].max()), 3),
               "flooded": bool(len(first_inc)),
               "first_flood_h": int(first_inc.iloc[0]) if len(first_inc) else None,
               "first_high_h": int(first_high.iloc[0]) if len(first_high) else None,
               "first_severe_h": int(first_sev.iloc[0]) if len(first_sev) else None}
        lead = lambda first: (row["first_flood_h"] - first if row["flooded"] and first is not None
                              and first <= row["first_flood_h"] else None)
        row["lead_time_h"] = lead(row["first_high_h"])
        row["severe_lead_time_h"] = lead(row["first_severe_h"])
        zones.append(row)
    flooded = [z for z in zones if z["flooded"]]
    warned = [z for z in flooded if z["lead_time_h"] is not None]
    false_alarms = [z for z in zones if not z["flooded"] and z["first_high_h"] is not None]
    return {"event": "Bengaluru deluge, 4-5 Sept 2022 (reconstructed rainfall)", "peak_time": peak.isoformat(),
            "note": "Hourly rainfall rebuilt from the event timeline; flooding simulated by the hydrology model. "
                    "Not observed gauge data - replace with KSNDMC records for a true backtest.",
            "zones_flooded": len(flooded), "zones_warned_before_flooding": len(warned),
            "median_lead_time_h": float(np.median([z["lead_time_h"] for z in warned])) if warned else None,
            "median_severe_lead_time_h": (float(np.median([z["severe_lead_time_h"] for z in flooded if z["severe_lead_time_h"] is not None]))
                                          if any(z["severe_lead_time_h"] is not None for z in flooded) else None),
            "false_alarm_zones": len(false_alarms),
            "timeline": timeline, "zones": sorted(zones, key=lambda z: -z["peak_prob"])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="train on a KSNDMC/BBMP style CSV instead of synthetic history")
    ap.add_argument("--quick", action="store_true", help="smaller grid for a fast run")
    args = ap.parse_args()
    run(csv=args.csv, quick=args.quick)


def run(csv: str | None = None, quick: bool = False):
    class _A: pass
    args = _A(); args.csv, args.quick = csv, quick
    t0 = time.time()

    # ---- Week 3: ingestion ----
    if args.csv:
        raw = CsvSource(args.csv).load(); source = f"csv:{args.csv}"
        raw["season"] = pd.to_datetime(raw["time"]).dt.year
    else:
        raw = SyntheticHistorySource(PILOT_ZONES, TRAIN + VAL + TEST, seed=7).load(); source = "synthetic monsoon history"
    log(f"ingested {len(raw):,} zone-hours from {source}")

    # ---- Week 4: cleaning + features ----
    df, clean_report = clean(raw)
    log(f"cleaning: {clean_report}")
    df["season"] = pd.to_datetime(df["time"]).dt.year
    train_df = df[df["season"].isin(TRAIN)]
    drainage_index = estimate_drainage_index(train_df)
    inc_freq = incident_frequency(train_df)
    feats = build_features(df, PILOT_ZONES, drainage_index, inc_freq)
    tr, va, te = (feats[feats["season"].isin(s)] for s in (TRAIN, VAL, TEST))
    ytr, yva, yte = (d["flood_next_6h"].astype(int).to_numpy() for d in (tr, va, te))
    log(f"features: train {len(tr):,} | val {len(va):,} | test {len(te):,} | positive rate {ytr.mean():.4f}")

    results = {}
    # Rule-of-thumb baseline: what a duty officer might eyeball (recent + forecast rain)
    rule = lambda d: (d["rain_3h_mm"] + d["forecast_6h_mm"]).to_numpy()
    rthr = pick_thresholds(yva, rule(va))
    results["rule_rain_threshold"] = {**scores(yte, rule(te), rthr["HIGH"], is_prob=False), "threshold_mm": rthr["HIGH"], "features": ["rain_3h_mm", "forecast_6h_mm"]}

    # ---- Week 5: baseline 12-feature model ----
    base_params = {"max_depth": 6, "eta": 0.1, "min_child_weight": 1, "rounds": 300}
    bst_base = fit_xgb(tr, ytr, va, yva, base_params, BASELINE_FEATURES)
    pb_va, pb_te = predict(bst_base, va, BASELINE_FEATURES), predict(bst_base, te, BASELINE_FEATURES)
    bthr = pick_thresholds(yva, pb_va)
    results["baseline_xgb_12"] = {**scores(yte, pb_te, bthr["HIGH"]), "features": BASELINE_FEATURES, "params": base_params}
    log(f"baseline 12-feature: {results['baseline_xgb_12']['roc_auc']} ROC-AUC, {results['baseline_xgb_12']['pr_auc']} PR-AUC")

    # ---- Week 6: tuning (grid on validation PR-AUC), monotone constraints, calibration ----
    grid = {"max_depth": [3, 4, 5], "eta": [0.05, 0.1], "min_child_weight": [1, 5]}
    if args.quick:
        grid = {"max_depth": [4], "eta": [0.1], "min_child_weight": [5]}
    tuning = []
    best = None
    for md, eta, mcw in itertools.product(grid["max_depth"], grid["eta"], grid["min_child_weight"]):
        params = {"max_depth": md, "eta": eta, "min_child_weight": mcw, "rounds": 800}
        bst = fit_xgb(tr, ytr, va, yva, params, ALL_FEATURES, monotone=True)
        ap_va = float(average_precision_score(yva, predict(bst, va, ALL_FEATURES)))
        tuning.append({**params, "best_rounds": bst.best_iteration + 1, "val_pr_auc": round(ap_va, 4)})
        log(f"  tune depth={md} eta={eta} mcw={mcw} -> val PR-AUC {ap_va:.4f}")
        if best is None or ap_va > best[0]:
            best = (ap_va, bst, params)
    _, bst, best_params = best
    raw_va, raw_te = predict(bst, va, ALL_FEATURES), predict(bst, te, ALL_FEATURES)
    calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(raw_va, yva)
    p_va, p_te = np.clip(calibrator.predict(raw_va), 0.001, 0.99), np.clip(calibrator.predict(raw_te), 0.001, 0.99)
    thresholds = pick_thresholds(yva, p_va)
    results["tuned_xgb_14"] = {**scores(yte, p_te, thresholds["HIGH"]), "features": ALL_FEATURES,
                               "params": {**best_params, "rounds": bst.best_iteration + 1, "monotone_constraints": True,
                                          "calibration": "isotonic (validation season)"}}
    log(f"tuned 14-feature: {results['tuned_xgb_14']['roc_auc']} ROC-AUC, {results['tuned_xgb_14']['pr_auc']} PR-AUC")

    lead = lead_times(te, p_te, thresholds["HIGH"])
    lead_severe = lead_times(te, p_te, thresholds["SEVERE"])
    lead_base = lead_times(te, pb_te, bthr["HIGH"])
    log(f"lead time (tuned): {lead}")

    # Global explanations: gain importance + mean |SHAP| on a test sample
    sample = te.sample(min(20000, len(te)), random_state=0)
    contrib = bst.predict(xgb.DMatrix(sample[ALL_FEATURES], feature_names=ALL_FEATURES), pred_contribs=True,
                          iteration_range=(0, bst.best_iteration + 1))[:, :-1]
    shap_mean = np.abs(contrib).mean(axis=0)
    importance = sorted([{"feature": f, "label": FEATURE_LABELS[f], "mean_abs_shap": round(float(v), 4),
                          "share_pct": round(100 * float(v / shap_mean.sum()), 1)} for f, v in zip(ALL_FEATURES, shap_mean)],
                        key=lambda d: -d["mean_abs_shap"])

    backtest = backtest_2022(bst, calibrator, ALL_FEATURES, thresholds, drainage_index, inc_freq)
    log(f"2022 backtest: {backtest['zones_flooded']} zones flooded, {backtest['zones_warned_before_flooding']} warned in advance, "
        f"median lead {backtest['median_lead_time_h']} h (SEVERE: {backtest['median_severe_lead_time_h']} h), {backtest['false_alarm_zones']} false-alarm zones")

    # ---- save ----
    MODEL_DIR.mkdir(exist_ok=True)
    bst_final = bst[: bst.best_iteration + 1]
    bst_final.save_model(str(MODEL_DIR / "risk_model.json"))
    (MODEL_DIR / "calibrator.json").write_text(json.dumps({
        "x": [float(v) for v in calibrator.X_thresholds_], "y": [float(v) for v in calibrator.y_thresholds_]}))
    meta = {
        "version": "AquaSense-XGB-v3", "trained_at": datetime.now().isoformat(timespec="seconds"),
        "data_source": source, "target": "waterlogging incident in the zone within the next 6 hours",
        "splits": {"train": TRAIN, "validation": VAL, "test": TEST, "backtest": [2022]},
        "features": ALL_FEATURES, "feature_labels": FEATURE_LABELS, "thresholds": thresholds,
        "drainage_index": drainage_index, "incident_freq": inc_freq,
        "cleaning_report": clean_report, "metrics": results,
        "lead_time": {"tuned": lead, "tuned_severe": lead_severe, "baseline": lead_base},
        "tuning": tuning, "importance": importance,
        "calibration_curve": calibration_curve(yte, p_te),
        "training_seconds": round(time.time() - t0, 1),
        "disclaimer": "Trained and evaluated on synthetic monsoon data generated by a hydrology model. "
                      "Metrics show the pipeline works end to end; they are not claims about real-world accuracy.",
    }
    (MODEL_DIR / "model_meta.json").write_text(json.dumps(meta, indent=2))
    (MODEL_DIR / "backtest_2022.json").write_text(json.dumps(backtest, indent=2))
    log(f"saved to {MODEL_DIR} in {meta['training_seconds']} s")


if __name__ == "__main__":
    main()
