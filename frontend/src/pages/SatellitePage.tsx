import React, { useState } from "react";
import { Layers, RotateCw, ScanLine } from "lucide-react";
import type { Zone, Threat, SatelliteObservation } from "../services/api";
import { fetchSatellite } from "../services/api";
import { SatelliteMap3D } from "../components/map/SatelliteMap3D";
import type { MapLayers } from "../components/map/SatelliteMap3D";
import { ZoneInsight } from "../components/ZoneInsight";
import { ThreatRadar } from "../components/threats/ThreatRadar";
import { usePoll } from "../utils/usePoll";

interface Props {
  zones: Zone[];
  threats: Threat[];
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  lakes: any[];
  drains: any[];
  infrastructure: any[];
}

const LAYER_LABELS: [keyof MapLayers, string][] = [
  ["risk", "3D risk columns"], ["lakes", "Lakes"], ["drains", "Storm drains"], ["infrastructure", "Infrastructure"], ["labels", "Place names"],
];

export const SatellitePage: React.FC<Props> = ({ zones, threats, selectedZoneId, onSelectZone, lakes, drains, infrastructure }) => {
  const [layers, setLayers] = useState<MapLayers>({ risk: true, lakes: true, drains: true, infrastructure: true, labels: true });
  const [orbit, setOrbit] = useState(false);
  const [sat] = usePoll<SatelliteObservation>(fetchSatellite, 6000);
  const selected = zones.find((z) => z.id === selectedZoneId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">3D satellite risk view</h1>
          <p className="mt-1 text-sm text-slate-400">Satellite imagery on 3D terrain. Column height and colour show each zone's live flood risk. Click a zone for its forecast.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LAYER_LABELS.map(([k, label]) => (
            <button key={k} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} aria-pressed={layers[k]}
              className={`rounded-full border px-3 py-1 text-[11.5px] transition ${layers[k] ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
          <button onClick={() => setOrbit(!orbit)} aria-pressed={orbit}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] ${orbit ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-400 hover:text-white"}`}>
            <RotateCw className="h-3 w-3" /> Orbit
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative">
          <SatelliteMap3D zones={zones} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} lakes={lakes} drains={drains}
            infrastructure={infrastructure} layers={layers} autoRotate={orbit} className="h-[calc(100vh-190px)] min-h-[520px]" />
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-[#040914]/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-white"><Layers className="h-3 w-3" /> Risk score</div>
            <div className="h-1.5 w-44 rounded-full" style={{ background: "linear-gradient(90deg,#34d399,#fbbf24 35%,#fb923c 65%,#f43f5e 85%,#e11d48)" }} />
            <div className="mt-1 flex w-44 justify-between font-mono text-[10px] text-slate-400"><span>LOW</span><span>MED</span><span>HIGH</span><span>SEV</span></div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-190px)] space-y-4 overflow-y-auto pr-1">
          {selected ? (
            <div className="glass-panel rounded-2xl p-4"><ZoneInsight zone={selected} onClose={() => onSelectZone(null)} infrastructure={infrastructure} /></div>
          ) : (
            <ThreatRadar threats={threats} onSelect={(id) => onSelectZone(id)} />
          )}

          <div className="glass-panel rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-2"><ScanLine className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-white">Prediction vs observed flooding</h2></div>
            {sat ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Predicted" value={`${sat.predicted_extent_sq_km} km²`} />
                  <Mini label="Observed" value={`${sat.observed_extent_sq_km} km²`} />
                  <Mini label="Overlap (IoU)" value={sat.spatial_overlap_iou === null ? "–" : `${Math.round(sat.spatial_overlap_iou * 100)}%`} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {sat.affected_corridors.length ? `Flooding observed in ${sat.affected_corridors.join(", ")}. ` : "No flooding observed right now. "}
                  {sat.description}
                </p>
                <p className="mt-1 text-[10.5px] text-amber-200/80">{sat.layer_label}</p>
              </>
            ) : <p className="text-xs text-slate-400">Loading…</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-2">
    <div className="text-[10.5px] text-slate-400">{label}</div>
    <div className="font-mono text-sm font-semibold text-white">{value}</div>
  </div>
);
