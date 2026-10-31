import React, { useState } from "react";
import { Play, Pause, RotateCcw, Zap, Volume2, VolumeX, Gauge, CloudRain, Satellite } from "lucide-react";
import { alertSound } from "../../utils/audio";
import type { Threat } from "../../services/api";
import type { UserRole } from "./Sidebar";
import { RoleSwitcher } from "./RoleSwitcher";
import { levelBadge } from "../../utils/risk";

interface TopHeaderProps {
  cityRisk: string;
  activeAlertsCount: number;
  highRiskZonesCount: number;
  simTime: string | null;
  dataMode: string;
  threats: Threat[];
  isSimRunning: boolean;
  isStormActive: boolean;
  speed: number;
  onToggleSim: () => void;
  onResetSim: () => void;
  onTriggerStorm: () => void;
  onSpeed: (v: number) => void;
  onSelectZone: (id: string) => void;
  currentRole: UserRole;
  onChangeRole: (r: UserRole) => void;
  canControl: boolean;
  backendDown: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  cityRisk, activeAlertsCount, highRiskZonesCount, simTime, dataMode, threats, isSimRunning, isStormActive, speed,
  onToggleSim, onResetSim, onTriggerStorm, onSpeed, onSelectZone, currentRole, onChangeRole, canControl, backendDown,
}) => {
  const [muted, setMuted] = useState(alertSound.getMuted());
  const t = simTime ? new Date(simTime) : null;
  const upcoming = threats.filter((x) => x.current_level !== "HIGH" && x.current_level !== "SEVERE");
  const ticker = upcoming.length ? upcoming : threats;
  const isSim = dataMode === "simulator";

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#050b16]/80 backdrop-blur-xl">
      <div className="flex h-[60px] items-center gap-3 whitespace-nowrap px-5 xl:gap-4">
        <RoleSwitcher role={currentRole} onChange={onChangeRole} />
        <div className="h-6 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-slate-400 2xl:inline">City risk</span>
          <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${levelBadge[(cityRisk as keyof typeof levelBadge)] ?? levelBadge.LOW}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />{cityRisk}
          </span>
        </div>
        <Stat label="High risk" value={`${highRiskZonesCount}/18`} tone={highRiskZonesCount ? "text-orange-300" : "text-slate-200"} />
        <Stat label="Alerts" value={String(activeAlertsCount)} tone={activeAlertsCount ? "text-rose-300" : "text-slate-200"} />
        <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 xl:flex"
          title={isSim ? "Simulated city clock: 1 tick = 1 hour" : "Live rainfall from Open-Meteo"}>
          {isSim ? <CloudRain className="h-3.5 w-3.5 text-cyan-300" /> : <Satellite className="h-3.5 w-3.5 text-emerald-300" />}
          <span className="font-mono">{t ? t.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "–"}</span>
          <span className="hidden text-slate-500 2xl:inline">{isSim ? "simulated" : "live data"}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <IconBtn label={muted ? "Unmute alert sound" : "Mute alert sound"} onClick={() => setMuted(alertSound.toggleMute())}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-cyan-300" />}
          </IconBtn>
          {backendDown && <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11.5px] font-semibold text-amber-200">Backend offline</span>}
          {isSim && canControl && !backendDown && <>
            <IconBtn label={isSimRunning ? "Pause the simulation" : "Resume the simulation"} onClick={onToggleSim}>
              {isSimRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-emerald-300" />}
            </IconBtn>
            <button onClick={() => onSpeed(speed >= 4 ? 1 : speed * 2)} title="Simulation speed"
              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2 text-[11px] font-semibold text-slate-300 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
              <Gauge className="h-3.5 w-3.5" />{speed}x
            </button>
            <IconBtn label="Reset the simulation to calm weather" onClick={onResetSim}><RotateCcw className="h-4 w-4" /></IconBtn>
            <button onClick={onTriggerStorm} disabled={isStormActive}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${isStormActive ? "cursor-default border border-rose-400/50 bg-rose-600/30" : "bg-gradient-to-r from-rose-600 to-orange-500 shadow-glow-red hover:brightness-110"}`}>
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span className="hidden 2xl:inline">{isStormActive ? "Storm in progress" : "Simulate incoming storm"}</span>
              <span className="2xl:hidden">{isStormActive ? "Storm on" : "Storm demo"}</span>
            </button>
          </>}
        </div>
      </div>

      {ticker.length > 0 && (
        <div className="flex h-8 items-center gap-3 overflow-hidden border-t border-white/[0.05] bg-gradient-to-r from-amber-500/10 via-transparent to-transparent px-5 text-[11.5px]">
          <span className="flex-shrink-0 font-semibold text-amber-200">{upcoming.length ? "Predicted threats" : "Active threats"}</span>
          <div className="flex min-w-0 gap-2 overflow-x-auto">
            {ticker.slice(0, 6).map((th) => (
              <button key={th.zone_id} onClick={() => onSelectZone(th.zone_id)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-slate-200 hover:border-amber-300/40">
                <span className={`rounded px-1 text-[9.5px] font-bold ${levelBadge[th.predicted_level]}`}>{th.predicted_level}</span>
                {th.zone_name}
                <span className="text-slate-400">
                  {th.current_level === "HIGH" || th.current_level === "SEVERE" ? "now" : th.hours_to_high !== null ? `in ${th.hours_to_high} h` : `peak in ${th.peak_in_h} h`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

const Stat: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div className="hidden items-baseline gap-1.5 whitespace-nowrap lg:flex">
    <span className="text-[11px] text-slate-400">{label}</span>
    <span className={`font-mono text-sm font-bold ${tone}`}>{value}</span>
  </div>
);

const IconBtn: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button onClick={onClick} title={label} aria-label={label}
    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
    {children}
  </button>
);
