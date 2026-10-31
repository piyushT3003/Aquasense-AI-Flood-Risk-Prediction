"""
AQUASENSE - Feature engineering (Week 4).

14 features per zone-hour. The Week 5 baseline model uses the first 12;
the tuned model adds the two trend features (rain_trend_3h, water_rise_1h).

  rainfall      rain_1h_mm, rain_3h_mm, rain_24h_mm, antecedent_72h_mm, forecast_6h_mm
  drainage      water_level_m, drainage_capacity_index (estimated from how fast each
                zone's drain level recedes after rain - learned from data, not assumed)
  terrain/GIS   elevation_m, slope_degrees, lake_proximity_m, impervious_ratio
  history       incident_freq (flood incidents per monsoon season, from training data only)
  trends        rain_trend_3h (last 3 h vs the 3 h before), water_rise_1h

Target: flood_next_6h = a waterlogging incident is reported in the zone within the next 6 hours.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

BASELINE_FEATURES = [
    "rain_1h_mm", "rain_3h_mm", "rain_24h_mm", "antecedent_72h_mm", "forecast_6h_mm",
    "water_level_m", "drainage_capacity_index", "elevation_m", "slope_degrees",
    "lake_proximity_m", "impervious_ratio", "incident_freq",
]
TREND_FEATURES = ["rain_trend_3h", "water_rise_1h"]
ALL_FEATURES = BASELINE_FEATURES + TREND_FEATURES
HORIZON_H = 6

FEATURE_LABELS = {
    "rain_1h_mm": "Rainfall, last hour", "rain_3h_mm": "Rainfall, last 3 h",
    "rain_24h_mm": "Rainfall, last 24 h", "antecedent_72h_mm": "Rain in the 3 days before (soil wetness)",
    "forecast_6h_mm": "Forecast rain, next 6 h", "water_level_m": "Storm-drain water level",
    "drainage_capacity_index": "Drainage capacity index", "elevation_m": "Elevation",
    "slope_degrees": "Terrain slope", "lake_proximity_m": "Distance to nearest lake",
    "impervious_ratio": "Concrete / impervious cover", "incident_freq": "Past flood incidents per season",
    "rain_trend_3h": "Rainfall trend (3 h)", "water_rise_1h": "Drain level rise, last hour",
}
STATIC = ["elevation_m", "slope_degrees", "lake_proximity_m", "impervious_ratio"]


def estimate_drainage_index(df: pd.DataFrame) -> dict[str, float]:
    """How quickly the drain level falls in dry hours. Faster recession = better drainage."""
    out = {}
    for zid, g in df.sort_values("time").groupby("zone_id"):
        lvl = g["water_level_m"].to_numpy() - 0.3
        prev = np.roll(lvl, 1)
        dry = (g["rain_mm"].to_numpy() < 0.2) & (prev > 0.4)
        dry[0] = False
        ratio = np.median(np.clip(lvl[dry] / prev[dry], 0, 1)) if dry.sum() >= 10 else 0.6
        out[zid] = float(np.clip(1.0 - ratio, 0.0, 1.0))
    return out


def incident_frequency(df: pd.DataFrame) -> dict[str, float]:
    """Distinct incident onsets per season per zone (training data only, to avoid leakage)."""
    out = {}
    for zid, g in df.sort_values("time").groupby("zone_id"):
        inc = g["incident"].to_numpy()
        onsets = int(((inc == 1) & (np.roll(inc, 1) == 0)).sum())
        seasons = max(1, g["time"].dt.year.nunique())
        out[zid] = round(onsets / seasons, 2)
    return out


def build_features(df: pd.DataFrame, zones: list[dict], drainage_index: dict, incident_freq: dict,
                   with_target: bool = True) -> pd.DataFrame:
    zmap = {z["id"]: z for z in zones}
    parts = []
    for zid, g in df.sort_values("time").groupby("zone_id", sort=False):
        g = g.copy()
        r = g["rain_mm"]
        g["rain_1h_mm"] = r
        g["rain_3h_mm"] = r.rolling(3, min_periods=1).sum()
        g["rain_24h_mm"] = r.rolling(24, min_periods=1).sum()
        g["antecedent_72h_mm"] = r.rolling(96, min_periods=1).sum() - g["rain_24h_mm"]
        g["rain_trend_3h"] = g["rain_3h_mm"] - g["rain_3h_mm"].shift(3).fillna(0)
        g["water_rise_1h"] = g["water_level_m"].diff().fillna(0)
        if "forecast_6h_mm" not in g or g["forecast_6h_mm"].isna().all():
            g["forecast_6h_mm"] = r[::-1].rolling(6, min_periods=1).sum()[::-1].shift(-1).fillna(0)
        for c in STATIC:
            g[c] = zmap[zid][c.replace("impervious_ratio", "impervious_ratio")]
        g["drainage_capacity_index"] = drainage_index.get(zid, 0.5)
        g["incident_freq"] = incident_freq.get(zid, 0.0)
        if with_target and "incident" in g:
            fut = pd.concat([g["incident"].shift(-k) for k in range(1, HORIZON_H + 1)], axis=1)
            g["flood_next_6h"] = fut.max(axis=1)
            g.loc[fut.isna().any(axis=1), "flood_next_6h"] = np.nan   # end of season: unknown
        parts.append(g)
    out = pd.concat(parts, ignore_index=True)
    return out.dropna(subset=["flood_next_6h"]) if with_target and "flood_next_6h" in out else out
