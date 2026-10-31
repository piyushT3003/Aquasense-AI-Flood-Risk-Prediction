import React from "react";
import { scoreColor } from "../../utils/risk";

/** Risk trajectory (0-1 scores) with HIGH/SEVERE bands, optional rain bars, "now" marker. */
export const TrajectoryChart: React.FC<{
  values: number[]; rain?: number[]; height?: number; labels?: string[]; showAxis?: boolean;
}> = ({ values, rain, height = 140, labels, showAxis = true }) => {
  const W = 600, H = height, padL = showAxis ? 34 : 4, padB = showAxis ? 18 : 4, padT = 8;
  const n = Math.max(2, values.length);
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - 6);
  const y = (v: number) => padT + (1 - v) * (H - padT - padB);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${path}L${x(values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const rainSafe = rain?.slice(0, values.length).map((r) => (Number.isFinite(r) ? r : 0));
  const maxRain = Math.max(10, ...(rainSafe ?? [0]));
  const grad = `tg-${Math.round(values.reduce((a, b) => a + b, 0) * 1000)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img"
      aria-label="Risk trajectory chart">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={padL} y={y(1)} width={W - padL - 6} height={y(0.85) - y(1)} fill="#f43f5e" opacity="0.07" />
      <rect x={padL} y={y(0.85)} width={W - padL - 6} height={y(0.65) - y(0.85)} fill="#fb923c" opacity="0.06" />
      {rainSafe?.map((r, i) => (
        <rect key={i} x={x(i) - 2.5} width={5} y={y(0) - (r / maxRain) * (H - padT - padB) * 0.55}
          height={(r / maxRain) * (H - padT - padB) * 0.55} fill="#38bdf8" opacity="0.35" rx="1" />
      ))}
      {[0.35, 0.65, 0.85].map((t) => (
        <line key={t} x1={padL} x2={W - 6} y1={y(t)} y2={y(t)} stroke={scoreColor(t)} strokeDasharray="3 4" strokeOpacity="0.5" />
      ))}
      <path d={area} fill={`url(#${grad})`} />
      <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => (i % 6 === 0 || v >= 0.65) && i < values.length ? (
        <circle key={i} cx={x(i)} cy={y(v)} r={v >= 0.65 ? 2.6 : 1.6} fill={scoreColor(v)} />
      ) : null)}
      <line x1={x(0)} x2={x(0)} y1={padT} y2={y(0)} stroke="#e2e8f0" strokeOpacity="0.5" />
      {showAxis && (
        <g fontSize="10" fill="#64748b" fontFamily="JetBrains Mono, monospace">
          {["LOW", "MED", "HIGH", "SEV"].map((l, k) => (
            <text key={l} x={2} y={y([0.17, 0.5, 0.75, 0.93][k]) + 3}>{l}</text>
          ))}
          {(labels ?? values.map((_, i) => (i === 0 ? "now" : `+${i}h`))).map((l, i) =>
            i % Math.ceil(n / 8) === 0 ? <text key={i} x={x(i)} y={H - 4} textAnchor="middle">{l}</text> : null)}
        </g>
      )}
    </svg>
  );
};

export const Sparkline: React.FC<{ values: number[]; width?: number; height?: number }> = ({ values, width = 120, height = 28 }) => {
  if (!values?.length) return null;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - v * (height - 4)}`).join(" ");
  const last = values[values.length - 1];
  const peak = Math.max(...values);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line x1="0" x2={width} y1={height - 2 - 0.65 * (height - 4)} y2={height - 2 - 0.65 * (height - 4)} stroke="#fb923c" strokeOpacity=".35" strokeDasharray="2 3" />
      <polyline points={pts} fill="none" stroke={scoreColor(peak)} strokeWidth="1.8" />
      <circle cx={width} cy={height - 2 - last * (height - 4)} r="2" fill={scoreColor(last)} />
    </svg>
  );
};

/** Diverging bars for SHAP contributions (log-odds). */
export const ShapBars: React.FC<{ items: { label: string; value: number; display?: string }[] }> = ({ items }) => {
  const max = Math.max(0.01, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const w = (Math.abs(it.value) / max) * 50;
        const up = it.value > 0;
        return (
          <div key={it.label} className="text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span>{it.label}</span>
              <span className="font-mono text-slate-400">{it.display}</span>
            </div>
            <div className="relative mt-1 h-1.5 rounded-full bg-white/5">
              <div className="absolute top-0 h-full w-px bg-white/30" style={{ left: "50%" }} />
              <div className={`absolute top-0 h-full rounded-full ${up ? "bg-orange-400" : "bg-emerald-400"}`}
                style={{ left: up ? "50%" : `${50 - w}%`, width: `${w}%` }} />
            </div>
          </div>
        );
      })}
      <div className="flex justify-between pt-1 text-[10px] text-slate-500">
        <span>← lowers risk</span><span>raises risk →</span>
      </div>
    </div>
  );
};
