import React from "react";
import { FlaskConical, Info, History, Gauge, Filter, Target } from "lucide-react";
import { fetchBacktest } from "../services/api";
import type { Verification } from "../services/api";
import { usePoll } from "../utils/usePoll";

const MODEL_NAMES: Record<string, string> = {
  rule_rain_threshold: "Rule of thumb (rain last 3 h + next 6 h)",
  baseline_xgb_12: "Baseline XGBoost, 12 features (week 5)",
  tuned_xgb_14: "Tuned XGBoost, 14 features + calibration (week 6)",
};

export const ReportsPage: React.FC<{ model: any; verification: Verification | null }> = ({ model, verification }) => {
  const [bt] = usePoll(fetchBacktest, 600000);
  if (!model) return <p className="text-sm text-slate-400">Loading model report…</p>;
  const m = model.metrics;
  const lt = model.lead_time;
  const t = model.thresholds;
  const imp: any[] = model.importance ?? [];
  const maxImp = Math.max(...imp.map((i) => i.share_pct), 1);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><FlaskConical className="h-5 w-5 text-cyan-300" />Model &amp; validation</h1>
          <p className="mt-1 text-sm text-slate-400">{model.version} · trained {model.trained_at} on {model.data_source} · predicts: {model.target}</p>
        </div>
        <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-slate-300">
          train {model.splits.train[0]}–{model.splits.train.at(-1)} · val {model.splits.validation.join(",")} · test {model.splits.test.join(",")}
        </span>
      </div>

      <div className="flex gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-3 text-[12.5px] leading-relaxed text-amber-100">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>{model.disclaimer} Splits are by monsoon season, so test results come from seasons the model never saw. Retrain on real KSNDMC data with <code className="rounded bg-black/30 px-1">python -m ml.train --csv your_export.csv</code>.</p>
      </div>

      <section className="glass-panel overflow-x-auto rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">How the models compare (test seasons)</h2>
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-slate-400"><tr>
            <th className="py-2 font-medium">Model</th><th className="font-medium">ROC-AUC</th><th className="font-medium">PR-AUC</th>
            <th className="font-medium">Brier</th><th className="font-medium">Precision*</th><th className="font-medium">Recall*</th><th className="font-medium">F1*</th></tr></thead>
          <tbody>
            {Object.entries(m).map(([k, v]: [string, any]) => (
              <tr key={k} className={`border-t border-white/5 ${k === "tuned_xgb_14" ? "text-white" : "text-slate-300"}`}>
                <td className="py-2 font-medium">{MODEL_NAMES[k] ?? k}{k === "tuned_xgb_14" && <span className="ml-2 rounded bg-cyan-400/15 px-1.5 text-[10px] text-cyan-200">in use</span>}</td>
                <td className="font-mono">{v.roc_auc}</td><td className="font-mono">{v.pr_auc}</td><td className="font-mono">{v.brier ?? "–"}</td>
                <td className="font-mono">{v.precision_at_high}</td><td className="font-mono">{v.recall_at_high}</td><td className="font-mono">{v.f1_at_high}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-500">
          * at the HIGH warning threshold. Floods are rare ({(100 * m.tuned_xgb_14.positives / m.tuned_xgb_14.rows).toFixed(2)}% of zone-hours), so PR-AUC is the fairer score:
          a random guess would get about {(m.tuned_xgb_14.positives / m.tuned_xgb_14.rows).toFixed(3)}.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Stat icon={Target} title="Warned before flooding (test seasons)" value={`${lt.tuned.warned_pct}%`}
          sub={`${lt.tuned.warned_in_advance} of ${lt.tuned.flood_events} flood events got a HIGH warning first; median ${lt.tuned.median_lead_time_h} h ahead`} />
        <Stat icon={Gauge} title="SEVERE warnings" value={`${lt.tuned_severe.warned_pct}%`}
          sub={`warned at SEVERE before flooding, median ${lt.tuned_severe.median_lead_time_h} h ahead`} />
        <Stat icon={Target} title="This session (live demo)" value={verification?.flood_events ? `${verification.warned_in_advance}/${verification.flood_events}` : "–"}
          sub={verification?.flood_events ? `floods warned in advance, median ${verification.median_lead_time_h} h` : "Run the storm demo to verify warnings live"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-panel rounded-2xl p-4">
          <h2 className="mb-1 text-sm font-semibold text-white">What drives the predictions (mean |SHAP|, test data)</h2>
          <p className="mb-3 text-[11.5px] text-slate-400">Exact TreeSHAP values from the trained booster, the same method used to explain each zone live.</p>
          <div className="space-y-1.5">
            {imp.map((i) => (
              <div key={i.feature} className="grid grid-cols-[180px_1fr_44px] items-center gap-2 text-[11.5px]">
                <span className="truncate text-slate-300">{i.label}</span>
                <div className="h-2 rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-300" style={{ width: `${(i.share_pct / maxImp) * 100}%` }} /></div>
                <span className="text-right font-mono text-slate-400">{i.share_pct}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-4">
          <h2 className="mb-1 text-sm font-semibold text-white">Calibration and warning levels</h2>
          <p className="mb-2 text-[11.5px] text-slate-400">If the model says 30%, floods should happen about 30% of the time. Points on the diagonal are well calibrated (isotonic calibration, fitted on the validation season).</p>
          <Calibration points={model.calibration_curve} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Thr name="MEDIUM (watch)" v={t.MEDIUM} why="catches 85% of floods" />
            <Thr name="HIGH (warning)" v={t.HIGH} why="best recall-weighted F2" />
            <Thr name="SEVERE" v={t.SEVERE} why="75%+ of warnings correct" />
          </div>
        </section>
      </div>

      {bt && (
        <section className="glass-panel rounded-2xl p-4">
          <div className="mb-1 flex items-center gap-2"><History className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-white">Backtest: {bt.event}</h2></div>
          <p className="mb-3 text-[11.5px] text-amber-100/80">{bt.note}</p>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Mini label="Zones that flooded" value={bt.zones_flooded} />
            <Mini label="Warned before flooding" value={`${bt.zones_warned_before_flooding}/${bt.zones_flooded}`} />
            <Mini label="Median lead at SEVERE" value={`${bt.median_severe_lead_time_h ?? "–"} h`} />
            <Mini label="Warned but did not flood" value={bt.false_alarm_zones} />
          </div>
          <BacktestChart timeline={bt.timeline} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-slate-400"><tr><th className="py-1.5 font-medium">Zone</th><th className="font-medium">Peak probability</th><th className="font-medium">Flooded at</th>
                <th className="font-medium">First HIGH</th><th className="font-medium">First SEVERE</th><th className="font-medium">Lead (SEVERE)</th></tr></thead>
              <tbody>
                {bt.zones.slice(0, 12).map((z: any) => (
                  <tr key={z.zone_id} className="border-t border-white/5 text-slate-300">
                    <td className="py-1.5 text-slate-100">{z.zone}</td><td className="font-mono">{Math.round(z.peak_prob * 100)}%</td>
                    <td className="font-mono">{z.flooded ? `${z.first_flood_h} h` : "no"}</td>
                    <td className="font-mono">{z.first_high_h ?? "–"}{z.first_high_h !== null && " h"}</td>
                    <td className="font-mono">{z.first_severe_h ?? "–"}{z.first_severe_h !== null && " h"}</td>
                    <td className={`font-mono ${z.severe_lead_time_h ? "text-emerald-300" : z.flooded ? "text-rose-300" : "text-slate-500"}`}>
                      {z.flooded ? (z.severe_lead_time_h !== null ? `${z.severe_lead_time_h} h` : "missed") : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-slate-500">Hours are relative to the rainfall peak (0 h). Negative means before the peak.</p>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-panel overflow-x-auto rounded-2xl p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Tuning grid (validation PR-AUC)</h2>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400"><tr><th className="py-1 font-medium">Depth</th><th className="font-medium">Learning rate</th><th className="font-medium">Min child weight</th><th className="font-medium">Trees</th><th className="font-medium">PR-AUC</th></tr></thead>
            <tbody>
              {[...model.tuning].sort((a: any, b: any) => b.val_pr_auc - a.val_pr_auc).map((r: any, i: number) => (
                <tr key={i} className={`border-t border-white/5 font-mono ${i === 0 ? "text-cyan-200" : "text-slate-300"}`}>
                  <td className="py-1">{r.max_depth}</td><td>{r.eta}</td><td>{r.min_child_weight}</td><td>{r.best_rounds}</td><td>{r.val_pr_auc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">Monotone constraints keep the model physically sensible: more rain or higher drain levels can never lower the risk.</p>
        </section>

        <section className="glass-panel rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2"><Filter className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-white">Data cleaning (training data)</h2></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {["spike", "negative", "stuck", "gap"].map((k) => <Mini key={k} label={`${k} readings repaired`} value={model.cleaning_report[k]} />)}
          </div>
          <p className="mt-3 text-[11.5px] text-slate-400">
            {model.cleaning_report.rows?.toLocaleString()} zone-hours processed. Injected sensor faults were caught with precision{" "}
            <b className="text-white">{model.cleaning_report.fault_detection_precision}</b> and recall <b className="text-white">{model.cleaning_report.fault_detection_recall}</b>
            {" "}(synthetic faults are easier to catch than real ones).
          </p>
        </section>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: any; title: string; value: string; sub: string }> = ({ icon: Icon, title, value, sub }) => (
  <div className="glass-panel rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs text-slate-400"><Icon className="h-4 w-4 text-emerald-300" />{title}</div>
    <div className="mt-1 text-3xl font-extrabold text-white tabular">{value}</div>
    <div className="text-[11.5px] text-slate-400">{sub}</div>
  </div>
);
const Mini: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
    <div className="text-[10.5px] capitalize text-slate-400">{label}</div><div className="font-mono text-lg font-semibold text-white">{value}</div>
  </div>
);
const Thr: React.FC<{ name: string; v: number; why: string }> = ({ name, v, why }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
    <div className="font-semibold text-slate-200">{name}</div><div className="font-mono text-cyan-200">p ≥ {v}</div><div className="text-slate-500">{why}</div>
  </div>
);

const Calibration: React.FC<{ points: { predicted: number; observed: number; n: number }[] }> = ({ points }) => {
  const S = 200, pad = 28;
  const x = (v: number) => pad + v * (S - pad - 6), y = (v: number) => S - pad - v * (S - pad - 6);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-[220px] w-full max-w-[260px]" role="img" aria-label="Calibration plot">
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#475569" strokeDasharray="3 3" />
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="#334155" /><line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="#334155" />
      <polyline points={points.map((p) => `${x(p.predicted)},${y(p.observed)}`).join(" ")} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
      {points.map((p, i) => <circle key={i} cx={x(p.predicted)} cy={y(p.observed)} r={Math.max(2.2, Math.min(6, Math.log10(p.n + 1)))} fill="#22d3ee" fillOpacity="0.8" />)}
      <g fontSize="8" fill="#64748b"><text x={x(0.5)} y={S - 8} textAnchor="middle">predicted probability</text>
        <text x={9} y={y(0.5)} textAnchor="middle" transform={`rotate(-90 9 ${y(0.5)})`}>observed rate</text>
        <text x={x(0)} y={y(0) + 10} textAnchor="middle">0</text><text x={x(1)} y={y(0) + 10} textAnchor="middle">1</text></g>
    </svg>
  );
};

const BacktestChart: React.FC<{ timeline: any[] }> = ({ timeline }) => {
  const W = 760, H = 170, pad = 30;
  const n = timeline.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad - 8);
  const maxR = Math.max(...timeline.map((t) => t.city_rain_mm), 1);
  const y = (v: number, max: number) => H - 22 - (v / max) * (H - 36);
  const line = (k: string, color: string) => <polyline points={timeline.map((t, i) => `${x(i)},${y(t[k], 18)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" />;
  const peak = timeline.findIndex((t) => t.h === 0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label="Backtest timeline">
        {timeline.map((t, i) => <rect key={i} x={x(i) - 4} width={8} y={y(t.city_rain_mm, maxR)} height={H - 22 - y(t.city_rain_mm, maxR)} fill="#38bdf8" opacity=".3" />)}
        {line("zones_high", "#fb923c")}{line("zones_severe", "#f43f5e")}{line("zones_flooded", "#e2e8f0")}
        {peak >= 0 && <line x1={x(peak)} x2={x(peak)} y1={8} y2={H - 22} stroke="#e2e8f0" strokeDasharray="3 3" opacity=".5" />}
        <g fontSize="10" fill="#64748b" fontFamily="JetBrains Mono, monospace">
          {timeline.map((t, i) => t.h % 6 === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{t.h > 0 ? `+${t.h}` : t.h}h</text> : null)}
        </g>
      </svg>
      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-3 bg-sky-400/40" />city rain (mm/h)</span>
        <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-orange-400" />zones at HIGH+</span>
        <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-rose-500" />zones at SEVERE</span>
        <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-slate-200" />zones actually flooded</span>
      </div>
    </div>
  );
};
