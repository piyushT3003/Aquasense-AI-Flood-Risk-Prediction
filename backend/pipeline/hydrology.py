"""
AQUASENSE - Urban drainage hydrology model (hourly time step).

One simple, physically motivated model shared by:
  * the synthetic historical generator (pipeline/sources.py) used for training, and
  * the live telemetry simulator (simulation.py),
so the model is trained and demonstrated on the same underlying physics.

Per zone, per hour:
  runoff   = rain x runoff coefficient (impervious surface, soil saturation)
  drain    = inlets accept water up to their capacity while the channel has room;
             the outlet carries at most `capacity` mm/h downstream
  excess   = runoff the inlets cannot take ponds on the street immediately
  drain-back = ponded water re-enters the drain as the channel empties
  backflow = lakes near capacity push water back into nearby drains
  ponding  = street water depth; decays as it drains/infiltrates
  incident = waterlogging reported when terrain-adjusted ponding is deep enough

When real KSNDMC drain sensors are connected, water level comes from the sensor
and this model is only used for forecasting forward in time.
"""
from __future__ import annotations
import numpy as np

CHANNEL_MAX_MM = 60.0      # catchment-equivalent storage of the primary drain
INLET_FACTOR = 1.3         # inlets accept up to 1.3x outlet capacity while the channel has room
PONDING_DECAY = 0.72       # fraction of street water remaining after 1 h
INCIDENT_DEPTH_MM = 15.0   # terrain-adjusted ponding at which waterlogging is ~50% likely
INCIDENT_SPREAD = 4.0


def zone_params(zones: list[dict]) -> dict[str, np.ndarray]:
    """Static per-zone hydrological parameters derived from GIS attributes."""
    dv = np.array([z["drainage_vulnerability"] for z in zones])
    elev = np.array([z["elevation_m"] for z in zones])
    slope = np.array([z["slope_degrees"] for z in zones])
    imperv = np.array([z["impervious_ratio"] for z in zones])
    lake = np.array([z["lake_proximity_m"] for z in zones])
    capacity = 8.0 + 80.0 * (1.0 - dv)                      # mm/h the drain can carry
    return {
        "capacity": capacity,
        "k": capacity / 40.0,                                  # reservoir outflow constant
        "runoff_coef": 0.30 + 0.60 * imperv,
        "lowlying": np.clip((895.0 - elev) / 30.0, 0.0, 1.0),
        "flatness": np.clip((1.5 - slope) / 1.5, 0.0, 1.0),
        "lake_coupling": np.exp(-lake / 250.0),
    }


class HydroState:
    """Mutable hydrological state for N zones."""

    def __init__(self, n: int):
        self.drain = np.zeros(n)          # mm in channel
        self.ponding = np.zeros(n)        # mm on streets
        self.lake_fill = np.full(n, 0.6)  # 0..1.3 fraction of lake capacity
        self.antecedent = np.zeros(n)     # decaying 72h rainfall memory (mm)

    def copy(self) -> "HydroState":
        s = HydroState(len(self.drain))
        s.drain, s.ponding = self.drain.copy(), self.ponding.copy()
        s.lake_fill, s.antecedent = self.lake_fill.copy(), self.antecedent.copy()
        return s


def step(state: HydroState, rain: np.ndarray, p: dict) -> dict[str, np.ndarray]:
    """Advance one hour. Mutates state; returns observable quantities."""
    sat = np.clip(0.3 + state.antecedent / 150.0, 0.3, 1.0)
    runoff = rain * p["runoff_coef"] * (0.7 + 0.3 * sat)

    state.lake_fill = np.clip(state.lake_fill * 0.996 + rain / 400.0, 0.0, 1.3)
    backflow = 30.0 * np.maximum(0.0, state.lake_fill - 0.85) * p["lake_coupling"]

    inflow = runoff + backflow
    room = np.maximum(0.0, CHANNEL_MAX_MM - state.drain)
    accepted = np.minimum.reduce([inflow, INLET_FACTOR * p["capacity"], room])
    excess = inflow - accepted                                   # water the inlets cannot take
    state.drain = state.drain + accepted
    outflow = np.minimum(p["capacity"], p["k"] * state.drain)   # linear reservoir, outlet-limited
    state.drain = state.drain - outflow
    drain_back = np.minimum.reduce([state.ponding * 0.35, 0.5 * np.maximum(0.0, CHANNEL_MAX_MM - state.drain),
                                    0.5 * p["capacity"]])
    state.ponding = state.ponding - drain_back
    state.drain = state.drain + drain_back
    state.ponding = state.ponding * PONDING_DECAY + excess
    spill = excess
    state.antecedent = state.antecedent * np.exp(-1 / 48.0) + rain

    level = 0.3 + 3.4 * state.drain / CHANNEL_MAX_MM + np.minimum(state.ponding, 60) / 100.0
    effective = state.ponding * (1.0 + 1.5 * p["lowlying"] + 0.5 * p["flatness"])
    base = 1.0 / (1.0 + np.exp(INCIDENT_DEPTH_MM / INCIDENT_SPREAD))
    p_incident = np.clip((1.0 / (1.0 + np.exp(-(effective - INCIDENT_DEPTH_MM) / INCIDENT_SPREAD)) - base) / (1 - base), 0, 1)
    return {
        "water_level_m": level,
        "ponding_mm": state.ponding.copy(),
        "soil_saturation_pct": sat * 100.0,
        "p_incident": p_incident,
        "drain_load_pct": 100.0 * (state.drain + spill) / CHANNEL_MAX_MM,
    }
