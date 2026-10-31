import React from "react";
import type { Zone } from "../../services/api";
import { ZoneInsight } from "../ZoneInsight";

interface ZoneDetailDrawerProps {
  zone: Zone | null;
  onClose: () => void;
  infrastructure: any[];
}

export const ZoneDetailDrawer: React.FC<ZoneDetailDrawerProps> = ({ zone, onClose, infrastructure }) => {
  if (!zone) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[400px] max-w-full overflow-y-auto border-l border-white/10 bg-[#050b16]/95 p-5 shadow-2xl backdrop-blur-xl">
      <ZoneInsight zone={zone} onClose={onClose} infrastructure={infrastructure} />
    </div>
  );
};
