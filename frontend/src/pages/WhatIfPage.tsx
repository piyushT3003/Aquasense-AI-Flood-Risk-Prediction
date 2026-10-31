import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sliders, Loader2 } from "lucide-react";
import { runWhatIfScenario } from "../services/api";
import type { WhatIfParams, WhatIfScenarioResult, Zone } from "../services/api";
import { SatelliteMap3D } from "../components/map/SatelliteMap3D";
import { levelBadge, scoreColor } from "../utils/risk";

const PRESETS: { name: string; note: string; p: WhatIfParams }[] = [
  { name: "Evening shower", note: "15 mm/h for an hour", p: { rainfall_intensity_mm_h: 15, duration_hours: 1, antecedent_rainfall_mm: 20, drainage_capacity_pct: 100, lake_fill_pct: 70 } },
  { name: "Heavy thunderstorm", note: "45 mm/h for 2 h", p: { rainfall_intensity_mm_h: 45, duration_hours: 2, antecedent_rainfall_mm: 40, drainage_capacity_pct: 100, lake_fill_pct: 80 } },
  { name: "Sept 2022-style deluge", note: "40 mm/h for 5 h after a wet week, lakes full", p: { rainfall_intensity_mm_h: 40, duration_hours: 5, antecedent_rainfall_mm: 110, drainage_capacity_pct: 100, lake_fill_pct: 105 } },
  { name: "Cloudburst, choked drains", note: "90 mm/h, drains at half capacity", p: { rainfall_intensity_mm_h: 90, duration_hours: 2, antecedent_rainfall_mm: 40, drainage_capacity_pct: 50, lake_fill_pct: 85 } },
  { name: "Same storm, desilted drains", note: "Heavy thunderstorm with drains at 120%", p: { rainfall_intensity_mm_h: 45, duration_hours: 2, antecedent_rainfall_mm: 40, drainage_capacity_pct: 120, lake_fill_pct: 80 } },
];

const SLIDERS: { k: keyof WhatIfParams; label: string; min: number; max: number; step: number; unit: string; hint: (v: number) => string }[] = [
  { k: "rainfall_intensity_mm_h", label: "Rainfall intensity", min: 5, max: 120, step: 1, unit: "mm/h",
    hint: (v) => v < 15 ? "Moderate rain" : v < 35 ? "Heavy rain" : v < 65 ? "Very heavy, most drains overwhelmed" : "Cloudburst intensity" },
  { k: "duration_hours", label: "Storm duration", min: 0.5, max: 12, step: 0.5, unit: "h", hint: () => "" },
  { k: "antecedent_rainfall_mm", label: "Rain in the 3 days before", min: 0, max: 200, step: 5, unit: "mm",
    hint: (v) => v < 30 ? "Dry ground" : v < 90 ? "Damp ground" : "Saturated ground" },
  { k: "drainage_capacity_pct", label: "Storm-drain capacity", min: 20, max: 120, step: 5, unit: "%",
    hint: (v) => v < 70 ? "Silted or blocked drains" : v > 100 ? "Desilted / upgraded drains" : "Drains as built" },
  { k: "lake_fill_pct", label: "Lake levels before the storm", min: 40, max: 120, step: 5, unit: "%",
    hint: (v) => v >= 100 ? "Lakes at or over capacity, backflow likely" : "" },
];

export const WhatIfPage: React.FC<{ zones: Zone[]; lakes: any[]; drains: any[]; infrastructure: any[] }> = ({ zones, lakes, drains, infrastructure }) => {
  const [p, setP] = useState<WhatIfParams>(PRESETS[1].p);
  const [res, setRes] = useState<WhatIfScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      runWhatIfScenario(p).then((r) => { if (id === reqId.current) { setRes(r); setErr(null); } })
        .catch(() => setErr("Couldn't run the scenario. Check that the backend is running."))
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [p]);

  const scores = useMemo(() => Object.fromEntries((res?.zone_deltas ?? []).map((d) => [d.zone_id, d.scenario_score])), [res]);
  const levels = useMemo(() => Object.fromEntries((res?.zone_deltas ?? []).map((d) => [d.zone_id, d.scenario_risk])), [res]);
  const total = Math.round(p.rainfall_intensity_mm_h * p.duration_hours * 0.8);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Sliders className="h-5 w-5 text-cyan-300" />What-if storm simulator</h1>
        <p className="mt-1 text-sm text-slate-400">Drag a slider and every zone is re-run through the drainage model and the trained flood model, starting from current conditions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((pr) => (
          <button key={pr.name} onClick={() => setP(pr.p)} title={pr.note}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${JSON.stringify(pr.p) === JSON.stringify(p) ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-300 hover:border-white/25"}`}>
            {pr.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="glass-panel space-y-5 rounded-2xl p-5">
          {SLIDERS.map((s) => (
            <label key={s.k} className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-slate-200">{s.label}</span>
                <span className="font-mono text-lg font-bold text-cyan-200">{p[s.k]}<span className="ml-1 text-xs text-slate-400">{s.unit}</span></span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={p[s.k]}
                onChange={(e) => setP({ ...p, [s.k]: Number(e.target.value) })}
                className="mt-1.5 w-full accent-cyan-400" />
              <div className="h-4 text-[11px] text-slate-500">{s.hint(p[s.k])}</div>
            </label>
          ))}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[11.5px] text-slate-400">
            Roughly <b className="text-white">{total} mm</b> of rain over {p.duration_hours} h. Risk shown is each zone's worst hour during the storm and the 6 h after it.
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card label="Zones HIGH or worse" value={res ? `${res.scenario_high_risk_zones}` : "–"} sub={res ? `now: ${res.baseline_high_risk_zones}` : ""} tone="text-orange-300" />
            <Card label="Zones SEVERE" value={res ? `${res.scenario_severe_risk_zones}` : "–"} sub={res ? `now: ${res.baseline_severe_risk_zones}` : ""} tone="text-rose-300" />
            <Card label="Flood-prone area" value={res ? `${res.scenario_affected_area_sq_km} km²` : "–"} sub={res ? `+${res.delta_affected_area_sq_km} km² vs now` : ""} tone="text-white" />
            <Card label="Drains overflowing" value={res ? `${res.drains_overflowing}/18` : "–"} sub="zones with street water" tone="text-cyan-200" />
          </div>
          <div className="relative">
            <SatelliteMap3D zones={zones} overrideScores={scores} overrideLevels={levels} lakes={lakes} drains={drains}
              infrastructure={infrastructure} className="h-[430px]" />
            {loading && <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] text-cyan-100"><Loader2 className="h-3 w-3 animate-spin" />Re-running model</div>}
          </div>
          {err && <p className="text-sm text-amber-200">{err}</p>}
          {res && <p className="glass-panel rounded-2xl p-4 text-sm leading-relaxed text-slate-200">{res.summary_insight}</p>}
        </div>
      </div>

      {res && (
        <div className="glass-panel overflow-x-auto rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Zone by zone</h2>
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-slate-400">
              <tr><th className="py-2 font-medium">Zone</th><th className="font-medium">Now</th><th className="font-medium">In this storm</th>
                <th className="font-medium">Peak chance of flooding</th><th className="font-medium">Peaks after</th><th className="font-medium">Street water</th><th className="font-medium">Drain level</th></tr>
            </thead>
            <tbody>
              {res.zone_deltas.map((d) => (
                <tr key={d.zone_id} className="border-t border-white/5">
                  <td className="py-2 font-medium text-slate-100">{d.zone_name}</td>
                  <td><span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[d.baseline_risk as keyof typeof levelBadge]}`}>{d.baseline_risk}</span></td>
                  <td><span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[d.scenario_risk as keyof typeof levelBadge]}`}>{d.scenario_risk}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${d.scenario_score * 100}%`, background: scoreColor(d.scenario_score) }} /></div>
                      <span className="font-mono text-slate-200">{Math.round(d.scenario_prob * 100)}%</span>
                    </div>
                  </td>
                  <td className="font-mono text-slate-300">{d.peak_hour} h</td>
                  <td className="font-mono text-slate-300">{d.max_ponding_mm} mm</td>
                  <td className="font-mono text-slate-300">{d.max_drain_level_m} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Card: React.FC<{ label: string; value: string; sub: string; tone: string }> = ({ label, value, sub, tone }) => (
  <div className="glass-card rounded-xl p-3">
    <div className="text-[11px] text-slate-400">{label}</div>
    <div className={`text-2xl font-extrabold tabular ${tone}`}>{value}</div>
    <div className="text-[11px] text-slate-500">{sub}</div>
  </div>
);
