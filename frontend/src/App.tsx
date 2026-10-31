import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, X, WifiOff } from "lucide-react";
import { Sidebar } from "./components/layout/Sidebar";
import type { NavItemKey, UserRole } from "./components/layout/Sidebar";
import { TopHeader } from "./components/layout/TopHeader";
import { OverviewPage } from "./pages/OverviewPage";
import { LiveMonitoringPage } from "./pages/LiveMonitoringPage";
import { FloodRiskPage } from "./pages/FloodRiskPage";
import { SatellitePage } from "./pages/SatellitePage";
import { ForecastPage } from "./pages/ForecastPage";
import { WhatIfPage } from "./pages/WhatIfPage";
import { AlertCenterPage } from "./pages/AlertCenterPage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { RainfallPage } from "./pages/RainfallPage";
import { CitizenHome } from "./pages/CitizenHome";
import { RainCanvas } from "./components/effects/RainCanvas";
import { canSee, canControl, isCitizen } from "./utils/roles";
import {
  fetchZones, fetchCurrentRisk, fetchAlerts, fetchSensors, fetchInfrastructure, fetchLakes, fetchDrains,
  fetchSystemHealth, controlSimulation, fetchSimulationState, fetchThreats, fetchVerification, fetchModel, setApiRole,
} from "./services/api";
import type { AlertItem } from "./services/api";
import { alertSound } from "./utils/audio";
import { usePoll, useLocalFlag } from "./utils/usePoll";

export function App() {
  const [tab, setTab] = useState<NavItemKey>("OVERVIEW");
  const [role, setRoleState] = useState<UserRole>(() => {
    try { return (localStorage.getItem("aq.role") as UserRole) || "Disaster Management Officer"; } catch { return "Disaster Management Officer"; }
  });
  setApiRole(role);
  const setRole = (r: UserRole) => {
    setRoleState(r); setApiRole(r);
    try { localStorage.setItem("aq.role", r); } catch { /* ignore */ }
    if (!canSee(r, tab)) setTab("OVERVIEW");
  };
  const [collapsed, setCollapsed] = useLocalFlag("aq.sidebar.collapsed", window.innerWidth < 1280);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [toast, setToast] = useState<AlertItem | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const lastChime = useRef(0);

  const [zonesRes, refreshZones, zonesErr] = usePoll(fetchZones, 3000);
  const [risk, refreshRisk] = usePoll(fetchCurrentRisk, 3000);
  const [alertsRes, refreshAlerts] = usePoll(fetchAlerts, 3000);
  const [sim, refreshSim] = usePoll(fetchSimulationState, 3000);
  const [threatsRes, refreshThreats] = usePoll(fetchThreats, 3000);
  const [verification] = usePoll(fetchVerification, 6000);
  const [sensorsRes] = usePoll(fetchSensors, 6000);
  const [health] = usePoll(fetchSystemHealth, 15000);
  const [model] = usePoll(fetchModel, 600000);
  const [lakes] = usePoll(fetchLakes, 600000);
  const [drains] = usePoll(fetchDrains, 600000);
  const [infra] = usePoll(fetchInfrastructure, 600000);

  const zones = zonesRes ?? [];
  const alerts = alertsRes?.alerts ?? [];
  const threats = threatsRes?.threats ?? [];
  const selectedZone = useMemo(() => zones.find((z) => z.id === selectedZoneId) ?? null, [zones, selectedZoneId]);

  // Toast + chime for every NEW high/severe alert (tracked by id, not by count)
  useEffect(() => {
    if (!alertsRes) return;
    if (seen.current === null) { seen.current = new Set(alerts.map((a) => a.id)); return; }
    const fresh = alerts.filter((a) => !seen.current!.has(a.id));
    fresh.forEach((a) => seen.current!.add(a.id));
    const important = fresh.find((a) => a.severity === "SEVERE") ?? fresh.find((a) => a.severity === "HIGH");
    if (important) {
      setToast(important);
      if (Date.now() - lastChime.current > 15000) { alertSound.playCriticalAlert(); lastChime.current = Date.now(); }
    }
  }, [alertsRes]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = () => { refreshZones(); refreshRisk(); refreshAlerts(); refreshSim(); refreshThreats(); };
  const act = async (action: "start" | "pause" | "reset" | "storm_mode" | "speed", value?: number) => {
    await controlSimulation(action, value);
    if (action === "reset") { seen.current = null; setToast(null); }
    refreshAll();
  };
  const openZone = (id: string | null, toTab: NavItemKey = "SATELLITE") => { setSelectedZoneId(id); if (id) setTab(toTab); };

  useEffect(() => {                      // toasts dismiss themselves after 12 s
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 12000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeAlertCount = alerts.filter((a) => a.status === "ACTIVE").length;
  const backendDown = !!zonesErr;
  const cityRain = zones.length ? zones.reduce((a, z) => a + (z.current_prediction?.rainfall_1h_mm ?? 0), 0) / zones.length : 0;
  const control = canControl(role);
  const gis = { lakes: lakes ?? [], drains: drains ?? [], infrastructure: infra ?? [] };

  return (
    <div className="min-h-screen text-white">
      <div className="aq-aurora" aria-hidden="true" />
      <RainCanvas intensity={Math.min(0.9, 0.07 + cityRain / 20)} maxDrops={180} className="fixed inset-0 -z-[1] h-full w-full opacity-60" />
      <Sidebar currentTab={tab} onSelectTab={setTab} activeAlertCount={activeAlertCount} threatCount={threats.length}
        currentRole={role} onChangeRole={setRole} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)}
        modelVersion={backendDown ? "Backend offline" : model?.version} visible={(t) => canSee(role, t)} />

      <div className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ${collapsed ? "pl-[72px]" : "pl-60"}`}>
        <TopHeader cityRisk={risk?.citywide_risk ?? "LOW"} activeAlertsCount={activeAlertCount}
          highRiskZonesCount={risk?.high_risk_zones_count ?? 0} simTime={sim?.sim_time ?? null} dataMode={sim?.data_mode ?? "simulator"}
          threats={threats} isSimRunning={sim?.is_running ?? true} isStormActive={sim?.storm_scenario_active ?? false}
          speed={sim?.speed ?? 1} onToggleSim={() => act(sim?.is_running ? "pause" : "start")} onResetSim={() => act("reset")}
          onTriggerStorm={() => act("storm_mode")} onSpeed={(v) => act("speed", v)} onSelectZone={(id) => openZone(id)} currentRole={role}
          onChangeRole={setRole} canControl={control} backendDown={backendDown} />

        {backendDown && (
          <div className="mx-6 mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-5 text-sm text-amber-50">
            <div className="flex items-center gap-2 text-base font-semibold"><WifiOff className="h-5 w-5" />The AquaSense backend isn't running</div>
            <p className="mt-1 text-amber-100/80">Maps and pages need the Python server for live data. This page reconnects by itself as soon as it starts.</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-amber-50/90">
              <li>Close any old AquaSense Terminal windows.</li>
              <li>Open Terminal and run: <code className="rounded bg-black/40 px-1.5 py-0.5">cd ~/Downloads/AquaSense &amp;&amp; bash start_aquasense.sh</code></li>
              <li>Wait for <b>"Backend running"</b> (the first start can take 1–2 minutes).</li>
              <li>If it says the backend did not start, send the lines it prints (also saved in <code className="rounded bg-black/40 px-1">backend.log</code>).</li>
            </ol>
          </div>
        )}

        <main className="mx-auto w-full min-w-0 max-w-[1500px] flex-1 p-6">
          {tab === "OVERVIEW" && isCitizen(role) && <CitizenHome zones={zones} alerts={alerts} onNavigateTab={setTab} onOpenZone={(id) => openZone(id)} />}
          {tab === "RAINFALL" && <RainfallPage onSelectZone={(id) => openZone(id)} />}
          {tab === "OVERVIEW" && !isCitizen(role) && <OverviewPage zones={zones} threats={threats} verification={verification} cityRisk={risk?.citywide_risk ?? "LOW"}
            activeAlerts={alerts.filter((a) => a.status === "ACTIVE")} isStormActive={sim?.storm_scenario_active ?? false}
            onNavigateTab={setTab} onSelectZone={(id) => openZone(id)} onTriggerStorm={() => act("storm_mode")} {...gis} />}
          {tab === "SATELLITE" && <SatellitePage zones={zones} threats={threats} selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId} {...gis} />}
          {tab === "LIVE_MONITORING" && <LiveMonitoringPage zones={zones} sensors={sensorsRes?.sensors ?? []}
            onSelectZone={(z) => openZone(z.id)} onNavigateTab={setTab} />}
          {tab === "FLOOD_RISK" && <FloodRiskPage zones={zones} selectedZone={selectedZone} onSelectZone={(z) => setSelectedZoneId(z.id)}
            onCloseDrawer={() => setSelectedZoneId(null)} {...gis} />}
          {tab === "FORECAST" && <ForecastPage zones={zones} onSelectZone={(id) => openZone(id)} />}
          {tab === "WHAT_IF" && <WhatIfPage zones={zones} {...gis} />}
          {tab === "ALERT_CENTER" && <AlertCenterPage alerts={alerts} threats={threats} verification={verification} zones={zones} citizen={isCitizen(role)}
            onRefreshAlerts={refreshAlerts} onSelectZone={(id) => openZone(id)} />}
          {tab === "AI_ASSISTANT" && <AIAssistantPage currentRole={role} />}
          {tab === "DATA_SOURCES" && <DataSourcesPage sensors={sensorsRes?.sensors ?? []} onModeChanged={refreshAll} />}
          {tab === "REPORTS" && <ReportsPage model={model} verification={verification} />}
          {tab === "SETTINGS" && <SettingsPage healthItems={health?.components ?? []} currentRole={role} onChangeRole={setRole} />}
        </main>
      </div>

      {toast && (
        <div role="alert" className="fixed bottom-6 right-6 z-50 w-full max-w-md rounded-2xl border border-rose-400/50 bg-[#1a0710]/95 p-4 shadow-glow-red backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-600">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white">
                {toast.trigger_type === "FORECAST_THREAT" ? "Early warning" : toast.trigger_type === "OBSERVED_FLOODING" ? "Flooding reported" : "Flood alert"}: {toast.zone_name}
                <span className="rounded bg-rose-500 px-1.5 text-[10px]">{toast.severity}</span>
                <span className="font-normal text-rose-200">{toast.expected_window}</span>
              </div>
              <p className="text-xs text-slate-200">{toast.citizen_message_en}</p>
              <p className="text-[11px] text-slate-400">{toast.citizen_message_kn}</p>
              <button onClick={() => { setTab("ALERT_CENTER"); setToast(null); }} className="pt-1 text-[11px] font-semibold text-cyan-300 hover:underline">Open alert center</button>
            </div>
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
