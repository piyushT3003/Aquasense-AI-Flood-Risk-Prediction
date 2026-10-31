import React, { useState } from "react";
import { ShieldAlert, Search, Check, CheckCircle2, ArrowUpRight, Clock, Radar, Droplets, TrendingUp, Waves } from "lucide-react";
import type { AlertItem, Threat, Verification, Zone } from "../services/api";
import { Sparkline } from "../components/charts/Charts";
import { acknowledgeAlert, escalateAlert, resolveAlert } from "../services/api";
import { ThreatRadar } from "../components/threats/ThreatRadar";
import { levelBadge } from "../utils/risk";

const TYPE_META: Record<string, { label: string; icon: any; tone: string }> = {
  FORECAST_THREAT: { label: "Early warning (forecast)", icon: Radar, tone: "text-amber-200 border-amber-400/40 bg-amber-500/10" },
  RISK_TRANSITION: { label: "Risk level reached", icon: TrendingUp, tone: "text-orange-200 border-orange-400/40 bg-orange-500/10" },
  RAPID_RATE_OF_RISE: { label: "Drain rising fast", icon: Waves, tone: "text-sky-200 border-sky-400/40 bg-sky-500/10" },
  OBSERVED_FLOODING: { label: "Flooding reported", icon: Droplets, tone: "text-rose-200 border-rose-400/40 bg-rose-500/10" },
};

interface Props {
  alerts: AlertItem[];
  threats: Threat[];
  verification: Verification | null;
  onRefreshAlerts: () => void;
  onSelectZone: (id: string) => void;
  zones: Zone[];
  citizen: boolean;
}

export const AlertCenterPage: React.FC<Props> = ({ alerts, threats, verification, onRefreshAlerts, onSelectZone, zones, citizen }) => {
  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("ALL");
  const [viewState, setView] = useState<"GOVERNMENT" | "CITIZEN">("GOVERNMENT");
  const view = citizen ? "CITIZEN" : viewState;
  const watch = zones.filter((z) => z.current_prediction)
    .sort((a, b) => b.current_prediction!.peak_probability_24h - a.current_prediction!.peak_probability_24h).slice(0, 6);
  const [lang, setLang] = useState<"EN" | "KN">("EN");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const shown = alerts.filter((a) =>
    (status === "ALL" || (status === "OPEN" ? a.status !== "RESOLVED" : a.status === status)) &&
    (type === "ALL" || a.trigger_type === type) &&
    (a.zone_name.toLowerCase().includes(q.toLowerCase()) || a.id.toLowerCase().includes(q.toLowerCase())));

  const act = async (fn: (id: string) => Promise<any>, id: string, text: string) => {
    await fn(id); setMsg(text); setTimeout(() => setMsg(null), 2500); onRefreshAlerts();
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><ShieldAlert className="h-5 w-5 text-rose-300" />{citizen ? "Flood advisories" : "Alerts & threats"}</h1>
          <p className="mt-1 text-sm text-slate-400">{citizen ? "Official-style advisories for each area, in English and Kannada. Always follow BBMP instructions."
            : "Early warnings are issued when the model projects HIGH or SEVERE risk within 12 h. Alerts auto-resolve once a zone stays LOW for 3 hours."}</p>
        </div>
        {msg && <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200"><Check className="h-4 w-4" />{msg}</div>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="glass-panel flex flex-wrap items-center gap-3 rounded-xl p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by zone or alert ID" aria-label="Search alerts"
                className="glass-input w-full rounded-lg py-2 pl-9 pr-3 text-xs" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="glass-input rounded-lg px-3 py-2 text-xs">
              <option value="OPEN">Open (not resolved)</option><option value="ALL">All</option><option value="ACTIVE">Active</option>
              <option value="ACKNOWLEDGED">Acknowledged</option><option value="ESCALATED">Escalated</option><option value="RESOLVED">Resolved</option>
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type" className="glass-input rounded-lg px-3 py-2 text-xs">
              <option value="ALL">All types</option>
              {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {!citizen && <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5 text-xs">
              {(["GOVERNMENT", "CITIZEN"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400 hover:text-white"}`}>
                  {v === "GOVERNMENT" ? "Officer dispatch" : "Citizen advisory"}</button>
              ))}
            </div>}
            {view === "CITIZEN" && (
              <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5 text-xs">
                <button onClick={() => setLang("EN")} className={`rounded-md px-3 py-1.5 ${lang === "EN" ? "bg-white/10 text-white" : "text-slate-400"}`}>English</button>
                <button onClick={() => setLang("KN")} className={`rounded-md px-3 py-1.5 ${lang === "KN" ? "bg-white/10 text-white" : "text-slate-400"}`}>ಕನ್ನಡ</button>
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
              <h3 className="mt-2 text-sm font-semibold text-white">No matching alerts</h3>
              <p className="mt-1 text-xs text-slate-400">All zones are within normal limits.{citizen ? "" : " Press \"Storm demo\" in the top bar to see early warnings."} The watch list shows which zones are closest to trouble.</p>
            </div>
          ) : shown.map((a) => {
            const meta = TYPE_META[a.trigger_type] ?? TYPE_META.RISK_TRANSITION;
            const Icon = meta.icon;
            return (
              <article key={a.id} className={`rounded-2xl border p-4 ${a.status === "RESOLVED" ? "border-white/5 bg-white/[0.02] opacity-70" : a.severity === "SEVERE" ? "border-rose-500/40 bg-rose-950/20" : "border-white/10 bg-[#0a1528]/70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}><Icon className="h-3 w-3" />{meta.label}</span>
                      <button onClick={() => onSelectZone(a.zone_id)} className="text-sm font-bold text-white hover:text-cyan-300">{a.zone_name}</button>
                      <span className="text-[11px] text-slate-500">Ward {a.ward_number}</span>
                      <span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[a.severity as keyof typeof levelBadge] ?? levelBadge.HIGH}`}>{a.severity}</span>
                      <span className="text-[10.5px] text-slate-400">{a.status}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-300">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.timestamp}</span>
                      <span>When: <b className="text-white">{a.expected_window}</b></span>
                      <span>Probability: <b className="text-white">{Math.round(a.probability * 100)}%</b></span>
                      <span>Rain 24 h: <b className="text-white">{a.rainfall_mm} mm</b></span>
                      <span>Drain: <b className="text-white">{a.water_level_m} m</b></span>
                      {a.top_driver && <span>Main driver: <b className="text-white">{a.top_driver.toLowerCase()}</b></span>}
                    </div>
                    <p className="rounded-xl border border-white/[0.07] bg-black/30 p-3 text-[12.5px] leading-relaxed text-slate-200">
                      {view === "GOVERNMENT" ? a.government_message : lang === "EN" ? a.citizen_message_en : a.citizen_message_kn}
                    </p>
                    {a.resolved_by && <p className="text-[11px] text-emerald-300/80">{a.resolved_by}</p>}
                    {a.acknowledged_by && <p className="text-[11px] text-slate-500">Acknowledged by {a.acknowledged_by} at {a.acknowledged_at}</p>}
                  </div>
                  {a.status !== "RESOLVED" && !citizen && (
                    <div className="flex min-w-[130px] flex-col gap-1.5">
                      {a.status === "ACTIVE" && <ActBtn onClick={() => act(acknowledgeAlert, a.id, "Alert acknowledged")}><CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />Acknowledge</ActBtn>}
                      {a.status !== "ESCALATED" && <ActBtn onClick={() => act(escalateAlert, a.id, "Escalated to central control room")}><ArrowUpRight className="h-3.5 w-3.5 text-violet-300" />Escalate</ActBtn>}
                      <ActBtn onClick={() => act(resolveAlert, a.id, "Alert resolved")}><Check className="h-3.5 w-3.5 text-emerald-300" />Resolve</ActBtn>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white">Watch list</h2>
            <p className="mb-2 text-[11px] text-slate-400">Zones with the highest flood chance in the next 24 h, even when all is calm</p>
            <ul className="space-y-1.5">
              {watch.map((z) => {
                const p = z.current_prediction!;
                return (
                  <li key={z.id}>
                    <button onClick={() => onSelectZone(z.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-slate-100">{z.name}</span>
                        <span className="text-[10.5px] text-slate-500">peak {p.peak_level_24h.toLowerCase()} · {p.peak_probability_24h < 0.01 ? "<1" : Math.round(p.peak_probability_24h * 100)}% {p.peak_in_h ? `in ${p.peak_in_h} h` : "now"}</span>
                      </span>
                      <Sparkline values={p.trajectory.slice(0, 25)} width={70} height={22} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <ThreatRadar threats={threats} onSelect={onSelectZone} />
          {!citizen && <div className="glass-panel rounded-2xl p-4 text-xs text-slate-300">
            <h2 className="mb-2 text-sm font-semibold text-white">Warning accuracy this session</h2>
            {verification && verification.flood_events ? (
              <p><b className="text-emerald-300">{verification.warned_in_advance} of {verification.flood_events}</b> floods were warned in advance, with a median warning time of <b className="text-white">{verification.median_lead_time_h} h</b>.</p>
            ) : <p className="text-slate-400">No floods yet. Each flood is checked against earlier warnings automatically.</p>}
            <p className="mt-2 text-[11px] text-slate-500">Kannada messages are templated; have a native speaker review them before public use.</p>
          </div>}
        </div>
      </div>
    </div>
  );
};

const ActBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">{children}</button>
);
