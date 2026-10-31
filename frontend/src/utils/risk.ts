import type { RiskLevel } from "../services/api";

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "#34d399",
  MEDIUM: "#fbbf24",
  HIGH: "#fb923c",
  SEVERE: "#f43f5e",
};

/** Continuous colour for a 0-1 risk score (same bands as the backend). */
export function scoreColor(s: number): string {
  const stops: [number, number[]][] = [
    [0, [52, 211, 153]], [0.35, [251, 191, 36]], [0.65, [251, 146, 60]], [0.85, [244, 63, 94]], [1, [225, 29, 72]],
  ];
  const v = Math.max(0, Math.min(1, s));
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    if (v <= p1) {
      const [p0, c0] = stops[i - 1];
      const t = (v - p0) / (p1 - p0);
      return `rgb(${c0.map((c, k) => Math.round(c + t * (c1[k] - c))).join(",")})`;
    }
  }
  return "rgb(225,29,72)";
}

export const levelBadge: Record<RiskLevel, string> = {
  LOW: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  HIGH: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  SEVERE: "bg-rose-500/20 text-rose-300 border-rose-500/50",
};

export const pct = (p: number | null | undefined, digits = 0) =>
  p === null || p === undefined ? "–" : p < 0.01 ? "<1%" : p > 0.99 ? ">99%" : `${(100 * p).toFixed(digits)}%`;

export const inHours = (h: number | null | undefined) =>
  h === null || h === undefined ? "–" : h === 0 ? "now" : `in ${h} h`;
