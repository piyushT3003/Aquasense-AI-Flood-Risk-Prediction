import React from "react";
import { CloudRain, ArrowRight } from "lucide-react";
import { fetchRainfallTimeline } from "../services/api";
import { usePoll } from "../utils/usePoll";
import { RainCanvas } from "./effects/RainCanvas";

/** Small live rainfall card for the home page; opens the Rainfall tab. */
export const RainfallWidget: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [d] = usePoll(fetchRainfallTimeline, 3000);
  const c = d?.city;
  const bars: number[] = d ? [...d.past_48h.slice(-24).map((x: any) => x.city_mm), ...d.next_48h.slice(0, 12).map((x: any) => x.city_mm)] : [];
  const max = Math.max(2, ...bars);
  return (
    <button onClick={onOpen} className="glass-panel group relative w-full overflow-hidden rounded-2xl p-4 text-left transition hover:border-cyan-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
      <RainCanvas intensity={Math.min(1, 0.05 + (c?.now_mm_h ?? 0) / 15)} maxDrops={90} className="absolute inset-0 h-full w-full opacity-70" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><CloudRain className="h-4 w-4 text-sky-300" />Rainfall now</span>
          <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-extrabold text-sky-200 tabular">{c ? c.now_mm_h.toFixed(1) : "–"}</span>
          <span className="text-xs text-slate-400">mm/h city avg · {c?.class_now ?? "–"}</span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
          <div><div className="text-slate-500">Today</div><div className="font-mono text-slate-100">{c?.today_mm ?? "–"} mm</div></div>
          <div><div className="text-slate-500">Last 24 h</div><div className="font-mono text-slate-100">{c?.last_24h_mm ?? "–"} mm</div></div>
          <div><div className="text-slate-500">Next 6 h</div><div className="font-mono text-amber-200">{c?.next_6h_mm ?? "–"} mm</div></div>
        </div>
        <div className="mt-3 flex h-10 items-end gap-[2px]" aria-hidden="true">
          {bars.map((v, i) => (
            <div key={i} className={`flex-1 rounded-t-sm transition-all duration-700 ${i >= 24 ? "bg-amber-300/50" : "bg-sky-400/70"}`}
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>−24 h</span><span>now</span><span>+12 h forecast</span></div>
      </div>
    </button>
  );
};
