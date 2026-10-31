import React, { useState } from "react";
import { fetchAIStatus } from "../services/api";
import { usePoll } from "../utils/usePoll";

const AIStatusCard: React.FC = () => {
  const [st] = usePoll(fetchAIStatus, 5000);
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className={`h-2 w-2 rounded-full ${st?.configured ? (st.last_error ? "bg-amber-400" : "bg-emerald-400") : "bg-slate-500"}`} />
        Backend LLM: {st?.configured ? `${st.provider} / ${st.model}` : "not configured (template answers)"}
      </div>
      {st?.last_error && <p className="text-amber-200">Last error: {st.last_error}</p>}
      {st?.last_success && <p className="text-emerald-300">Last successful answer at {st.last_success}</p>}
      <p className="text-slate-400">Recommended: put the key in the backend so every user gets it.</p>
      <ol className="list-decimal space-y-1 pl-5 text-slate-300">
        <li>In the <code className="rounded bg-black/40 px-1">backend</code> folder, copy <code className="rounded bg-black/40 px-1">.env.example</code> to <code className="rounded bg-black/40 px-1">.env</code>.</li>
        <li>Paste one key: <code className="rounded bg-black/40 px-1">GEMINI_API_KEY</code>, <code className="rounded bg-black/40 px-1">GROQ_API_KEY</code>, <code className="rounded bg-black/40 px-1">ANTHROPIC_API_KEY</code> or <code className="rounded bg-black/40 px-1">OPENAI_API_KEY</code>.</li>
        <li>Restart with <code className="rounded bg-black/40 px-1">bash start_aquasense.sh</code>. This card turns green when the assistant answers.</li>
      </ol>
    </div>
  );
};
import { SystemHealthItem } from "../services/api";
import { UserRole } from "../components/layout/Sidebar";
import {
  Settings,
  ShieldCheck,
  Server,
  Key,
  Users,
  Bell,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from "lucide-react";

interface SettingsPageProps {
  healthItems: SystemHealthItem[];
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  healthItems,
  currentRole,
  onChangeRole
}) => {
  const [apiKey, setApiKey] = useState<string>(() => { try { return localStorage.getItem("AQUASENSE_GEMINI_API_KEY") ?? ""; } catch { return ""; } });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSaveApiKey = () => {
    try { localStorage.setItem("AQUASENSE_GEMINI_API_KEY", apiKey); } catch { /* storage blocked */ }
    setSaveStatus("API Key configured for current session.");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white tracking-wide">Platform Settings &amp; Health</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            System component diagnostics, role-based visibility control &amp; LLM connectivity
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>System Integrity: ONLINE</span>
        </div>
      </div>

      {/* 1. System Health Diagnostics Grid */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>Real-Time Component Health Diagnostics</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {healthItems.map((item, idx) => (
            <div key={idx} className="glass-card p-4 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{item.component}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                    item.status === "ONLINE"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1">
                <span>Latency: <b className="text-white">{item.latency_ms}ms</b></span>
                <span>Records: <b className="text-white">{item.records_processed.toLocaleString()}</b></span>
              </div>

              <p className="text-[11px] text-zinc-400 leading-snug">{item.details}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Role-Based Context Selection */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Simulated Operational Persona &amp; Access Role</span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            {
              role: "Administrator" as UserRole,
              desc: "Full administrative telemetry, ML feature weight adjustments, system health controls."
            },
            {
              role: "Disaster Management Officer" as UserRole,
              desc: "Citywide flood forecasting, escalation pipelines, What-If evacuation planning."
            },
            {
              role: "Field Team" as UserRole,
              desc: "Active alerts, dewatering pump locations, waterlogged underpasses & road closures."
            },
            {
              role: "Citizen" as UserRole,
              desc: "Plain-language bilingual warnings, safe route advisories, official instructions."
            }
          ].map((item) => (
            <button
              key={item.role}
              onClick={() => onChangeRole(item.role)}
              className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
                currentRole === item.role
                  ? "bg-cyan-500/20 border-cyan-500/60 shadow-glow-cyan-sm"
                  : "bg-white/5 border-white/5 hover:border-white/20 text-zinc-400"
              }`}
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>{item.role}</span>
                {currentRole === item.role && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 3. API & GenAI Configuration */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-cyan-400" />
          <span>AI assistant: language model connection</span>
        </h2>

        <div className="space-y-3 max-w-xl text-xs">
          <p className="text-zinc-400">
            The assistant works without a key: it answers from live model output. With a Google Gemini key, Gemini rewrites
            those answers in natural language (it only sees the same live data). The key stays in this browser and is sent
            only to your own AquaSense backend.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 glass-input px-3.5 py-2.5 rounded-lg text-xs"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#04121f] font-bold text-xs transition-colors"
            >
              Save Key
            </button>
          </div>

          {saveStatus && <p className="text-xs text-emerald-400 font-medium">{saveStatus}</p>}
          <AIStatusCard />
        </div>
      </div>
    </div>
  );
};
