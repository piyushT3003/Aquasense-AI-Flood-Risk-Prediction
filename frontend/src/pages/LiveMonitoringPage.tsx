import React, { useState } from "react";
import { Radio, Search, Droplets, Waves, CloudRain, AlertOctagon, ChevronRight } from "lucide-react";
import type { Zone, SensorReading } from "../services/api";
import { Sparkline } from "../components/charts/Charts";
import { levelBadge, scoreColor, pct } from "../utils/risk";

interface Props {
  zones: Zone[];
  sensors: SensorReading[];
  onSelectZone: (zone: Zone) => void;
  onNavigateTab: (tabKey: any) => void;
}

export const LiveMonitoringPage: React.FC<Props> = ({ zones, sensors, onSelectZone }) => {
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState("ALL");
  const [sort, setSort] = useState<"risk" | "outlook" | "rain" | "name">("risk");
  const byType = (t: string) => sensors.filter((s) => s.sensor_type === t);
  const gauges = byType("rain_gauge"), levels = byType("water_level_ultrasonic"), aws = byType("weather_station");
  const anomalies = sensors.filter((s) => s.is_anomaly);

  const rows = zones.filter((z) => z.current_prediction)
    .filter((z) => (z.name.toLowerCase().includes(q.toLowerCase()) || String(z.ward_number).includes(q)) && (lvl === "ALL" || z.current_prediction!.risk_level === lvl))
    .sort((a, b) => {
      const pa = a.current_prediction!, pb = b.current_prediction!;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rain") return pb.rainfall_24h_mm - pa.rainfall_24h_mm;
      if (sort === "outlook") return pb.peak_probability_24h - pa.peak_probability_24h;
      return pb.risk_score - pa.risk_score;
    });

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Radio className="h-5 w-5 text-cyan-300" />Live zones &amp; sensors</h1>
        <p className="mt-1 text-sm text-slate-400">Every zone's latest readings and model prediction, refreshed each simulated hour.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SensorCard icon={Droplets} title="Rain gauges" online={gauges.filter((s) => s.status === "ONLINE").length} total={gauges.length} note={`${anomalies.length} reading${anomalies.length === 1 ? "" : "s"} quarantined now`} />
        <SensorCard icon={Waves} title="Drain level sensors" online={levels.filter((s) => s.status === "ONLINE").length} total={levels.length}
          note={`Highest: ${Math.max(0, ...levels.map((s) => s.value)).toFixed(2)} m`} />
        <SensorCard icon={CloudRain} title="Weather stations" online={aws.length} total={aws.length} note={`Max 24 h rain: ${Math.max(0, ...aws.map((s) => s.value)).toFixed(0)} mm`} />
        <div className={`glass-card rounded-xl p-4 ${anomalies.length ? "border-amber-400/40" : ""}`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white"><AlertOctagon className="h-4 w-4 text-amber-300" />Sensor anomalies</div>
          <div className="mt-2 text-2xl font-extrabold text-white tabular">{anomalies.length}</div>
          <p className="truncate text-[11px] text-slate-400">{anomalies[0]?.anomaly_reason ?? "Spike gate, stuck-gauge and gap checks active"}</p>
        </div>
      </div>

      <div className="glass-panel space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search zone or ward number" aria-label="Search zones"
              className="glass-input w-full rounded-lg py-2 pl-9 pr-3 text-xs" />
          </div>
          <select value={lvl} onChange={(e) => setLvl(e.target.value)} aria-label="Filter by risk level" className="glass-input rounded-lg px-3 py-2 text-xs">
            <option value="ALL">All levels</option><option value="SEVERE">Severe</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort" className="glass-input rounded-lg px-3 py-2 text-xs">
            <option value="risk">Sort: risk now</option><option value="outlook">Sort: 24 h outlook</option><option value="rain">Sort: 24 h rain</option><option value="name">Sort: name</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="text-[11px] text-slate-400">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2.5 font-medium">Zone</th><th className="px-3 font-medium">Rain 1 h / 24 h</th><th className="px-3 font-medium">Forecast 6 h</th>
                <th className="px-3 font-medium">Drain level</th><th className="px-3 font-medium">Risk now</th><th className="px-3 font-medium">Next 24 h</th><th className="px-3 font-medium">Status</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((z) => {
                const p = z.current_prediction!;
                return (
                  <tr key={z.id} onClick={() => onSelectZone(z)} className="cursor-pointer transition-colors hover:bg-white/[0.04]">
                    <td className="px-3 py-3">
                      <div className="font-medium text-white">{z.name} <span className="font-mono text-[10px] text-slate-500">W{z.ward_number}</span></div>
                      <div className="max-w-[200px] truncate text-[10.5px] text-slate-500">{z.swd_basin}</div>
                    </td>
                    <td className="px-3 font-mono text-slate-200">{p.rainfall_1h_mm} / {p.rainfall_24h_mm} mm</td>
                    <td className="px-3 font-mono text-slate-200">{p.forecast_6h_mm} mm</td>
                    <td className="px-3 font-mono text-slate-200">{p.water_level_m} m</td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${p.risk_score * 100}%`, background: scoreColor(p.risk_score) }} /></div>
                        <span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[p.risk_level]}`}>{p.risk_level}</span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-slate-500">{pct(p.flood_probability)} chance in 6 h</div>
                    </td>
                    <td className="px-3"><Sparkline values={p.trajectory.slice(0, 25)} width={96} height={26} />
                      <div className="text-[10.5px] text-slate-500">{p.peak_level_24h}{p.peak_in_h ? ` in ${p.peak_in_h} h` : ""}</div></td>
                    <td className="px-3">{p.observed_flooding ? <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-200">Flooding reported</span> : <span className="text-[10.5px] text-slate-500">Clear</span>}</td>
                    <td className="px-3 text-right"><ChevronRight className="inline h-4 w-4 text-slate-500" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SensorCard: React.FC<{ icon: any; title: string; online: number; total: number; note: string }> = ({ icon: Icon, title, online, total, note }) => (
  <div className="glass-card rounded-xl p-4">
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-white"><Icon className="h-4 w-4 text-cyan-300" />{title}</span>
      <span className={`rounded border px-1.5 text-[10px] font-semibold ${online === total ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-300"}`}>{online === total ? "ONLINE" : "DEGRADED"}</span>
    </div>
    <div className="mt-2 text-2xl font-extrabold text-white tabular">{online} / {total}</div>
    <p className="text-[11px] text-slate-400">{note}</p>
  </div>
);
