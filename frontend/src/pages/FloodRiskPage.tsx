import React from "react";
import { BengaluruGISMap } from "../components/map/BengaluruGISMap";
import { ZoneDetailDrawer } from "../components/map/ZoneDetailDrawer";
import { Zone } from "../services/api";
import { MapPin, Info } from "lucide-react";

interface FloodRiskPageProps {
  zones: Zone[];
  selectedZone: Zone | null;
  onSelectZone: (zone: Zone) => void;
  onCloseDrawer: () => void;
  lakes: any[];
  drains: any[];
  infrastructure: any[];
}

export const FloodRiskPage: React.FC<FloodRiskPageProps> = ({
  zones,
  selectedZone,
  onSelectZone,
  onCloseDrawer,
  lakes,
  drains,
  infrastructure
}) => {
  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-300" />
            <h1 className="text-2xl font-bold text-white tracking-wide">GIS risk map (2D)</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Ward-level spatial vulnerability, stormwater drains (Raja Kaluves), lakes & infrastructure overlays
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono">
          <Info className="w-3.5 h-3.5 text-cyan-300" />
          <span>Interactive GIS Vector Layer</span>
        </div>
      </div>

      {/* Main Full-Screen Map Container */}
      <div className="w-full h-[660px] relative">
        <BengaluruGISMap
          zones={zones}
          selectedZone={selectedZone}
          onSelectZone={onSelectZone}
          lakes={lakes}
          drains={drains}
          infrastructure={infrastructure}
        />

        {/* Zone Detail Slide-Out Inspector */}
        {selectedZone && (
          <ZoneDetailDrawer
            zone={selectedZone}
            onClose={onCloseDrawer}
            infrastructure={infrastructure}
          />
        )}
      </div>
    </div>
  );
};
