import React, { useState } from "react";
import { MapPin, Phone, ShieldCheck, AlertTriangle, CloudRain, Map } from "lucide-react";
import type { Zone, AlertItem } from "../services/api";
import { RainfallWidget } from "../components/RainfallWidget";
import { TrajectoryChart } from "../components/charts/Charts";
import { scoreColor } from "../utils/risk";

const ADVICE: Record<string, { title: string; tips: string[] }> = {
  LOW: { title: "No flooding expected", tips: ["Normal travel is fine.", "Keep an eye on this page if heavy rain starts."] },
  MEDIUM: { title: "Some chance of waterlogging", tips: ["Avoid underpasses during heavy showers.", "Keep your phone charged and check back in an hour."] },
  HIGH: { title: "Flooding is likely soon", tips: ["Avoid underpasses, low roads and drains.", "Move vehicles to higher ground.", "Delay travel that isn't necessary."] },
  SEVERE: { title: "Severe flooding expected", tips: ["Stay indoors and away from flooded roads.", "Switch off power if water enters your home.", "Follow official BBMP instructions. Call 1533 for help."] },
};

export const CitizenHome: React.FC<{ zones: Zone[]; alerts: AlertItem[]; onNavigateTab: (t: any) => void; onOpenZone: (id: string) => void }> = ({
  zones, alerts, onNavigateTab, onOpenZone,
}) => {
  const [area, setArea] = useState<string>(() => { try { return localStorage.getItem("aq.citizen.area") ?? "zone-3"; } catch { return "zone-3"; } });
  const choose = (id: string) => { setArea(id); try { localStorage.setItem("aq.citizen.area", id); } catch { /* ignore */ } };
  const z = zones.find((q) => q.id === area) ?? zones[0];
  const p = z?.current_prediction;
  const level = p?.risk_level ?? "LOW";
  const advice = ADVICE[level];
  const color = scoreColor(p?.risk_score ?? 0);
  const mine = alerts.filter((a) => a.zone_id === z?.id && a.status !== "RESOLVED").slice(0, 3);
  const nearby = zones.filter((q) => q.current_prediction && ["HIGH", "SEVERE"].includes(q.current_prediction.risk_level) && q.id !== z?.id);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Is my area safe from flooding?</h1>
        <p className="mt-1 text-sm text-slate-400">Live flood risk for your neighbourhood, updated every hour. Always follow official BBMP advisories.</p>
      </div>

      <label className="flex max-w-md items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <MapPin className="h-4 w-4 text-cyan-300" />
        <span className="text-xs text-slate-400">My area</span>
        <select value={area} onChange={(e) => choose(e.target.value)} className="flex-1 bg-transparent text-sm font-semibold text-white focus:outline-none">
          {zones.map((q) => <option key={q.id} value={q.id} className="bg-[#071226]">{q.name}</option>)}
        </select>
      </label>

      {z && p && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="relative overflow-hidden rounded-3xl border p-6" style={{ borderColor: `${color}55`, background: `linear-gradient(140deg, ${color}22, rgba(6,14,28,.85) 60%)` }}>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {level === "LOW" ? <ShieldCheck className="h-4 w-4" style={{ color }} /> : <AlertTriangle className="h-4 w-4" style={{ color }} />}
              {z.name} · right now
            </div>
            <div className="mt-2 text-4xl font-extrabold" style={{ color }}>{advice.title}</div>
            <p className="mt-2 text-sm text-slate-200">
              {p.flood_probability < 0.01 ? "Less than 1%" : `${Math.round(p.flood_probability * 100)}%`} chance of waterlogging in the next 6 hours.
              {p.hours_to_high !== null && ["LOW", "MEDIUM"].includes(level) ? ` Risk is expected to rise in about ${p.hours_to_high} hour${p.hours_to_high === 1 ? "" : "s"}.` : ""}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-100">
              {advice.tips.map((t) => <li key={t} className="flex gap-2"><span style={{ color }}>•</span>{t}</li>)}
            </ul>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-1 text-[11px] text-slate-400">Flood risk over the next 48 hours</div>
              <TrajectoryChart values={p.trajectory} height={110} />
            </div>
            <button onClick={() => onOpenZone(z.id)} className="mt-4 flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:underline"><Map className="h-4 w-4" />See my area on the 3D map</button>
          </section>

          <div className="space-y-4">
            <RainfallWidget onOpen={() => onNavigateTab("RAINFALL")} />
            <section className="glass-panel rounded-2xl p-4">
              <h2 className="mb-2 text-sm font-semibold text-white">Alerts for my area</h2>
              {mine.length ? mine.map((a) => (
                <div key={a.id} className="mb-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-3 text-[12.5px] text-slate-100">
                  <div className="mb-0.5 text-[11px] font-semibold text-amber-200">{a.expected_window}</div>{a.citizen_message_en}
                  <div className="mt-1 text-[11.5px] text-slate-300">{a.citizen_message_kn}</div>
                </div>
              )) : <p className="text-xs text-slate-400">No alerts for {z.name}.</p>}
              {nearby.length > 0 && <p className="mt-2 text-xs text-slate-400"><CloudRain className="mr-1 inline h-3 w-3" />Flood risk is high in: {nearby.map((q) => q.name).join(", ")}.</p>}
            </section>
            <section className="glass-panel rounded-2xl p-4 text-sm">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-white"><Phone className="h-4 w-4 text-emerald-300" />Emergency help</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 p-2"><div className="text-slate-400">BBMP helpline</div><div className="font-mono text-lg font-bold text-white">1533</div></div>
                <div className="rounded-lg border border-white/10 p-2"><div className="text-slate-400">Emergency</div><div className="font-mono text-lg font-bold text-white">112</div></div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
