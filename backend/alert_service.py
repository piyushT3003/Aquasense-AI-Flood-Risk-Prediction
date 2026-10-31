"""
AQUASENSE - Threat & alert engine.

Alert types
  FORECAST_THREAT     model projects HIGH/SEVERE risk within the next 12 h while the zone is
                      still calm - the early warning, issued before the rain arrives
  RISK_TRANSITION     zone has now crossed into HIGH or SEVERE
  RAPID_RATE_OF_RISE  drain level rising >= 0.4 m in an hour
  OBSERVED_FLOODING   waterlogging reported in the zone (simulated ground truth in demo mode)

One alert per type per zone per "episode"; an episode ends when the zone has stayed LOW for
3 hours, at which point its open alerts are auto-resolved. Upgrades (HIGH -> SEVERE) are allowed.
"""
from __future__ import annotations
import itertools
from typing import Optional
from models import AlertItem
from seed_data import PILOT_ZONES

RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "SEVERE": 3}
THREAT_WINDOW_H = 12
MAX_ALERTS = 200


def _window(h: Optional[int]) -> str:
    if h is None:
        return "Next 6 hours"
    if h <= 0:
        return "Now"
    return f"In about {h} hour{'s' if h != 1 else ''}"


class AlertManager:
    def __init__(self):
        self.reset()

    def reset(self):
        self.alerts: list[AlertItem] = []
        self.episodes: dict[str, dict] = {}
        self.prev_level: dict[str, str] = {}
        self._counter = itertools.count(1)

    # ------------------------------------------------------------------ evaluation per tick
    def evaluate(self, sim):
        for i, z in enumerate(PILOT_ZONES):
            zs = sim.by_zone[z["id"]]
            ep = self.episodes.setdefault(z["id"], {"issued": {}, "low_hours": 0})
            level, prev = zs["risk_level"], self.prev_level.get(z["id"], "LOW")
            self.prev_level[z["id"]] = level

            # episode bookkeeping + auto-resolve
            if level == "LOW" and not sim.flooded[i]:
                ep["low_hours"] += 1
                if ep["low_hours"] >= 3 and ep["issued"]:
                    for a in self.alerts:
                        if a.zone_id == z["id"] and a.status != "RESOLVED":
                            a.status, a.resolved_by = "RESOLVED", "Auto-resolved: risk back to LOW for 3 h"
                    ep["issued"] = {}
            else:
                ep["low_hours"] = 0

            peak_level = zs["peak_level_24h"]
            h_high = zs["hours_to_high"]
            # 1. forecast threat (early warning)
            if RANK[level] <= 1 and h_high is not None and 0 < h_high <= THREAT_WINDOW_H:
                sev = "SEVERE" if zs["hours_to_severe"] is not None and zs["hours_to_severe"] <= THREAT_WINDOW_H else "HIGH"
                self._issue(sim, i, "FORECAST_THREAT", sev, lead=h_high if sev == "HIGH" else zs["hours_to_severe"])
            # 2. transition into HIGH / SEVERE now
            if RANK[level] >= 2 and RANK[level] > RANK[prev]:
                self._issue(sim, i, "RISK_TRANSITION", level, lead=0)
            # 3. rapid rise of drain water
            if zs["features"]["water_rise_1h"] >= 0.4 and RANK[level] >= 1:
                self._issue(sim, i, "RAPID_RATE_OF_RISE", "HIGH" if level != "SEVERE" else "SEVERE", lead=0)
        self.alerts = self.alerts[:MAX_ALERTS]

    def observed_flooding(self, sim, i: int):
        self._issue(sim, i, "OBSERVED_FLOODING", "SEVERE", lead=0)

    def _issue(self, sim, i: int, kind: str, severity: str, lead: Optional[int]):
        z = PILOT_ZONES[i]
        ep = self.episodes.setdefault(z["id"], {"issued": {}, "low_hours": 0})
        prev = ep["issued"].get(kind)
        if prev and RANK[prev] >= RANK[severity]:
            return None                                  # already alerted at this level this episode
        ep["issued"][kind] = severity
        zs = sim.by_zone[z["id"]]
        f = zs["features"]
        driver = zs["shap"][0]["display_name"] if zs["shap"] else "rainfall"
        alert = AlertItem(
            id=f"ALT-{sim.sim_time:%Y%m%d-%H%M}-W{z['ward_number']}-{next(self._counter):04d}",
            zone_id=z["id"], zone_name=z["name"], ward_number=z["ward_number"], severity=severity,
            trigger_type=kind, probability=round(zs["peak_prob_24h"] if kind == "FORECAST_THREAT" else zs["probability"], 3),
            rainfall_mm=round(f["rain_24h_mm"], 1), water_level_m=round(f["water_level_m"], 2),
            expected_window=_window(lead), lead_time_h=lead, top_driver=driver,
            timestamp=sim.sim_time.strftime("%Y-%m-%d %H:%M"), status="ACTIVE",
            government_message=self._gov(kind, severity, z, zs, lead, driver),
            citizen_message_en=self._cit_en(kind, severity, z, lead),
            citizen_message_kn=self._cit_kn(kind, z, lead),
        )
        self.alerts.insert(0, alert)
        return alert

    # ------------------------------------------------------------------ message templates
    @staticmethod
    def _gov(kind, sev, z, zs, lead, driver):
        f = zs["features"]
        p = round(100 * (zs["peak_prob_24h"] if kind == "FORECAST_THREAT" else zs["probability"]))
        base = (f"{z['name']} (Ward {z['ward_number']}, {z['swd_basin']}): "
                f"24h rain {f['rain_24h_mm']:.0f} mm, forecast next 6h {f['forecast_6h_mm']:.0f} mm, "
                f"drain level {f['water_level_m']:.2f} m. Main driver: {driver}.")
        if kind == "FORECAST_THREAT":
            return (f"EARLY WARNING [{sev}] - model projects {sev} flood risk {_window(lead).lower()} "
                    f"(peak probability {p}% within 6 h). {base} Pre-position dewatering pumps and "
                    f"barricade low underpasses before onset.")
        if kind == "RISK_TRANSITION":
            return f"ALERT [{sev}] - {z['name']} has entered {sev} risk ({p}% probability of flooding within 6 h). {base}"
        if kind == "RAPID_RATE_OF_RISE":
            return f"RAPID RISE - drain level up {f['water_rise_1h']:.2f} m in the last hour. {base} Inspect inlets for blockage."
        return f"FLOODING REPORTED - waterlogging observed in {z['name']}. {base} Dispatch field team; keep traffic diversions active."

    @staticmethod
    def _cit_en(kind, sev, z, lead):
        if kind == "FORECAST_THREAT":
            return (f"Flood risk in {z['name']} is expected to become {sev.lower()} {_window(lead).lower()}. "
                    f"Plan travel early, avoid underpasses and low roads, and follow official BBMP advisories.")
        if kind == "OBSERVED_FLOODING":
            return f"Waterlogging reported in {z['name']}. Avoid the area if you can and follow official BBMP advisories."
        return (f"Heavy rain may cause flooding in {z['name']} over the next few hours. "
                f"Avoid waterlogged roads and follow official BBMP advisories.")

    @staticmethod
    def _cit_kn(kind, z, lead):
        n = z["name"]
        if kind == "FORECAST_THREAT" and lead:
            return (f"{n} ಪ್ರದೇಶದಲ್ಲಿ ಸುಮಾರು {lead} ಗಂಟೆಗಳಲ್ಲಿ ಪ್ರವಾಹದ ಅಪಾಯ ಹೆಚ್ಚಾಗುವ ನಿರೀಕ್ಷೆಯಿದೆ. "
                    f"ದಯವಿಟ್ಟು ಜಲಾವೃತವಾದ ರಸ್ತೆಗಳನ್ನು ತಪ್ಪಿಸಿ ಮತ್ತು ಅಧಿಕೃತ ಸಲಹೆಗಳನ್ನು ಪಾಲಿಸಿ.")
        if kind == "OBSERVED_FLOODING":
            return f"{n} ಪ್ರದೇಶದಲ್ಲಿ ಜಲಾವೃತವಾಗಿರುವುದು ವರದಿಯಾಗಿದೆ. ದಯವಿಟ್ಟು ಆ ಪ್ರದೇಶವನ್ನು ತಪ್ಪಿಸಿ ಮತ್ತು ಅಧಿಕೃತ ಸಲಹೆಗಳನ್ನು ಪಾಲಿಸಿ."
        return (f"{n} ಪ್ರದೇಶದಲ್ಲಿ ಮುಂದಿನ ಕೆಲವು ಗಂಟೆಗಳಲ್ಲಿ ಭಾರಿ ಮಳೆಯಿಂದ ಪ್ರವಾಹ ಉಂಟಾಗುವ ಸಾಧ್ಯತೆಯಿದೆ. "
                f"ದಯವಿಟ್ಟು ಜಲಾವೃತವಾದ ರಸ್ತೆಗಳನ್ನು ತಪ್ಪಿಸಿ ಮತ್ತು ಅಧಿಕೃತ ಸಲಹೆಗಳನ್ನು ಪಾಲಿಸಿ.")

    # ------------------------------------------------------------------ threats + lifecycle
    def threats(self, sim) -> list[dict]:
        out = []
        for z in PILOT_ZONES:
            zs = sim.by_zone[z["id"]]
            if RANK[zs["peak_level_24h"]] < 2:
                continue
            out.append({"zone_id": z["id"], "zone_name": z["name"], "ward_number": z["ward_number"],
                        "current_level": zs["risk_level"], "predicted_level": zs["peak_level_24h"],
                        "probability_now": round(zs["probability"], 3), "peak_probability": round(zs["peak_prob_24h"], 3),
                        "peak_in_h": zs["peak_in_h"], "hours_to_high": zs["hours_to_high"],
                        "hours_to_severe": zs["hours_to_severe"],
                        "top_driver": zs["shap"][0]["display_name"] if zs["shap"] else None,
                        "trajectory": zs["trajectory_score"][:25]})
        return sorted(out, key=lambda t: (-RANK[t["predicted_level"]], t["hours_to_high"] if t["hours_to_high"] is not None else 99))

    def get_alerts(self, status: Optional[str] = None) -> list[AlertItem]:
        return [a for a in self.alerts if a.status == status] if status else self.alerts

    def _find(self, alert_id):
        return next((a for a in self.alerts if a.id == alert_id), None)

    def acknowledge_alert(self, alert_id: str, user_name: str = "Disaster Duty Officer"):
        a = self._find(alert_id)
        if a:
            a.status, a.acknowledged_by = "ACKNOWLEDGED", user_name
            from datetime import datetime
            a.acknowledged_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return a

    def escalate_alert(self, alert_id: str):
        a = self._find(alert_id)
        if a and a.status != "ESCALATED":
            a.status = "ESCALATED"
            a.government_message += " [ESCALATED TO KSNDMC & BBMP CENTRAL CONTROL ROOM]"
        return a

    def resolve_alert(self, alert_id: str):
        a = self._find(alert_id)
        if a:
            a.status, a.resolved_by = "RESOLVED", "Resolved by duty officer"
        return a
