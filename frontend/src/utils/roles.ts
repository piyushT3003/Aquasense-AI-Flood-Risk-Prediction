import type { NavItemKey, UserRole } from "../components/layout/Sidebar";

export const ROLES: { role: UserRole; short: string; description: string }[] = [
  { role: "Disaster Management Officer", short: "DMO", description: "Full command view: forecasts, alerts, simulation, model" },
  { role: "Administrator", short: "Admin", description: "Everything, plus data sources and system settings" },
  { role: "Field Team", short: "Field", description: "Full view for crews on the ground" },
  { role: "Citizen", short: "Citizen", description: "Simple public view: my area, rainfall, advisories" },
];

const CITIZEN_TABS: NavItemKey[] = ["OVERVIEW", "RAINFALL", "SATELLITE", "FLOOD_RISK", "FORECAST", "ALERT_CENTER", "AI_ASSISTANT"];

export const isCitizen = (r: UserRole) => r === "Citizen";
export const canSee = (r: UserRole, tab: NavItemKey) => !isCitizen(r) || CITIZEN_TABS.includes(tab);
export const canControl = (r: UserRole) => !isCitizen(r);
