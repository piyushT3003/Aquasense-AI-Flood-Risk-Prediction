import React from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Database,
  Globe2,
  Layers,
  MapPin,
  Radio,
  Sliders,
  ShieldAlert,
  Settings,
  Users,
  CheckCircle2,
  ChevronRight,
  Droplets,
  CloudRain,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

export type NavItemKey =
  | "OVERVIEW"
  | "RAINFALL"
  | "LIVE_MONITORING"
  | "FLOOD_RISK"
  | "SATELLITE"
  | "FORECAST"
  | "WHAT_IF"
  | "ALERT_CENTER"
  | "AI_ASSISTANT"
  | "DATA_SOURCES"
  | "REPORTS"
  | "SETTINGS";

export type UserRole = "Administrator" | "Disaster Management Officer" | "Field Team" | "Citizen";

interface SidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  activeAlertCount: number;
  threatCount: number;
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  modelVersion?: string;
  visible: (tab: NavItemKey) => boolean;
}

const GROUPS: { title: string; items: { key: NavItemKey; label: string; icon: any }[] }[] = [
  { title: "Monitor", items: [
    { key: "OVERVIEW", label: "Overview", icon: Globe2 },
    { key: "RAINFALL", label: "Rainfall", icon: CloudRain },
    { key: "SATELLITE", label: "3D Satellite View", icon: Layers },
    { key: "LIVE_MONITORING", label: "Live Zones & Sensors", icon: Radio },
    { key: "FLOOD_RISK", label: "GIS Risk Map", icon: MapPin },
  ]},
  { title: "Predict", items: [
    { key: "FORECAST", label: "48 h Forecast", icon: BarChart3 },
    { key: "WHAT_IF", label: "What-If Simulator", icon: Sliders },
    { key: "REPORTS", label: "Model & Validation", icon: Activity },
  ]},
  { title: "Respond", items: [
    { key: "ALERT_CENTER", label: "Alerts & Threats", icon: ShieldAlert },
    { key: "AI_ASSISTANT", label: "AI Assistant", icon: Bot },
  ]},
  { title: "System", items: [
    { key: "DATA_SOURCES", label: "Data Sources", icon: Database },
    { key: "SETTINGS", label: "Settings", icon: Settings },
  ]},
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab, onSelectTab, activeAlertCount, threatCount, currentRole, collapsed, onToggleCollapsed, modelVersion, visible
}) => (
  <aside className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/[0.07] bg-[#050b16]/90 backdrop-blur-xl transition-[width] duration-300 ${collapsed ? "w-[72px]" : "w-60"}`}>
    <div className={`flex items-center border-b border-white/[0.07] ${collapsed ? "justify-center px-2 py-4" : "gap-3 px-4 py-4"}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-glow-cyan">
        <Droplets className="h-5 w-5 text-white" />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold tracking-wide text-white">AquaSense</div>
          <p className="text-[10.5px] text-slate-400">Bengaluru flood early warning</p>
        </div>
      )}
    </div>

    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main">
      {GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i.key)) })).filter((g) => g.items.length).map((g) => (
        <div key={g.title}>
          {!collapsed && <div className="mb-1.5 px-2 text-[10.5px] font-medium text-slate-500">{g.title}</div>}
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.key;
              const badge = item.key === "ALERT_CENTER" ? activeAlertCount : undefined;
              return (
                <button key={item.key} onClick={() => onSelectTab(item.key)} title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex w-full items-center rounded-lg text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-2.5 py-2"} ${active ? "bg-cyan-400/10 text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-cyan-400" />}
                  <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                  {!collapsed && <span className={`flex-1 text-left ${active ? "font-semibold" : ""}`}>{item.label}</span>}
                  {badge ? (
                    <span className={`rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white ${collapsed ? "absolute right-2 top-1" : ""}`}>{badge}</span>
                  ) : null}
                  {item.key === "OVERVIEW" && threatCount > 0 && !collapsed && (
                    <span className="rounded-full border border-amber-400/40 px-1.5 text-[10px] font-semibold leading-4 text-amber-200">{threatCount} threats</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>

    <div className="space-y-3 border-t border-white/[0.07] p-3">
      {!collapsed && currentRole === "Citizen" && (
        <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-2.5 py-2 text-[11px] leading-snug text-cyan-100">Public view. Officer tools are hidden.</p>
      )}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <span className="flex items-center gap-2 text-[10.5px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{modelVersion ?? "Model loading"}
          </span>
        )}
        <button onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
    </div>
  </aside>
);
