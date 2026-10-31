/**
 * Live, animated 2D GIS map (Leaflet).
 * Layers are created once and updated in place every poll, so animations never restart:
 *  - zones fill by live risk score; HIGH/SEVERE zones pulse
 *  - rainfall ripples sized by each zone's current mm/h
 *  - storm-water drains with animated flow (faster/orange when the basin is stressed)
 *  - road corridors coloured by the live risk of the zones they cross
 *  - zones where flooding is reported right now
 *  - rain streak overlay scaled to city rainfall
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Zone } from "../../services/api";
import { Layers, Eye, EyeOff, Radio } from "lucide-react";
import { scoreColor, RISK_COLORS } from "../../utils/risk";
import { RainCanvas } from "../effects/RainCanvas";

interface Props {
  zones: Zone[];
  selectedZone: Zone | null;
  onSelectZone: (zone: Zone) => void;
  lakes: any[];
  drains: any[];
  infrastructure: any[];
}

type LayerKey = "risk" | "rain" | "drains" | "roads" | "flooding" | "lakes" | "infrastructure" | "labels";
const LAYER_NAMES: [LayerKey, string][] = [
  ["risk", "Flood risk"], ["rain", "Rainfall now"], ["drains", "Drain flow"], ["roads", "Road risk"],
  ["flooding", "Flooding now"], ["lakes", "Lakes"], ["infrastructure", "Infrastructure"], ["labels", "Labels"],
];
// Corridors and the zones they pass through (risk = worst zone)
const ROADS = [
  { name: "Outer Ring Road", zones: ["zone-2", "zone-4", "zone-1", "zone-6", "zone-11", "zone-9"],
    path: [[12.917, 77.623], [12.912, 77.645], [12.926, 77.684], [12.956, 77.701], [12.991, 77.697]] },
  { name: "Hosur Road", zones: ["zone-2", "zone-13"], path: [[12.917, 77.623], [12.898, 77.629], [12.880, 77.635]] },
  { name: "Sarjapur Road", zones: ["zone-5", "zone-6"], path: [[12.922, 77.672], [12.916, 77.700], [12.908, 77.725]] },
  { name: "Mysore Road", zones: ["zone-15", "zone-16"], path: [[12.970, 77.570], [12.955, 77.540], [12.940, 77.520]] },
  { name: "Bellary Road (Hebbal)", zones: ["zone-8", "zone-7"], path: [[13.000, 77.590], [13.035, 77.592], [13.045, 77.620]] },
];
const LEVEL_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, SEVERE: 3 };

export const BengaluruGISMap: React.FC<Props> = ({ zones, selectedZone, onSelectZone, lakes, drains, infrastructure }) => {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const groups = useRef<Record<LayerKey, L.LayerGroup> | null>(null);
  const zoneLayers = useRef<Record<string, { poly: L.Polygon; rain: L.CircleMarker; rain2: L.CircleMarker; flood: L.Polygon; label: L.Marker }>>({});
  const roadLayers = useRef<{ line: L.Polyline; glow: L.Polyline; zones: string[]; name: string }[]>([]);
  const drainLayers = useRef<{ line: L.Polyline; base: L.Polyline; name: string; status: string }[]>([]);
  const onSel = useRef(onSelectZone); onSel.current = onSelectZone;
  const zonesRef = useRef(zones); zonesRef.current = zones;
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    risk: true, rain: true, drains: true, roads: true, flooding: true, lakes: true, infrastructure: true, labels: true,
  });

  // ---- create the map once
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [12.965, 77.64], zoom: 12, zoomControl: false, attributionControl: false, preferCanvas: false });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    const g = Object.fromEntries(LAYER_NAMES.map(([k]) => [k, L.layerGroup().addTo(m)])) as Record<LayerKey, L.LayerGroup>;
    groups.current = g;
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, opacity: 0.8 })
      .addTo(g.labels);
    map.current = m;
    return () => { m.remove(); map.current = null; zoneLayers.current = {}; roadLayers.current = []; drainLayers.current = []; };
  }, []);

  // ---- static GIS: lakes, drains, infrastructure, roads
  useEffect(() => {
    const g = groups.current; if (!g) return;
    g.lakes.clearLayers(); g.infrastructure.clearLayers(); g.drains.clearLayers(); g.roads.clearLayers();
    lakes.forEach((lake) => {
      L.polygon(lake.coords.map(([lng, lat]: number[]) => [lat, lng]), { color: "#22d3ee", weight: 1.2, fillColor: "#0e7490", fillOpacity: 0.45, className: "aq-lake" })
        .bindTooltip(`<b>${lake.name}</b><br/>${lake.current_full_pct}% full`, { sticky: true }).addTo(g.lakes);
    });
    drainLayers.current = drains.map((d) => {
      const pts = d.path.map(([lng, lat]: number[]) => [lat, lng]);
      const base = L.polyline(pts, { color: "#0c4a6e", weight: 7, opacity: 0.8 }).addTo(g.drains);
      const line = L.polyline(pts, { color: "#22d3ee", weight: 3, opacity: 0.95, className: "aq-flow" })
        .bindTooltip(`<b>${d.name}</b>`, { sticky: true }).addTo(g.drains);
      return { line, base, name: d.name, status: d.status };
    });
    roadLayers.current = ROADS.map((r) => {
      const glow = L.polyline(r.path as any, { color: "#34d399", weight: 10, opacity: 0.15 }).addTo(g.roads);
      const line = L.polyline(r.path as any, { color: "#34d399", weight: 4, opacity: 0.9, lineCap: "round" }).addTo(g.roads);
      return { line, glow, zones: r.zones, name: r.name };
    });
    const icon = (t: string) => (t === "Hospital" ? "H" : t === "Underpass" ? "U" : t.includes("Metro") ? "M" : "R");
    infrastructure.forEach((i) => {
      L.marker([i.coords[1], i.coords[0]], { icon: L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11],
        html: `<div class="aq-infra aq-infra-${icon(i.type)}">${icon(i.type)}</div>` }) })
        .bindTooltip(`<b>${i.name}</b><br/>${i.type} · ${i.status}`).addTo(g.infrastructure);
    });
  }, [lakes, drains, infrastructure]);

  // ---- zones: create once per zone, then update styles in place
  useEffect(() => {
    const g = groups.current; if (!g || !zones.length) return;
    zones.forEach((z) => {
      const p = z.current_prediction;
      const score = p?.risk_score ?? 0, level = p?.risk_level ?? "LOW";
      const color = scoreColor(score);
      const ring = z.boundary_polygon.map(([lng, lat]) => [lat, lng] as [number, number]);
      let L1 = zoneLayers.current[z.id];
      if (!L1) {
        const poly = L.polygon(ring, { weight: 1.5 }).addTo(g.risk);
        poly.on("click", () => { const zz = zonesRef.current.find((q) => q.id === z.id); if (zz) onSel.current(zz); });
        const rain = L.circleMarker([z.center.lat, z.center.lng], { radius: 0, weight: 0, fillColor: "#38bdf8", fillOpacity: 0.35, className: "aq-rain-core" }).addTo(g.rain);
        const rain2 = L.circleMarker([z.center.lat, z.center.lng], { radius: 0, color: "#7dd3fc", weight: 2, fill: false, className: "aq-rain-ring" }).addTo(g.rain);
        const flood = L.polygon(ring, { color: "#38bdf8", weight: 2, fillColor: "#0284c7", fillOpacity: 0.5, dashArray: "4 4", className: "aq-flood" });
        const label = L.marker([z.center.lat, z.center.lng], { icon: L.divIcon({ className: "", html: "" }), interactive: true }).addTo(g.labels);
        label.on("click", () => { const zz = zonesRef.current.find((q) => q.id === z.id); if (zz) onSel.current(zz); });
        L1 = zoneLayers.current[z.id] = { poly, rain, rain2, flood, label };
      }
      const sel = selectedZone?.id === z.id;
      const hot = LEVEL_RANK[level] >= 2;
      L1.poly.setStyle({ color: sel ? "#ffffff" : color, weight: sel ? 3 : 1.5, fillColor: color, fillOpacity: 0.18 + score * 0.4, dashArray: sel ? undefined : "4 3" });
      const path = (L1.poly as any)._path as SVGPathElement | undefined;
      if (path) path.setAttribute("class", `leaflet-interactive aq-zone ${hot ? (level === "SEVERE" ? "aq-zone-severe" : "aq-zone-high") : ""}`);
      L1.poly.bindTooltip(
        `<div class="aq-tt"><b>${z.name}</b> <span style="color:${color}">${level}</span><br/>` +
        `Risk ${Math.round(score * 100)}/100 · ${p ? (p.flood_probability < 0.01 ? "<1" : Math.round(p.flood_probability * 100)) : 0}% chance of flooding in 6 h<br/>` +
        `Rain now ${p?.rainfall_1h_mm ?? 0} mm/h · 24 h ${p?.rainfall_24h_mm ?? 0} mm<br/>Drain ${p?.water_level_m ?? 0} m · next 6 h ${p?.forecast_6h_mm ?? 0} mm</div>`,
        { sticky: true });
      const rainNow = p?.rainfall_1h_mm ?? 0;
      L1.rain.setRadius(rainNow > 0.2 ? 6 + Math.min(30, rainNow * 0.9) : 0);
      L1.rain2.setRadius(rainNow > 0.2 ? 8 + Math.min(34, rainNow * 1.1) : 0);
      if (p?.observed_flooding) { if (!g.flooding.hasLayer(L1.flood)) L1.flood.addTo(g.flooding); }
      else if (g.flooding.hasLayer(L1.flood)) g.flooding.removeLayer(L1.flood);
      const showLabel = hot || sel || rainNow >= 5;
      L1.label.setIcon(L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0],
        html: showLabel ? `<div class="aq-gis-label" style="border-color:${color}88">${z.name.split(" ").slice(0, 2).join(" ")} <b style="color:${color}">${Math.round(score * 100)}</b>${rainNow >= 0.2 ? ` <span class="aq-gis-rain">${rainNow} mm/h</span>` : ""}</div>` : "" }));
    });
    // roads coloured by the worst zone they cross
    const byId = Object.fromEntries(zones.map((z) => [z.id, z.current_prediction]));
    roadLayers.current.forEach((r) => {
      const worst = Math.max(0, ...r.zones.map((id) => byId[id]?.risk_score ?? 0));
      const c = scoreColor(worst);
      r.line.setStyle({ color: c }); r.glow.setStyle({ color: c, opacity: 0.12 + worst * 0.25 });
      r.line.bindTooltip(`<b>${r.name}</b><br/>Risk along the corridor: ${Math.round(worst * 100)}/100`, { sticky: true });
    });
    // drains: flow speeds up and turns orange as drain levels rise
    const maxLevel = Math.max(0, ...zones.map((z) => z.current_prediction?.water_level_m ?? 0));
    const stress = Math.min(1, Math.max(0, (maxLevel - 0.5) / 3));
    drainLayers.current.forEach((d) => {
      d.line.setStyle({ color: stress > 0.6 ? "#fb923c" : stress > 0.3 ? "#fbbf24" : "#22d3ee" });
      const path = (d.line as any)._path as SVGPathElement | undefined;
      if (path) path.style.animationDuration = `${(1.6 - stress * 1.2).toFixed(2)}s`;
      d.line.bindTooltip(`<b>${d.name}</b><br/>Highest drain level in the city: ${maxLevel.toFixed(2)} m`, { sticky: true });
    });
  }, [zones, selectedZone]);

  // ---- layer toggles
  useEffect(() => {
    const m = map.current, g = groups.current; if (!m || !g) return;
    (Object.keys(layers) as LayerKey[]).forEach((k) => {
      if (layers[k] && !m.hasLayer(g[k])) g[k].addTo(m);
      if (!layers[k] && m.hasLayer(g[k])) m.removeLayer(g[k]);
    });
  }, [layers]);

  const cityRain = useMemo(() => {
    const v = zones.map((z) => z.current_prediction?.rainfall_1h_mm ?? 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }, [zones]);
  const updated = zones[0]?.current_prediction?.last_updated;
  const counts = zones.reduce((acc, z) => { const l = z.current_prediction?.risk_level ?? "LOW"; acc[l] = (acc[l] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="relative h-full min-h-[620px] w-full overflow-hidden rounded-2xl border border-white/10">
      <div ref={el} className="h-full min-h-[620px] w-full" />
      {layers.rain && <RainCanvas intensity={Math.min(1, cityRain / 25)} className="absolute inset-0 z-[400] h-full w-full" />}

      <div className="absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-xl border border-white/10 bg-[#040914]/85 px-3 py-1.5 text-[11.5px] text-slate-200 backdrop-blur">
        <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-300" /> Live · {updated ?? "–"}
        <span className="text-slate-500">|</span> city rain <b className="font-mono text-cyan-200">{cityRain.toFixed(1)} mm/h</b>
      </div>

      <div className="absolute right-4 top-4 z-[500] w-[230px] rounded-2xl border border-white/10 bg-[#040914]/85 p-3 backdrop-blur">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white"><Layers className="h-3.5 w-3.5 text-cyan-300" />Layers</div>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYER_NAMES.map(([k, name]) => (
            <button key={k} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} aria-pressed={layers[k]}
              className={`flex items-center justify-between rounded-md border px-2 py-1 text-[10.5px] transition ${layers[k] ? "border-cyan-400/40 bg-cyan-400/10 text-white" : "border-white/10 text-slate-500"}`}>
              {name}{layers[k] ? <Eye className="h-3 w-3 text-cyan-300" /> : <EyeOff className="h-3 w-3" />}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-white/10 bg-[#040914]/85 p-3 text-[11px] text-slate-300 backdrop-blur">
        <div className="mb-1.5 font-semibold text-white">Risk score</div>
        <div className="h-1.5 w-52 rounded-full" style={{ background: "linear-gradient(90deg,#34d399,#fbbf24 35%,#fb923c 65%,#f43f5e 85%,#e11d48)" }} />
        <div className="mt-1.5 flex gap-3">
          {(["LOW", "MEDIUM", "HIGH", "SEVERE"] as const).map((l) => (
            <span key={l} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[l] }} />{l[0] + l.slice(1).toLowerCase()} <b className="font-mono text-white">{counts[l] ?? 0}</b></span>
          ))}
        </div>
        <div className="mt-1.5 flex gap-3 text-slate-400">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full border border-sky-300" />rain ripple = mm/h</span>
          <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-cyan-300" />drain flow</span>
        </div>
      </div>
    </div>
  );
};
