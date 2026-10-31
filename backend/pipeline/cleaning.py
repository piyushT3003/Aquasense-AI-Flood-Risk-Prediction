"""
AQUASENSE - Telemetry cleaning (Week 4).

Rules (applied per hour across the city, so every fix uses neighbouring gauges):
  1. Negative depth filter      rain < 0                          -> 0
  2. Physical spike gate        rain > 150 mm/h, or > 60 mm/h while
                                the neighbouring median is < 1/8 of it -> spatial median
  3. Stuck-gauge detector       >= 6 identical non-zero readings while neighbours
                                vary or disagree by > 1 mm/h        -> spatial median
  4. Gap filling                missing rain -> spatial median; missing water level ->
                                linear interpolation (<= 3 h), then forward fill
Each repaired value is flagged in `clean_flag` so the dashboard can show it.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = df.sort_values(["time", "zone_id"]).reset_index(drop=True).copy()
    df["clean_flag"] = ""
    rain = df.pivot(index="time", columns="zone_id", values="rain_mm")
    flags = pd.DataFrame("", index=rain.index, columns=rain.columns)

    neg = rain < 0
    flags[neg] = "negative"
    rain = rain.mask(neg, 0.0)

    med = rain.median(axis=1, skipna=True)
    neigh = pd.DataFrame(np.repeat(med.values[:, None], rain.shape[1], axis=1), index=rain.index, columns=rain.columns)
    spike = (rain > 150) | ((rain > 60) & (rain > 8 * neigh + 30))
    flags[spike] = "spike"
    rain = rain.mask(spike)

    stuck = pd.DataFrame(False, index=rain.index, columns=rain.columns)
    for c in rain.columns:
        s = rain[c]
        same = s.ne(s.shift()).cumsum()
        run_len = s.groupby(same).transform("size")
        cand = (run_len >= 6) & (s > 0.5)
        if cand.any():
            nb = rain.drop(columns=c).median(axis=1)
            nb_std = nb.groupby(same).transform("std").fillna(0)
            nb_mean = nb.groupby(same).transform("mean")
            stuck[c] = cand & ((nb_std > 0.05) | ((s - nb_mean).abs() > 1.0))
    flags[stuck & (flags == "")] = "stuck"
    rain = rain.mask(stuck)

    gaps = rain.isna()
    flags[gaps & (flags == "")] = "gap"
    med = rain.median(axis=1, skipna=True).fillna(0.0)
    rain = rain.apply(lambda col: col.fillna(med))

    wl = df.pivot(index="time", columns="zone_id", values="water_level_m")
    wl_gaps = int(wl.isna().sum().sum())
    wl = wl.interpolate(limit=3, limit_direction="forward").ffill().bfill()

    long_rain = rain.stack().rename("rain_mm")
    long_wl = wl.stack().rename("water_level_m")
    long_flag = flags.stack().rename("clean_flag")
    keyed = df.drop(columns=["rain_mm", "water_level_m", "clean_flag"]).set_index(["time", "zone_id"])
    out = keyed.join(long_rain).join(long_wl).join(long_flag).reset_index()
    out["rain_mm"] = out["rain_mm"].round(1)

    report = {k: int((flags == k).sum().sum()) for k in ["negative", "spike", "stuck", "gap"]}
    report["water_level_gaps_filled"] = wl_gaps
    report["rows"] = int(len(out))
    if "fault" in out.columns:                      # synthetic data: we know the injected faults
        injected = out["fault"].isin(["spike", "negative", "stuck", "gap"])
        detected = out["clean_flag"] != ""
        tp = int((injected & detected).sum())
        report["fault_detection_precision"] = round(tp / max(1, int(detected.sum())), 3)
        report["fault_detection_recall"] = round(tp / max(1, int(injected.sum())), 3)
    return out.sort_values(["zone_id", "time"]).reset_index(drop=True), report
