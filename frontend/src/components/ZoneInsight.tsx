import React, { useEffect, useState } from "react";
import { X, Droplets, Waves, CloudRain, Mountain, Building2 } from "lucide-react";
import type { Zone } from "../services/api";
import { TrajectoryChart, ShapBars } from "./charts/Charts";
import { levelBadge, scoreColor, pct } from "../utils/risk";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000/api";

/** Live prediction detail for one zone: outlook, 48 h trajectory, SHAP drivers, explanation. */
export const ZoneInsight: React.FC<{ zone: Zone; onClose?: () => void; infrastructure?: any[] }> = ({ zone, onClose, infrastructure = [] }) => {
  const p = zone.current_prediction;
  const [rain, setRain] = useState<number[] | undefined>();
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/zones/${zone.id}`).then((r) => r.json()).then((d) => {
      if (alive) setRain([d.history?.rain_mm?.slice(-1)[0] ?? 0, ...(d.forecast_rain_mm ?? [])]);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [zone.id, p?.last_updated]);
  if (!p) return null;
  const infra = infrastructure.filter((i) => i.zone_id === zone.id);
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2, SEVERE: 3 } as const;
  const outlook = p.hours_to_high !== null && rank[p.risk_level] < 2
    ? `Expected to reach HIGH in ${p.hours_to_high} h`
    : rank[p.peak_level_24h] > rank[p.risk_level] && p.peak_in_h > 0 ? `Rises to ${p.peak_level_24h} in ${p.peak_in_h} h` : "No escalation expected in 24 h";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white">{zone.name}</h2>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-300">Ward {zone.ward_number}</span>
          </div>
          <p className="text-[11.5px] text-slate-400">{zone.zone_type} · {zone.swd_basin}</p>
        </div>
        {onClose && <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] text-slate-400">Risk now</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular" style={{ color: scoreColor(p.risk_score) }}>{Math.round(p.risk_score * 100)}</span>
            <span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[p.risk_level]}`}>{p.risk_level}</span>
          </div>
          <div className="text-[11px] text-slate-400">{pct(p.flood_probability)} chance of flooding within 6 h</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] text-slate-400">24 h outlook</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className={`rounded border px-1.5 text-[11px] font-bold ${levelBadge[p.peak_level_24h]}`}>{p.peak_level_24h}</span>
            <span className="text-xs text-slate-300">{pct(p.peak_probability_24h)} peak</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-200">{outlook}</div>
        </div>
      </div>

      {p.observed_flooding && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">Waterlogging is being reported in this zone right now.</div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-200">Predicted risk, next 48 h</span>
          <span className="text-slate-500">bars = forecast rain</span>
        </div>
        <TrajectoryChart values={p.trajectory} rain={rain} height={130} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <Metric icon={CloudRain} label="Rain, 24 h" value={`${p.rainfall_24h_mm} mm`} />
        <Metric icon={Droplets} label="Forecast, next 6 h" value={`${p.forecast_6h_mm} mm`} />
        <Metric icon={Waves} label="Drain level" value={`${p.water_level_m} m`} />
        <Metric icon={Mountain} label="Elevation" value={`${zone.elevation_m} m`} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-2 text-[11px] font-semibold text-slate-200">Why the model says this (SHAP)</div>
        <ShapBars items={p.feature_contributions.map((f) => ({ label: f.display_name, value: f.importance_score, display: f.current_value_formatted }))} />
      </div>

      <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-xs leading-relaxed text-slate-200">{p.natural_explanation}</p>

      {infra.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-200"><Building2 className="h-3.5 w-3.5" /> Critical infrastructure</div>
          <ul className="space-y-1 text-[11.5px] text-slate-300">
            {infra.map((i) => <li key={i.name} className="flex justify-between gap-2"><span>{i.name} <span className="text-slate-500">({i.type})</span></span><span className="text-amber-200">{i.status}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ icon: any; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
    <Icon className="h-3.5 w-3.5 text-cyan-300" />
    <span className="text-slate-400">{label}</span>
    <span className="ml-auto font-mono text-slate-100">{value}</span>
  </div>
);
