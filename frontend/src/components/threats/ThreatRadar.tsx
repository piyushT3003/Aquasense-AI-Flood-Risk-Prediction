import React from "react";
import { Radar, Clock3 } from "lucide-react";
import type { Threat } from "../../services/api";
import { levelBadge } from "../../utils/risk";
import { Sparkline } from "../charts/Charts";

/** Zones the model expects to reach HIGH/SEVERE in the next 24 h, soonest first. */
export const ThreatRadar: React.FC<{ threats: Threat[]; onSelect?: (zoneId: string) => void; compact?: boolean }> = ({
  threats, onSelect, compact,
}) => (
  <div className="glass-panel rounded-2xl p-4">
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-cyan-300" />
        <h2 className="text-sm font-semibold text-white">Threat radar</h2>
        {threats.length > 0 && <span className="rounded-full bg-amber-400/15 px-2 text-[10.5px] font-semibold text-amber-200">{threats.length}</span>}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">Zones expected to reach HIGH or SEVERE within 24 h, soonest first</p>
    </div>
    {threats.length === 0 ? (
      <p className="py-6 text-center text-xs text-slate-400">No zone is expected to reach HIGH risk in the next 24 hours.</p>
    ) : (
      <ul className="space-y-2">
        {threats.slice(0, compact ? 4 : 8).map((t) => {
          const soon = t.current_level === "HIGH" || t.current_level === "SEVERE";
          const eta = soon ? "Now" : t.hours_to_high !== null ? `HIGH in ${t.hours_to_high} h` : `Peak in ${t.peak_in_h} h`;
          return (
            <li key={t.zone_id}>
              <button onClick={() => onSelect?.(t.zone_id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-white">{t.zone_name}</span>
                    <span className={`rounded border px-1.5 py-px text-[10px] font-semibold ${levelBadge[t.predicted_level]}`}>{t.predicted_level}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock3 className="h-3 w-3" />
                    <span className={soon ? "font-semibold text-rose-300" : "text-amber-200"}>{eta}</span>
                    {t.top_driver && <span className="truncate">· {t.top_driver.toLowerCase()}</span>}
                  </div>
                </div>
                <Sparkline values={t.trajectory} width={84} height={26} />
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
