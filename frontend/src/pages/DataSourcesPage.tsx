import React, { useState } from "react";
import { Database, CloudRain, Cpu, ShieldCheck, Filter, BellRing, ArrowRight, AlertTriangle, Satellite, FileSpreadsheet } from "lucide-react";
import type { SensorReading } from "../services/api";
import { fetchDataQuality, setDataSource } from "../services/api";
import { usePoll } from "../utils/usePoll";

const STAGES = [
  { icon: CloudRain, name: "Ingest", text: "Rain gauges, drain sensors, forecast" },
  { icon: Filter, name: "Clean", text: "Spike gate, stuck gauges, gaps" },
  { icon: Database, name: "Features", text: "14 rainfall, drainage, terrain and history features" },
  { icon: Cpu, name: "Predict", text: "Calibrated XGBoost, 48 h trajectory" },
  { icon: BellRing, name: "Warn", text: "Threat and alert engine, EN + ಕನ್ನಡ" },
];

const FEEDS = [
  { icon: CloudRain, name: "Open-Meteo hourly rainfall", status: "Available", tone: "text-emerald-300", note: "Free public API, no key. Past 4 days + 48 h forecast per zone." },
  { icon: FileSpreadsheet, name: "KSNDMC / BBMP CSV export", status: "Adapter ready", tone: "text-cyan-300", note: "python -m ml.train --csv export.csv retrains on real records." },
  { icon: Database, name: "BBMP flood-prone zone register", status: "Seed data", tone: "text-slate-300", note: "18 pilot zones with ward, terrain and drainage attributes." },
  { icon: Satellite, name: "Sentinel-1 SAR flood masks", status: "Not connected", tone: "text-amber-300", note: "The comparison view uses simulated observations." },
];

export const DataSourcesPage: React.FC<{ sensors: SensorReading[]; onModeChanged: () => void }> = ({ sensors, onModeChanged }) => {
  const [dq, refresh] = usePoll(fetchDataQuality, 4000);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const mode = dq?.data_mode ?? "simulator";

  const switchTo = async (m: "simulator" | "open-meteo") => {
    setBusy(true); setNote(null);
    try {
      const r = await setDataSource(m);
      setNote(r.error ?? (r.mode === "open-meteo" ? "Now using live Open-Meteo rainfall for all 18 zones." : "Back to the simulator."));
    } catch { setNote("Couldn't reach the backend."); }
    setBusy(false); refresh(); onModeChanged();
  };

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Database className="h-5 w-5 text-cyan-300" />Data sources &amp; pipeline</h1>
        <p className="mt-1 text-sm text-slate-400">Where the data comes from, how it's cleaned, and which feed is driving predictions right now.</p>
      </div>

      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-white">Live data source</h2>
        <p className="mb-3 text-[12px] text-slate-400">The simulator is best for demos (storms, flooding and warning checks). Open-Meteo runs the same model on today's real rainfall for Bengaluru; drain levels are then modelled from that rainfall.</p>
        <div className="flex flex-wrap items-center gap-2">
          {(["simulator", "open-meteo"] as const).map((m) => (
            <button key={m} disabled={busy} onClick={() => switchTo(m)} aria-pressed={mode === m}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${mode === m ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-300 hover:border-white/25"}`}>
              {m === "simulator" ? "Simulator (demo)" : "Live rainfall (Open-Meteo)"}
            </button>
          ))}
          {busy && <span className="text-xs text-slate-400">Switching…</span>}
        </div>
        {(note || dq?.data_mode_error) && (
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${(dq?.data_mode_error || note?.includes("unavailable")) ? "text-amber-200" : "text-emerald-200"}`}>
            {(dq?.data_mode_error || note?.includes("unavailable")) && <AlertTriangle className="h-3.5 w-3.5" />}{note ?? dq?.data_mode_error}
          </p>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Pipeline</h2>
        <div className="flex flex-wrap items-stretch gap-2">
          {STAGES.map((s, i) => (
            <React.Fragment key={s.name}>
              <div className="min-w-[150px] flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><s.icon className="h-4 w-4 text-cyan-300" />{s.name}</div>
                <p className="mt-1 text-[11.5px] text-slate-400">{s.text}</p>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="hidden h-4 w-4 self-center text-slate-600 md:block" />}
            </React.Fragment>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-panel rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Feeds</h2>
          <ul className="space-y-2">
            {FEEDS.map((f) => (
              <li key={f.name} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <f.icon className="mt-0.5 h-4 w-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-white">{f.name}</span><span className={`font-semibold ${f.tone}`}>{f.status}</span></div>
                  <p className="text-[11.5px] text-slate-400">{f.note}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-slate-400">{sensors.length} sensor channels live (rain gauge, drain level and weather station for each zone).</p>
        </section>

        <section className="glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" />Anomaly log</h2>
            <span className="text-[11px] text-slate-400">training data quality {dq?.quality_score_pct ?? "–"}%</span>
          </div>
          {(dq?.anomalies_detected ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No anomalies yet this session. A gauge glitches about once a day of simulated time; it's quarantined and replaced with the median of other gauges before the model sees it.</p>
          ) : (
            <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {dq.anomalies_detected.map((a: any, i: number) => (
                <li key={i} className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-2.5 text-[11.5px]">
                  <div className="flex justify-between gap-2"><span className="font-semibold text-amber-100">{a.sensor_id} · {a.zone}</span><span className="font-mono text-slate-500">{a.timestamp}</span></div>
                  <div className="text-slate-300">Read {a.value}; used {a.replaced_with}.</div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-xs font-semibold text-slate-200">Validation rules</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[11.5px] text-slate-400">
            {(dq?.validation_rules_active ?? []).map((r: string) => <li key={r}>{r}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
};
