import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, Settings2, HardHat, Users, ChevronDown, Check } from "lucide-react";
import type { UserRole } from "./Sidebar";
import { ROLES } from "../../utils/roles";

const ICON: Record<UserRole, any> = {
  "Disaster Management Officer": ShieldCheck, Administrator: Settings2, "Field Team": HardHat, Citizen: Users,
};
const TONE: Record<UserRole, string> = {
  "Disaster Management Officer": "from-cyan-400 to-blue-600", Administrator: "from-violet-400 to-indigo-600",
  "Field Team": "from-amber-300 to-orange-500", Citizen: "from-emerald-300 to-teal-600",
};

/** Prominent "Viewing as" pill with a dropdown; Citizen gets a restricted, read-only view. */
export const RoleSwitcher: React.FC<{ role: UserRole; onChange: (r: UserRole) => void }> = ({ role, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  const Icon = ICON[role];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] py-1 pl-1 pr-3 text-left transition hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${TONE[role]}`}><Icon className="h-3.5 w-3.5 text-white" /></span>
        <span className="leading-tight">
          <span className="block text-[9.5px] uppercase tracking-wide text-slate-400">Viewing as</span>
          <span className="block whitespace-nowrap text-[12.5px] font-semibold text-white">{role === "Disaster Management Officer" ? "DM Officer" : role}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-11 z-50 w-[300px] rounded-2xl border border-white/10 bg-[#071226]/95 p-1.5 shadow-2xl backdrop-blur-xl">
          {ROLES.map((r) => {
            const I = ICON[r.role];
            return (
              <button key={r.role} role="menuitemradio" aria-checked={r.role === role} onClick={() => { onChange(r.role); setOpen(false); }}
                className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/[0.06] ${r.role === role ? "bg-white/[0.05]" : ""}`}>
                <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${TONE[r.role]}`}><I className="h-3.5 w-3.5 text-white" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white">{r.role}{r.role === role && <Check className="h-3.5 w-3.5 text-cyan-300" />}</span>
                  <span className="block text-[11px] leading-snug text-slate-400">{r.description}</span>
                </span>
              </button>
            );
          })}
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] text-slate-500">Prototype role switch; production would use sign-in.</p>
        </div>
      )}
    </div>
  );
};
