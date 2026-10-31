/**
 * 3D satellite flood-risk map (MapLibre GL, no API key needed).
 *  - Esri World Imagery draped over AWS Terrain Tiles (Terrarium DEM), 3D terrain
 *  - Each zone extruded as a 3D column: height + colour = live (or scenario) risk score
 *  - Pulsing markers on HIGH/SEVERE zones, lakes, storm-water drains, critical infrastructure
 * Works offline too: without tiles the dark base still shows the 3D risk columns.
 */
import React, { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Zone } from "../../services/api";
import { scoreColor, RISK_COLORS, pct } from "../../utils/risk";

export interface MapLayers {
  risk: boolean;
  lakes: boolean;
  drains: boolean;
  infrastructure: boolean;
  labels: boolean;
}

interface Props {
  zones: Zone[];
  overrideScores?: Record<string, number>;      // e.g. what-if scenario
  overrideLevels?: Record<string, string>;
  selectedZoneId?: string | null;
  onSelectZone?: (id: string) => void;
  lakes?: any[];
  drains?: any[];
  infrastructure?: any[];
  layers?: MapLayers;
  autoRotate?: boolean;
  className?: string;
  initialPitch?: number;
}

const DEFAULT_LAYERS: MapLayers = { risk: true, lakes: true, drains: true, infrastructure: true, labels: true };
const COLOR_EXPR: any = ["interpolate", ["linear"], ["get", "score"], 0, "#34d399", 0.35, "#fbbf24", 0.65, "#fb923c", 0.85, "#f43f5e", 1, "#e11d48"];
const EXTRUDE_M = 1600;

const STYLE: any = {
  version: 8,
  sources: {
    imagery: {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    labels: {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
    },
    dem: {
      type: "raster-dem", tileSize: 256, maxzoom: 14, encoding: "terrarium",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      attribution: "Terrain: Mapzen / AWS Terrain Tiles",
    },
    demShade: {
      type: "raster-dem", tileSize: 256, maxzoom: 14, encoding: "terrarium",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#06101f" } },
    { id: "imagery", type: "raster", source: "imagery",
      paint: { "raster-saturation": -0.35, "raster-brightness-max": 0.72, "raster-contrast": 0.12 } },
    { id: "hillshade", type: "hillshade", source: "demShade",
      paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#020617", "hillshade-highlight-color": "#38bdf8" } },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.75 } },
  ],
};
const TERRAIN = { source: "dem", exaggeration: 2.2 };

function sparkSVG(values: number[], w = 180, h = 36) {
  if (!values?.length) return "";
  const pts = values.slice(0, 25).map((v, i, a) => `${(i / (a.length - 1)) * w},${h - v * h}`).join(" ");
  const band = (y: number, c: string) => `<line x1="0" x2="${w}" y1="${h - y * h}" y2="${h - y * h}" stroke="${c}" stroke-dasharray="2 3" stroke-width="1" opacity=".6"/>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${band(0.65, "#fb923c")}${band(0.85, "#f43f5e")}
    <polyline points="${pts}" fill="none" stroke="#22d3ee" stroke-width="2"/></svg>`;
}

export const SatelliteMap3D: React.FC<Props> = ({
  zones, overrideScores, overrideLevels, selectedZoneId, onSelectZone, lakes = [], drains = [], infrastructure = [],
  layers = DEFAULT_LAYERS, autoRotate = false, className = "h-[560px]", initialPitch = 58,
}) => {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const shown = useRef<Record<string, number>>({});
  const popup = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const onSelectRef = useRef(onSelectZone);
  onSelectRef.current = onSelectZone;

  // ---- create map once
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current, style: STYLE, center: [77.645, 12.955], zoom: 10.9,
      pitch: initialPitch, bearing: -18, maxPitch: 75, attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    // Terrain is only switched on once elevation tiles actually arrive; if they can't be fetched
    // (offline, blocked network) the map stays flat and still draws the 3D risk columns.
    let errors = 0;
    let terrainOn = false;
    map.on("error", (e: any) => {
      if (!e?.sourceId && !e?.tile) { console.error("[AquaSense map]", e?.error?.message ?? e); return; }
      {
        errors += 1;
        if (errors > 4) setTilesFailed(true);
        if (e.sourceId === "dem" && terrainOn) { map.setTerrain(null); terrainOn = false; }
      }
    });
    map.on("sourcedata", (e: any) => {
      if (!terrainOn && e.sourceId === "dem" && e.tile && e.isSourceLoaded !== undefined && e.tile.state === "loaded") {
        map.setTerrain(TERRAIN as any); terrainOn = true;
      }
    });
    let setupDone = false;
    const setup = () => {
      // isStyleLoaded() also waits for every tile source, which never happens offline,
      // so only require the style document itself to be parsed.
      if (setupDone || !(map as any).style?._loaded) return;
      setupDone = true;
      map.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("lakes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("drains", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("infra", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "lakes-fill", type: "fill", source: "lakes", paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.45 } });
      map.addLayer({ id: "lakes-line", type: "line", source: "lakes", paint: { "line-color": "#7dd3fc", "line-width": 1.2 } });
      map.addLayer({ id: "drains", type: "line", source: "drains",
        paint: { "line-color": "#22d3ee", "line-width": 3, "line-opacity": 0.85, "line-dasharray": [2, 1.5] } });
      map.addLayer({ id: "zones-floor", type: "fill", source: "zones", paint: { "fill-color": COLOR_EXPR, "fill-opacity": 0.25 } });
      map.addLayer({ id: "zones-3d", type: "fill-extrusion", source: "zones", paint: {
        "fill-extrusion-color": COLOR_EXPR, "fill-extrusion-opacity": 0.78,
        "fill-extrusion-height": ["+", 40, ["*", ["get", "score"], EXTRUDE_M]], "fill-extrusion-base": 0,
        "fill-extrusion-vertical-gradient": true } });
      map.addLayer({ id: "zones-line", type: "line", source: "zones", paint: {
        "line-color": ["case", ["get", "selected"], "#ffffff", "#e0f2fe"], "line-width": ["case", ["get", "selected"], 3, 1],
        "line-opacity": 0.8 } });
      map.addLayer({ id: "infra", type: "circle", source: "infra", paint: {
        "circle-radius": 5, "circle-color": "#e2e8f0", "circle-stroke-color": "#0f172a", "circle-stroke-width": 2 } });
      const click = (e: any) => { const id = e.features?.[0]?.properties?.id; if (id) onSelectRef.current?.(id); };
      map.on("click", "zones-3d", click);
      map.on("click", "zones-floor", click);
      for (const l of ["zones-3d", "zones-floor"]) {
        map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
      }
      map.on("click", "infra", (e: any) => {
        const p = e.features?.[0]?.properties; if (!p) return;
        new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat)
          .setHTML(`<div class="text-xs"><b>${p.name}</b><br/>${p.type}<br/><span style="color:#fbbf24">${p.status}</span></div>`).addTo(map);
      });
      setReady(true);
    };
    // Set up on style load (does not wait for imagery tiles, so it also works offline)
    const safeSetup = () => { try { setup(); } catch (err) { console.error("[AquaSense map] setup failed:", err); } };
    map.on("style.load", safeSetup);
    map.on("load", safeSetup);
    map.on("idle", safeSetup);
    const retry = window.setInterval(() => { if (setupDone) window.clearInterval(retry); else safeSetup(); }, 300);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    return () => { window.clearInterval(retry); ro.disconnect(); Object.values(markers.current).forEach((m) => m.remove()); markers.current = {}; map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- static GIS layers
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    (map.getSource("lakes") as any)?.setData({ type: "FeatureCollection", features: lakes.map((l) => ({
      type: "Feature", properties: { name: l.name }, geometry: { type: "Polygon", coordinates: [l.coords] } })) });
    (map.getSource("drains") as any)?.setData({ type: "FeatureCollection", features: drains.map((d) => ({
      type: "Feature", properties: { name: d.name }, geometry: { type: "LineString", coordinates: d.path } })) });
    (map.getSource("infra") as any)?.setData({ type: "FeatureCollection", features: infrastructure.map((i) => ({
      type: "Feature", properties: { name: i.name, type: i.type, status: i.status }, geometry: { type: "Point", coordinates: i.coords } })) });
  }, [ready, lakes, drains, infrastructure]);

  // ---- layer visibility
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    const set = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", vis(on));
    ["zones-3d", "zones-floor", "zones-line"].forEach((id) => set(id, layers.risk));
    ["lakes-fill", "lakes-line"].forEach((id) => set(id, layers.lakes));
    set("drains", layers.drains); set("infra", layers.infrastructure); set("labels", layers.labels);
    Object.values(markers.current).forEach((m) => (m.getElement().style.display = layers.risk ? "" : "none"));
  }, [ready, layers]);

  // ---- risk columns: animate scores, update pulsing markers
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !zones.length) return;
    const target: Record<string, number> = {};
    zones.forEach((z) => { target[z.id] = overrideScores?.[z.id] ?? z.current_prediction?.risk_score ?? 0; });
    const from = { ...shown.current };
    const t0 = performance.now(); let raf = 0;
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3);
      const feats = zones.map((z) => {
        const a = from[z.id] ?? 0, s = a + (target[z.id] - a) * e;
        shown.current[z.id] = s;
        return { type: "Feature", properties: { id: z.id, name: z.name, score: s, selected: z.id === selectedZoneId },
          geometry: { type: "Polygon", coordinates: [z.boundary_polygon] } };
      });
      (map.getSource("zones") as any)?.setData({ type: "FeatureCollection", features: feats });
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    zones.forEach((z) => {
      const s = target[z.id];
      const level = (overrideLevels?.[z.id] ?? z.current_prediction?.risk_level ?? "LOW") as keyof typeof RISK_COLORS;
      const hot = level === "HIGH" || level === "SEVERE";
      const existing = markers.current[z.id];
      if (hot) {
        const c = RISK_COLORS[level];
        const label = `<div class="aq-marker"><span class="aq-ring" style="border-color:${c}"></span><span class="aq-ring aq-ring2" style="border-color:${c}"></span>
          <span class="aq-dot" style="background:${c};box-shadow:0 0 14px ${c}"></span>
          <span class="aq-tag" style="border-color:${c}66">${z.name.split(" ").slice(0, 2).join(" ")} <b style="color:${c}">${Math.round(s * 100)}</b></span></div>`;
        if (existing) existing.getElement().innerHTML = label;
        else {
          const el = document.createElement("div"); el.innerHTML = label; el.style.cursor = "pointer";
          el.addEventListener("click", (ev) => { ev.stopPropagation(); onSelectRef.current?.(z.id); });
          markers.current[z.id] = new maplibregl.Marker({ element: el }).setLngLat([z.center.lng, z.center.lat]).addTo(map);
        }
      } else if (existing) { existing.remove(); delete markers.current[z.id]; }
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, zones, overrideScores, overrideLevels, selectedZoneId]);

  // ---- popup + fly to selected zone
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    popup.current?.remove();
    const z = zones.find((q) => q.id === selectedZoneId); if (!z) return;
    const p = z.current_prediction;
    const score = overrideScores?.[z.id] ?? p?.risk_score ?? 0;
    const level = overrideLevels?.[z.id] ?? p?.risk_level ?? "LOW";
    const c = scoreColor(score);
    const rows = overrideScores ? `<div class="aq-row"><span>Scenario risk score</span><b>${Math.round(score * 100)}</b></div>` : `
      <div class="aq-row"><span>Chance of flooding (6 h)</span><b>${pct(p?.flood_probability ?? 0)}</b></div>
      <div class="aq-row"><span>24 h outlook</span><b>${p?.peak_level_24h ?? "–"}${p && p.peak_in_h ? ` in ${p.peak_in_h} h` : ""}</b></div>
      <div class="aq-row"><span>Rain 24 h / next 6 h</span><b>${p?.rainfall_24h_mm ?? 0} / ${p?.forecast_6h_mm ?? 0} mm</b></div>
      <div class="aq-row"><span>Drain level</span><b>${p?.water_level_m ?? 0} m</b></div>
      <div class="aq-spark">${sparkSVG(p?.trajectory ?? [])}<div class="aq-axis"><span>now</span><span>+24 h</span></div></div>`;
    popup.current = new maplibregl.Popup({ offset: 18, maxWidth: "260px", className: "aq-popup" })
      .setLngLat([z.center.lng, z.center.lat])
      .setHTML(`<div class="aq-pop"><div class="aq-title">${z.name}</div><div class="aq-sub">Ward ${z.ward_number} · ${z.swd_basin}</div>
        <div class="aq-level" style="color:${c}">${level} <span>risk ${Math.round(score * 100)}/100</span></div>${rows}</div>`)
      .addTo(map);
    map.flyTo({ center: [z.center.lng, z.center.lat], zoom: 12.4, pitch: 62, speed: 0.7 });
  }, [ready, selectedZoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- slow orbit
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !autoRotate) return;
    let raf = 0; let last = performance.now();
    const spin = (t: number) => { const dt = t - last; last = t; if (!map.isMoving()) map.setBearing(map.getBearing() + dt * 0.004); raf = requestAnimationFrame(spin); };
    raf = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(raf);
  }, [ready, autoRotate]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <div ref={container} className="h-full w-full" />
      {tilesFailed && (
        <div className="absolute left-3 top-3 z-10 rounded-lg border border-amber-400/30 bg-slate-950/80 px-3 py-1.5 text-[11px] text-amber-200">
          Satellite tiles unavailable offline. Showing 3D risk columns only.
        </div>
      )}
    </div>
  );
};
