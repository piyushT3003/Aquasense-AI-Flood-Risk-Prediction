"""
AQUASENSE - Data ingestion adapters (Week 3 + Week 7).

All sources return a "raw" hourly long-format DataFrame:
    time | zone_id | rain_mm | water_level_m | [forecast_6h_mm] | [incident]

Sources
-------
SyntheticHistorySource  Monsoon seasons generated from the hydrology model, with realistic
                        sensor faults injected (spikes, negatives, gaps, stuck gauges) so the
                        cleaning stage has real work to do. Used for training in the prototype.
CsvSource               Loads a KSNDMC / BBMP style CSV export (see data/sample_ksndmc.csv).
OpenMeteoSource         Public-data adapter: real hourly rainfall (past 4 days + 2-day forecast)
                        for each zone from the free Open-Meteo API (no key needed).
reconstruct_sept_2022   Hourly reconstruction of the Sept 2022 deluge from the event timeline,
                        used for backtesting (clearly synthetic, not observed gauge data).
"""
from __future__ import annotations
import json, math, os, time, urllib.request
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

from .hydrology import HydroState, step, zone_params

CITY_BBOX = (12.83, 13.12, 77.50, 77.78)     # lat_min, lat_max, lng_min, lng_max
MONTH_STORM_RATE = {6: 0.35, 7: 0.40, 8: 0.45, 9: 0.70, 10: 0.65, 11: 0.25}


def _km(lat1, lng1, lat2, lng2):
    kx = 111.32 * math.cos(math.radians(12.97))
    return np.hypot((np.asarray(lng1) - lng2) * kx, (np.asarray(lat1) - lat2) * 110.57)


# ---------------------------------------------------------------------------
# Synthetic monsoon history
# ---------------------------------------------------------------------------
class SyntheticHistorySource:
    name = "synthetic"

    def __init__(self, zones: list[dict], seasons: list[int], seed: int = 7, inject_faults: bool = True):
        self.zones, self.seasons, self.seed, self.inject_faults = zones, seasons, seed, inject_faults

    def rainfall_field(self, rng, hours: pd.DatetimeIndex) -> np.ndarray:
        """Hourly rain (mm/h) for every zone: moving convective storms + drizzle in wet spells."""
        n_h, n_z = len(hours), len(self.zones)
        lat = np.array([z["center"]["lat"] for z in self.zones])
        lng = np.array([z["center"]["lng"] for z in self.zones])
        rain = np.zeros((n_h, n_z))
        days = pd.date_range(hours[0].normalize(), hours[-1].normalize(), freq="D")
        regime, wet = 0.0, []
        for _ in days:                                    # AR(1) wet/dry spell regime
            regime = 0.85 * regime + rng.normal(0, 0.45)
            wet.append(math.exp(regime))
        hour_weights = np.array([0.4] * 12 + [0.8, 1.2, 1.8, 2.4, 2.8, 3.0, 2.8, 2.4, 1.8, 1.2, 0.8, 0.5])
        hour_weights /= hour_weights.sum()
        h0 = hours[0]
        for d_i, day in enumerate(days):
            lam = MONTH_STORM_RATE.get(day.month, 0.1) * min(wet[d_i], 3.0)
            for _ in range(rng.poisson(lam)):
                start = day + timedelta(hours=int(rng.choice(24, p=hour_weights)))
                dur = min(8.0, 1.0 + rng.gamma(2.0, 1.0))
                peak = min(110.0, rng.lognormal(math.log(14.0), 0.75) * min(1.6, 0.7 + 0.3 * wet[d_i]))
                clat, clng = rng.uniform(*CITY_BBOX[:2]), rng.uniform(*CITY_BBOX[2:])
                vlat, vlng = rng.normal(0, 0.012, 2)
                radius = rng.uniform(5.0, 14.0)
                jitter = rng.uniform(0.8, 1.2, n_z)
                for k in range(int(math.ceil(dur)) + 1):
                    t = start + timedelta(hours=k)
                    idx = int((t - h0) / timedelta(hours=1))
                    if not 0 <= idx < n_h:
                        continue
                    shape = max(0.0, 1.0 - abs(k - dur / 2.5) / (dur / 1.6 + 0.5))
                    d = _km(lat, lng, clat + vlat * k, clng + vlng * k)
                    rain[idx] += peak * shape * np.exp(-d ** 2 / (2 * radius ** 2)) * jitter
            if wet[d_i] > 1.3:                            # light drizzle during wet spells
                for hh in range(24):
                    idx = int((day + timedelta(hours=hh) - h0) / timedelta(hours=1))
                    if 0 <= idx < n_h and rng.random() < 0.12:
                        rain[idx] += rng.uniform(0.2, 1.5)
        return np.round(rain, 1)

    def load(self) -> pd.DataFrame:
        rng = np.random.default_rng(self.seed)
        frames = []
        for year in self.seasons:
            hours = pd.date_range(f"{year}-06-01", f"{year}-11-30 23:00", freq="h")
            rain = self.rainfall_field(rng, hours)
            frames.append(simulate_series(self.zones, hours, rain, rng, season=year))
        df = pd.concat(frames, ignore_index=True)
        if self.inject_faults:
            df = inject_sensor_faults(df, rng)
        return df


def simulate_series(zones, hours, rain, rng, season=None, init_lake=0.6, init_antecedent=0.0) -> pd.DataFrame:
    """Run the hydrology model over an hourly rain matrix; add forecasts + reported incidents."""
    p = zone_params(zones)
    st = HydroState(len(zones))
    st.lake_fill[:] = init_lake
    st.antecedent[:] = init_antecedent
    n_h = len(hours)
    level = np.zeros_like(rain); incident = np.zeros_like(rain, dtype=np.int8); pond = np.zeros_like(rain)
    for i in range(n_h):
        out = step(st, rain[i], p)
        level[i] = out["water_level_m"] + rng.normal(0, 0.03, len(zones))
        pond[i] = out["ponding_mm"]
        incident[i] = (rng.random(len(zones)) < out["p_incident"] + 0.0002).astype(np.int8)
    # Imperfect 6h rainfall forecast: true future total x lognormal error; 10% of storms missed
    fut = np.zeros_like(rain)
    csum = np.vstack([np.zeros((1, rain.shape[1])), np.cumsum(rain, axis=0)])
    for i in range(n_h):
        j = min(n_h, i + 7)
        fut[i] = csum[j] - csum[i + 1]
    err = rng.lognormal(0.0, 0.35, fut.shape) * (rng.random(fut.shape) > 0.10)
    forecast = np.round(fut * err, 1)
    ids = [z["id"] for z in zones]
    return pd.DataFrame({
        "time": np.repeat(hours.values, len(zones)),
        "zone_id": np.tile(ids, n_h),
        "rain_mm": rain.ravel(),
        "water_level_m": np.round(level.ravel(), 3),
        "forecast_6h_mm": forecast.ravel(),
        "incident": incident.ravel(),
        "ponding_mm": np.round(pond.ravel(), 2),
        "season": season if season is not None else pd.DatetimeIndex(np.repeat(hours.values, len(zones))).year,
    })


def inject_sensor_faults(df: pd.DataFrame, rng) -> pd.DataFrame:
    """Simulate the faults real telemetry has, so data cleaning is exercised."""
    df = df.copy()
    n = len(df)
    df["fault"] = ""
    spike = rng.random(n) < 0.0004
    df.loc[spike, "rain_mm"] = rng.uniform(250, 420, spike.sum()).round(1)
    df.loc[spike, "fault"] = "spike"
    neg = (rng.random(n) < 0.0003) & ~spike
    df.loc[neg, "rain_mm"] = -rng.uniform(1, 5, neg.sum()).round(1)
    df.loc[neg, "fault"] = "negative"
    gap = (rng.random(n) < 0.003) & ~spike & ~neg
    df.loc[gap, "rain_mm"] = np.nan
    df.loc[gap, "fault"] = "gap"
    wl_gap = rng.random(n) < 0.002
    df.loc[wl_gap, "water_level_m"] = np.nan
    # stuck gauges: repeat a non-zero value for 8 hours
    for zid in df["zone_id"].unique():
        idx = df.index[df["zone_id"] == zid]
        for start in rng.choice(len(idx) - 10, size=3, replace=False):
            seg = idx[start:start + 8]
            v = max(2.0, float(df.at[seg[0], "rain_mm"] or 0) + 2.0)
            df.loc[seg, "rain_mm"] = v
            df.loc[seg, "fault"] = "stuck"
    return df


# ---------------------------------------------------------------------------
# Sept 2022 deluge reconstruction (for backtesting)
# ---------------------------------------------------------------------------
SEPT_2022_PEAK = datetime(2022, 9, 5, 2, 0)


def reconstruct_sept_2022(zones: list[dict], seed: int = 22) -> tuple[pd.DataFrame, datetime]:
    """
    Hourly rainfall rebuilt from the event timeline in seed_data.HISTORICAL_DELUGE_2022
    (cumulative 28 mm at T-24h, 54 at T-12h, 89 at T-6h, 131.6 at peak), concentrated over the
    East/South corridor as described. Preceded by a wet week (lakes ~90% full).
    This is a reconstruction for backtesting the warning logic, NOT observed gauge data.
    """
    rng = np.random.default_rng(seed)
    hours = pd.date_range(SEPT_2022_PEAK - timedelta(hours=96), SEPT_2022_PEAK + timedelta(hours=24), freq="h")
    lat = np.array([z["center"]["lat"] for z in zones]); lng = np.array([z["center"]["lng"] for z in zones])
    d = _km(lat, lng, 12.93, 77.68)
    spatial = 0.40 + 1.40 * np.exp(-d ** 2 / (2 * 9.0 ** 2))          # East/South corridor heaviest
    # city-mean hourly profile for the 24 h to peak (piecewise to hit the cumulative targets)
    seg = [(-24, -12, 26.0), (-12, -6, 35.0), (-6, 0, 42.6)]
    shapes = {12: np.linspace(0.6, 1.4, 12), 6: None}
    prof = np.zeros(len(hours))
    for a, b, total in seg:
        if b - a == 12:
            w = np.linspace(0.6, 1.4, 12)
        elif a == -12:
            w = np.array([0.2, 0.4, 0.8, 2.6, 1.6, 0.4])       # first convective burst
        else:
            w = np.array([0.2, 0.5, 1.2, 2.8, 1.1, 0.2])       # cloudburst before peak
        w = w / w.sum() * total
        for k, h in enumerate(range(a, b)):
            prof[96 + h + 1] = w[k]
    for h in range(-96, -24):                                          # wet week: evening showers
        t = SEPT_2022_PEAK + timedelta(hours=h)
        if t.hour in (17, 18, 19, 20) and rng.random() < 0.6:
            prof[96 + h] = rng.uniform(2, 9)
    for h in range(1, 25):                                             # recovery drizzle
        prof[96 + h] = 0.8 if h < 4 else 0.0
    rain = np.round(np.outer(prof, spatial) * rng.uniform(0.9, 1.1, (len(hours), len(zones))), 1)
    df = simulate_series(zones, hours, rain, rng, season=2022, init_lake=0.9, init_antecedent=40.0)
    return df, SEPT_2022_PEAK


# ---------------------------------------------------------------------------
# CSV adapter (KSNDMC / BBMP exports)
# ---------------------------------------------------------------------------
class CsvSource:
    """Expected columns: time, zone_id, rain_mm, water_level_m [, incident]."""
    name = "csv"

    def __init__(self, path: str):
        self.path = path

    def load(self) -> pd.DataFrame:
        df = pd.read_csv(self.path, parse_dates=["time"])
        missing = {"time", "zone_id", "rain_mm", "water_level_m"} - set(df.columns)
        if missing:
            raise ValueError(f"CSV is missing columns: {sorted(missing)}")
        return df.sort_values(["zone_id", "time"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Public-data adapter: Open-Meteo (free, no API key)
# ---------------------------------------------------------------------------
class OpenMeteoSource:
    """
    Real hourly precipitation for every zone centre: past 4 days (observed/analysed)
    plus the next 48 h forecast, in one request. https://open-meteo.com/en/docs
    Drain water level has no public feed, so it is modelled from rainfall by the hydrology model.
    """
    name = "open-meteo"
    URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, zones: list[dict], cache_seconds: int = 900, timeout: float = 8.0):
        self.zones, self.cache_seconds, self.timeout = zones, cache_seconds, timeout
        self._cache: tuple[float, dict] | None = None
        self.last_error: str | None = None

    def fetch(self) -> dict:
        if self._cache and time.time() - self._cache[0] < self.cache_seconds:
            return self._cache[1]
        lats = ",".join(f"{z['center']['lat']:.4f}" for z in self.zones)
        lngs = ",".join(f"{z['center']['lng']:.4f}" for z in self.zones)
        url = (f"{self.URL}?latitude={lats}&longitude={lngs}&hourly=precipitation"
               f"&past_days=4&forecast_days=2&timezone=Asia%2FKolkata")
        with urllib.request.urlopen(url, timeout=self.timeout) as r:
            payload = json.loads(r.read())
        parsed = self.parse(payload)
        self._cache = (time.time(), parsed)
        return parsed

    def parse(self, payload) -> dict:
        """Returns {'time': DatetimeIndex, 'rain': ndarray[hours, zones]}."""
        items = payload if isinstance(payload, list) else [payload]
        if len(items) != len(self.zones):
            raise ValueError(f"Open-Meteo returned {len(items)} locations, expected {len(self.zones)}")
        t = pd.to_datetime(items[0]["hourly"]["time"])
        rain = np.column_stack([np.nan_to_num(np.array(it["hourly"]["precipitation"], dtype=float)) for it in items])
        return {"time": t, "rain": rain}
