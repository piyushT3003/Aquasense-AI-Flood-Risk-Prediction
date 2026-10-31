import React, { useState } from "react";
import { CloudRain, Droplets, Umbrella, TrendingUp, MapPin } from "lucide-react";
import { fetchRainfallTimeline } from "../services/api";
import { usePoll } from "../utils/usePoll";
import { RainCanvas } from "../components/effects/RainCanvas";

const CLASS_TONE: Record<string, string> = {
  None: "text-slate-400", Light: "text-sky-300", Moderate: "text-cyan-200", Heavy: "text-amber-300", Violent: "text-rose-300",
  "No rain": "text-slate-400", "Very heavy": "text-orange-300", "Extremely heavy": "text-rose-300",
};

export const RainfallPage: React.FC<{ onSelectZone: (id: string) => void }> = ({ onSelectZone }) => {
  const [d, , err] = usePoll(fetchRainfallTimeline, 3000);
  const [metric, setMetric] = useState<"last_24h_mm" | "today_mm" | "now_mm_h" | "next_24h_mm">("last_24h_mm");
  if (!d) return <p className="text-sm text-slate-400">{err ? "Rainfall data needs the backend. Start it and this page fills in by itself." : "Loading rainfall…"}</p>;
  const c = d.city;
  const timeline = [...d.past_48h.map((x: any) => ({ ...x, kind: "obs" })), ...d.next_48h.map((x: any) => ({ ...x, kind: "fc" }))];
  const tmax = Math.max(2, ...timeline.map((t: any) => t.max_mm));
  const zmax = Math.max(1, ...d.zones.map((z: any) => z[metric]));
  const intensity = Math.min(1, 0.05 + c.now_mm_h / 12);
  const fill = Math.min(100, (c.now_mm_h / 40) * 100);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><CloudRain className="h-5 w-5 text-sky-300" />Rainfall</h1>
          <p className="mt-1 text-sm text-slate-400">How much rain has fallen across Bengaluru, zone by zone, and what is forecast. Updates every hour.</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[11.5px] text-slate-300">Source: {d.source}</span>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-[#06213d] via-[#071a33] to-[#050b16] p-6">
        <RainCanvas intensity={intensity} className="absolute inset-0 h-full w-full" />
        <div className="relative grid items-center gap-6 md:grid-cols-[180px_1fr]">
          <div className="relative mx-auto h-[170px] w-[130px]" role="img" aria-label={`City rainfall ${c.now_mm_h} millimetres per hour`}>
            <svg viewBox="0 0 100 130" className="absolute inset-0 h-full w-full">
              <defs>
                <clipPath id="dropClip"><path d="M50 4 C30 38 10 60 10 84 a40 40 0 0 0 80 0 C90 60 70 38 50 4 Z" /></clipPath>
                <linearGradient id="dropFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#67e8f9" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
              </defs>
              <path d="M50 4 C30 38 10 60 10 84 a40 40 0 0 0 80 0 C90 60 70 38 50 4 Z" fill="rgba(56,189,248,.08)" stroke="#38bdf8" strokeOpacity=".5" strokeWidth="1.5" />
              <g clipPath="url(#dropClip)">
                <g style={{ transform: `translateY(${124 - (fill / 100) * 116}px)`, transition: "transform 1s cubic-bezier(.2,.8,.2,1)" }}>
                  <path className="aq-wave" d="M-100 6 Q-75 0 -50 6 T0 6 T50 6 T100 6 T150 6 T200 6 V200 H-100 Z" fill="url(#dropFill)" opacity=".9" />
                </g>
              </g>
            </svg>
            <div className="absolute inset-x-0 top-[62%] text-center">
              <div className="font-mono text-2xl font-extrabold text-white drop-shadow">{c.now_mm_h.toFixed(1)}</div>
              <div className="text-[10px] text-sky-100">mm/h</div>
            </div>
          </div>
          <div>
            <div className="text-sm text-sky-100">Right now, city average</div>
            <div className={`text-4xl font-extrabold ${CLASS_TONE[c.class_now] ?? "text-white"}`}>{c.class_now === "None" ? "Dry" : `${c.class_now} rain`}</div>
            <p className="mt-1 text-sm text-slate-300">{c.raining_zones} of 18 zones have rain this hour. Wettest in 24 h: <b className="text-white">{c.wettest_zone}</b> ({c.wettest_24h_mm} mm).</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Chip icon={Droplets} label="Today so far" value={`${c.today_mm} mm`} />
              <Chip icon={Umbrella} label="Last 24 h" value={`${c.last_24h_mm} mm`} />
              <Chip icon={TrendingUp} label="Next 6 h" value={`${c.next_6h_mm} mm`} accent />
              <Chip icon={TrendingUp} label="Next 24 h" value={`${c.next_24h_mm} mm`} accent />
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Last 48 hours and next 48 hours</h2>
          <div className="flex gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2 rounded-sm bg-sky-400" />observed (city avg)</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2 rounded-sm bg-amber-300/60" />forecast</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-white/40" />wettest zone</span>
          </div>
        </div>
        <div className="relative flex h-[170px] items-end gap-[2px]">
          {timeline.map((t: any, i: number) => (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${t.time}: ${t.city_mm} mm/h city, ${t.max_mm} mm/h wettest zone`}>
              <div className="absolute w-full border-t border-white/40" style={{ bottom: `${(t.max_mm / tmax) * 100}%` }} />
              <div className={`w-full rounded-t-sm transition-all duration-700 ${t.kind === "obs" ? "bg-gradient-to-t from-sky-600 to-sky-300" : "bg-amber-300/50"} group-hover:brightness-125`}
                style={{ height: `${Math.max(1.5, (t.city_mm / tmax) * 100)}%` }} />
            </div>
          ))}
          <div className="absolute bottom-0 top-0 w-px bg-white/60" style={{ left: "50%" }}><span className="absolute -top-1 left-1 text-[10px] text-white">now</span></div>
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>−48 h</span><span>−24 h</span><span>now</span><span>+24 h</span><span>+48 h</span></div>
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">By zone</h2>
          <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5 text-[11.5px]">
            {([["now_mm_h", "Now"], ["today_mm", "Today"], ["last_24h_mm", "24 h"], ["next_24h_mm", "Next 24 h"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setMetric(k)} className={`rounded-md px-2.5 py-1 ${metric === k ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400 hover:text-white"}`}>{l}</button>
            ))}
          </div>
        </div>
        <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {[...d.zones].sort((a: any, b: any) => b[metric] - a[metric]).map((z: any) => (
            <li key={z.zone_id}>
              <button onClick={() => onSelectZone(z.zone_id)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 truncate text-slate-200"><MapPin className="h-3 w-3 text-slate-500" />{z.zone_name}</span>
                  <span className="flex items-center gap-2">
                    {z.now_mm_h >= 0.2 && <span className="flex items-center gap-1 text-[10.5px] text-sky-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />raining</span>}
                    <span className="font-mono text-white">{z[metric]}{metric === "now_mm_h" ? " mm/h" : " mm"}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full transition-all duration-700 ${metric === "next_24h_mm" ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-gradient-to-r from-blue-600 to-sky-300"}`}
                    style={{ width: `${Math.max(1, (z[metric] / zmax) * 100)}%` }} />
                </div>
                <div className={`mt-0.5 text-[10.5px] ${CLASS_TONE[z.class_24h] ?? "text-slate-500"}`}>24 h: {z.class_24h}</div>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">24-hour categories follow IMD: light 2.5–15.5 mm, moderate 15.6–64.4, heavy 64.5–115.5, very heavy 115.6–204.4, extremely heavy ≥ 204.5.</p>
      </section>
    </div>
  );
};

const Chip: React.FC<{ icon: any; label: string; value: string; accent?: boolean }> = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
    <div className="flex items-center gap-1 text-[10.5px] text-slate-400"><Icon className="h-3 w-3" />{label}</div>
    <div className={`font-mono text-lg font-bold ${accent ? "text-amber-200" : "text-white"}`}>{value}</div>
  </div>
);
