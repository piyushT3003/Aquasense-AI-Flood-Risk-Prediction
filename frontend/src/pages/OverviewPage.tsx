import React from "react";
import { ArrowRight, Zap, ShieldCheck, CloudRain, TrendingUp, BellRing, Map } from "lucide-react";
import { AquaGlobe } from "../components/globe/AquaGlobe";
import { ThreatRadar } from "../components/threats/ThreatRadar";
import { RainfallWidget } from "../components/RainfallWidget";
import { fetchRiskForecast } from "../services/api";
import type { Zone, AlertItem, Threat, Verification } from "../services/api";
import { usePoll } from "../utils/usePoll";
import { levelBadge, scoreColor } from "../utils/risk";

interface OverviewPageProps {
  zones: Zone[];
  threats: Threat[];
  verification: Verification | null;
  activeAlerts: AlertItem[];
  cityRisk: string;
  isStormActive: boolean;
  onNavigateTab: (tabKey: any) => void;
  onSelectZone: (id: string) => void;
  onTriggerStorm: () => void;
  lakes: any[];
  drains: any[];
  infrastructure: any[];
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  zones, threats, verification, activeAlerts, cityRisk, isStormActive, onNavigateTab, onSelectZone, onTriggerStorm,
}) => {
  const [forecast] = usePoll(fetchRiskForecast, 3000);
  const preds = zones.map((z) => ({ z, p: z.current_prediction! })).filter((x) => x.p);
  const top = [...preds].sort((a, b) => b.p.risk_score - a.p.risk_score)[0];
  const wettest = [...preds].sort((a, b) => b.p.rainfall_24h_mm - a.p.rainfall_24h_mm)[0];
  const nextRain = [...preds].sort((a, b) => b.p.forecast_6h_mm - a.p.forecast_6h_mm)[0];
  const hourly: any[] = forecast?.hourly ?? [];
  const peakHour = hourly.reduce((best, h) => (h.high_risk_zones > (best?.high_risk_zones ?? -1) ? h : best), null as any);

  return (
    <div className="space-y-6 pb-10">
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-1 text-[11.5px] text-cyan-100">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /> 18 BBMP flood zones · model {forecast?.model ?? "loading"}
          </div>
          <h1 className="max-w-[16ch] text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-[3.25rem]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Know which streets will flood before the rain arrives.
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-slate-400">
            AquaSense scores every zone every hour with a trained XGBoost model, projects risk 48 hours ahead from the
            rainfall forecast, and warns officers and residents while there is still time to act.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onNavigateTab("SATELLITE")}
              className="flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-[#04121f] shadow-glow-cyan transition hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Map className="h-4 w-4" /> Open 3D satellite view <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={onTriggerStorm} disabled={isStormActive}
              className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60">
              <Zap className="h-4 w-4" /> {isStormActive ? "Storm in progress" : "Run the storm demo"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi icon={TrendingUp} label="City risk" value={cityRisk} sub={`${preds.filter((x) => x.p.risk_level === "HIGH" || x.p.risk_level === "SEVERE").length} zones HIGH or worse`}
              tone={cityRisk === "LOW" ? "text-emerald-300" : cityRisk === "MEDIUM" ? "text-amber-300" : cityRisk === "HIGH" ? "text-orange-300" : "text-rose-300"} />
            <Kpi icon={BellRing} label="Highest risk" value={top ? `${Math.round(top.p.risk_score * 100)}` : "–"} sub={top?.z.name ?? ""}
              tone="" color={top ? scoreColor(top.p.risk_score) : undefined} />
            <Kpi icon={CloudRain} label="Wettest 24 h" value={wettest ? `${wettest.p.rainfall_24h_mm} mm` : "–"} sub={wettest?.z.name ?? ""} tone="text-cyan-200" />
            <Kpi icon={CloudRain} label="Most rain next 6 h" value={nextRain ? `${nextRain.p.forecast_6h_mm} mm` : "–"} sub={nextRain?.z.name ?? ""} tone="text-sky-200" />
          </div>
        </div>
        <div className="relative h-[420px] overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#071a33]/60 to-transparent">
          <AquaGlobe zones={zones} selectedZone={null} onSelectZone={() => undefined} isStormActive={isStormActive} />
          <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-500">Bengaluru · 12.97° N, 77.59° E</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <RainfallWidget onOpen={() => onNavigateTab("RAINFALL")} />
          <ThreatRadar threats={threats} onSelect={onSelectZone} compact />
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">City outlook, next 48 h</h2>
            <button onClick={() => onNavigateTab("FORECAST")} className="text-[11px] text-cyan-300 hover:underline">Full forecast</button>
          </div>
          <OutlookBars hourly={hourly} />
          <p className="mt-2 text-[11.5px] text-slate-400">
            {peakHour && peakHour.high_risk_zones > 0
              ? <>Worst hour: <b className="text-white">{peakHour.time}</b>, with {peakHour.high_risk_zones} zone{peakHour.high_risk_zones > 1 ? "s" : ""} at HIGH or worse.</>
              : "No zone is projected to reach HIGH risk in the next 48 hours."}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><h2 className="text-sm font-semibold text-white">Were floods warned in time?</h2></div>
          {verification && verification.flood_events > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-300 tabular">{verification.warned_in_advance}/{verification.flood_events}</span>
                <span className="text-xs text-slate-400">floods warned in advance</span>
              </div>
              <div className="mt-1 text-xs text-slate-300">Median warning time: <b className="text-white">{verification.median_lead_time_h ?? "–"} h</b> before water appeared</div>
              <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
                {verification.recent.slice(0, 4).map((e, i) => (
                  <li key={i} className="flex justify-between gap-2"><span className="truncate">{e.zone}</span>
                    <span className={e.warned ? "text-emerald-300" : "text-rose-300"}>{e.warned ? `${e.lead_time_h} h ahead` : "missed"}</span></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-slate-400">No flooding has occurred yet in this session. Run the storm demo: each flood is checked against the warnings the model issued beforehand.</p>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Latest alerts</h2>
          <button onClick={() => onNavigateTab("ALERT_CENTER")} className="text-[11px] text-cyan-300 hover:underline">Alert center</button>
        </div>
        {activeAlerts.length === 0 ? (
          <p className="text-xs text-slate-400">No active alerts. All zones are within normal limits.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {activeAlerts.slice(0, 4).map((a) => (
              <button key={a.id} onClick={() => onSelectZone(a.zone_id)}
                className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left transition hover:border-cyan-400/30">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-white">{a.zone_name}</span>
                  <span className={`rounded border px-1.5 text-[10px] font-bold ${levelBadge[a.severity as keyof typeof levelBadge] ?? levelBadge.HIGH}`}>{a.severity}</span>
                  <span className="text-[10.5px] text-slate-400">{a.trigger_type.replace(/_/g, " ").toLowerCase()} · {a.expected_window}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-slate-300">{a.citizen_message_en}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const Kpi: React.FC<{ icon: any; label: string; value: string; sub: string; tone: string; color?: string }> = ({ icon: Icon, label, value, sub, tone, color }) => (
  <div className="glass-card rounded-xl p-3">
    <div className="flex items-center justify-between text-[11px] text-slate-400">{label}<Icon className="h-3.5 w-3.5 text-slate-500" /></div>
    <div className={`mt-1 text-xl font-extrabold tabular ${tone}`} style={color ? { color } : undefined}>{value}</div>
    <div className="truncate text-[11px] text-slate-500">{sub}</div>
  </div>
);

const OutlookBars: React.FC<{ hourly: any[] }> = ({ hourly }) => {
  if (!hourly.length) return <div className="h-[120px] animate-pulse rounded-lg bg-white/[0.03]" />;
  const maxRain = Math.max(5, ...hourly.map((h) => h.city_rain_mm_h));
  return (
    <div>
      <div className="flex h-[120px] items-end gap-[2px]" role="img" aria-label="Zones at high risk and city rainfall per hour for the next 48 hours">
        {hourly.map((h) => (
          <div key={h.h} className="relative flex h-full flex-1 flex-col justify-end" title={`${h.time}: ${h.high_risk_zones} zones HIGH+, rain ${h.city_rain_mm_h} mm/h`}>
            <div className="absolute bottom-0 w-full rounded-t-sm bg-sky-400/25" style={{ height: `${(h.city_rain_mm_h / maxRain) * 100}%` }} />
            <div className="relative w-full rounded-t-sm" style={{ height: `${(h.high_risk_zones / 18) * 100}%`, background: h.severe_zones ? "#f43f5e" : "#fb923c", minHeight: h.high_risk_zones ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>now</span><span>+12 h</span><span>+24 h</span><span>+36 h</span><span>+48 h</span></div>
      <div className="mt-1 flex gap-3 text-[10.5px] text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-orange-400" />zones HIGH+</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sky-400/40" />city rain</span>
      </div>
    </div>
  );
};
