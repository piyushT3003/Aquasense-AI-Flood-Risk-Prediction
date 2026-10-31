import React, { useState } from "react";
import { CloudRain, CalendarClock } from "lucide-react";
import type { Zone } from "../services/api";
import { fetchRiskForecast, fetchRainfallForecast } from "../services/api";
import { usePoll } from "../utils/usePoll";
import { levelBadge, scoreColor } from "../utils/risk";

export const ForecastPage: React.FC<{ zones: Zone[]; onSelectZone: (id: string) => void }> = ({ zones, onSelectZone }) => {
  const [risk] = usePoll(fetchRiskForecast, 3000);
  const [rain] = usePoll(fetchRainfallForecast, 3000);
  const [sel, setSel] = useState(0);
  const horizons: any[] = risk?.horizons ?? [];
  const cur = horizons[sel];
  const sorted = [...zones].filter((z) => z.current_prediction)
    .sort((a, b) => Math.max(...b.current_prediction!.trajectory) - Math.max(...a.current_prediction!.trajectory));
  const hours = Array.from({ length: 49 }, (_, i) => i);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white">48-hour flood-risk forecast</h1>
        <p className="mt-1 text-sm text-slate-400">Each zone's risk is projected hour by hour: the rainfall forecast drives the drainage model, and the trained model scores every future hour.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {horizons.map((h, i) => (
          <button key={h.horizon} onClick={() => setSel(i)} aria-pressed={sel === i}
            className={`rounded-xl border p-3 text-left transition ${sel === i ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white">{h.horizon}</span>
              <span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[h.city_risk as keyof typeof levelBadge]}`}>{h.city_risk}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">{h.time}</div>
            <div className="mt-1 text-sm font-semibold text-white">{h.severe_zones} severe · {h.high_risk_zones} high+</div>
            <div className="text-[11px] text-slate-400">rain {h.city_rain_mm_h} mm/h</div>
          </button>
        ))}
      </div>

      {cur && (
        <div className="glass-panel rounded-2xl p-4 text-sm text-slate-300">
          <b className="text-white">{cur.horizon === "NOW" ? "Right now" : `At ${cur.horizon.replace("+", "+ ").toLowerCase()}`}</b>{" "}
          ({cur.time}): {cur.high_risk_zones ? `${cur.high_risk_zones} zone${cur.high_risk_zones > 1 ? "s" : ""} at HIGH or worse` : "no zone at HIGH risk"}.
          {cur.affected_hotspots?.length ? <> Most exposed: <b className="text-white">{cur.affected_hotspots.join(", ")}</b>.</> : null}
          {cur.hours > 0 && <> About <b className="text-white">{cur.expected_rain_mm} mm</b> of rain expected before then (city average).</>}
        </div>
      )}

      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-white">Zone-by-hour risk</h2></div>
          <span className="text-[11px] text-slate-400">Each cell is one zone in one hour. Click a zone to open it on the 3D map.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-[2px] text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[#07101f] pr-2 text-left font-medium text-slate-400">Zone</th>
                {hours.map((h) => <th key={h} className="w-3 font-mono font-normal text-slate-500">{h % 6 === 0 ? (h === 0 ? "now" : `+${h}`) : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((z) => (
                <tr key={z.id}>
                  <td className="sticky left-0 z-10 bg-[#07101f] pr-2">
                    <button onClick={() => onSelectZone(z.id)} className="max-w-[170px] truncate text-left text-slate-200 hover:text-cyan-300">{z.name}</button>
                  </td>
                  {z.current_prediction!.trajectory.map((s, h) => (
                    <td key={h} title={`${z.name}, ${h === 0 ? "now" : `+${h} h`}: risk ${Math.round(s * 100)}`}
                      className="h-4 min-w-[10px] rounded-[2px]" style={{ background: scoreColor(s), opacity: 0.25 + s * 0.75 }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2"><CloudRain className="h-4 w-4 text-sky-300" /><h2 className="text-sm font-semibold text-white">Rainfall outlook</h2>
          <span className="text-[11px] text-slate-400">{rain?.source}</span></div>
        <div className="grid gap-3 md:grid-cols-5">
          {(rain?.timeline ?? []).map((t: any) => (
            <div key={t.time} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="text-[11px] text-slate-400">{t.time}</div>
              <div className="mt-1 text-lg font-bold text-white tabular">{t.expected_rain_mm} mm</div>
              <div className="text-[11px] text-slate-400">peak {t.max_zone_intensity_mm_h} mm/h in the worst zone</div>
              <div className={`mt-1 text-[11px] font-semibold ${t.trend === "Rising" ? "text-amber-300" : t.trend === "Easing" ? "text-emerald-300" : "text-slate-300"}`}>{t.trend}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
