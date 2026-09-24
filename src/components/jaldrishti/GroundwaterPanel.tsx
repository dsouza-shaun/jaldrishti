"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Droplets, MapPin, Gauge, Beaker } from "lucide-react";

const CATEGORY_COLOR: Record<string, string> = {
  "Safe": "var(--status-feasible)",
  "Semi-Critical": "var(--status-conditional)",
  "Critical": "var(--status-insufficient)",
  "Over-Exploited": "var(--status-constraint)",
  "Saline": "var(--status-constraint)",
  "UNKNOWN": "var(--status-unknown)",
};

export function GroundwaterPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const g = analysis.groundwater as {
    block: string | null;
    district: string | null;
    state: string | null;
    category: string;
    stage: number | null;
    tds: number | null;
    preMonsoon: number | null;
    postMonsoon: number | null;
    distanceKm: number;
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">Groundwater (CGWB)</h3>
        <EvidenceBadge status={g.provenance.evidenceStatus} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Info icon={<MapPin className="w-3 h-3" />} label="Block" value={g.block ?? "UNKNOWN"} />
        <Info icon={<MapPin className="w-3 h-3" />} label="District" value={g.district ?? "—"} />
        <Info icon={<Gauge className="w-3 h-3" />} label="Stage of GW dev." value={g.stage != null ? `${g.stage}%` : "—"} />
        <Info icon={<Beaker className="w-3 h-3" />} label="TDS" value={g.tds != null ? `${g.tds} mg/L` : "—"} />
        <Info icon={<Droplets className="w-3 h-3" />} label="Pre-monsoon DTW" value={g.preMonsoon != null ? `${g.preMonsoon} mbgl` : "—"} />
        <Info icon={<Droplets className="w-3 h-3" />} label="Post-monsoon DTW" value={g.postMonsoon != null ? `${g.postMonsoon} mbgl` : "—"} />
      </div>

      <div className="mt-3">
        <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60 mb-1">CGWB Category</div>
        <div
          className="border-[3px] border-black px-3 py-2 font-extrabold text-base uppercase"
          style={{ background: CATEGORY_COLOR[g.category] ?? "var(--status-unknown)" }}
        >
          {g.category}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="border-[2px] border-black px-2 py-1 text-[10px] font-mono bg-[var(--paper)]">
          <strong>Distance to block centroid:</strong> {g.distanceKm.toFixed(2)} km
        </div>
        <div className="border-[2px] border-black px-2 py-1 text-[10px] font-mono bg-[var(--paper)]">
          <strong>Source:</strong> {g.provenance.source}
        </div>
      </div>

      <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
        <strong>Source date:</strong> {g.provenance.sourceDate} ·{" "}
        <strong>Evidence:</strong> {g.provenance.evidenceStatus}
      </div>
    </motion.section>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
      <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
        {icon}
        {label}
      </div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
}

export function EvidenceBadge({ status }: { status: string }) {
  const color =
    status === "VERIFIED" ? "var(--status-verified)" :
    status === "PROXY" ? "var(--status-proxy)" :
    "var(--status-unknown)";
  return (
    <span className="nb-badge" style={{ background: color }}>
      {status}
    </span>
  );
}
