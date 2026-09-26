"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Droplets, MapPin, Gauge, Beaker, Database } from "lucide-react";

const CATEGORY_COLOR: Record<string, string> = {
  Safe: "var(--status-feasible)",
  "Semi-Critical": "var(--status-conditional)",
  Critical: "var(--status-insufficient)",
  "Over-Exploited": "var(--status-constraint)",
  Saline: "var(--status-constraint)",
  UNKNOWN: "var(--status-unknown)",
};

export function GroundwaterPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const groundwater = analysis.groundwater as {
    datasetType: "DISTRICT_CSV" | "MOCK_BLOCK_FALLBACK" | "UNKNOWN";
    block: string | null;
    district: string | null;
    state: string | null;
    category: string;
    stage: number | null;
    tds: number | null;
    preMonsoon: number | null;
    postMonsoon: number | null;
    distanceKm: number | null;
    assessmentUnitVerified: boolean;
    resources: {
      totalAnnualRecharge: number | null;
      totalCurrentExtraction: number | null;
    } | null;
    provenance: {
      source: string;
      sourceDate: string;
      evidenceStatus: string;
      caveat?: string;
    };
  };

  const sourceLabel =
    groundwater.datasetType === "DISTRICT_CSV"
      ? "District CSV"
      : groundwater.datasetType === "MOCK_BLOCK_FALLBACK"
        ? "Nearby area estimate"
        : "No dataset match";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">
          Groundwater
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Info
          icon={<Database className="w-3 h-3" />}
          label="Dataset"
          value={sourceLabel}
        />
        <Info
          icon={<MapPin className="w-3 h-3" />}
          label="District"
          value={groundwater.district ?? "UNKNOWN"}
        />
        <Info
          icon={<MapPin className="w-3 h-3" />}
          label="Block / unit"
          value={groundwater.block ?? "Not identified"}
        />
        <Info
          icon={<Gauge className="w-3 h-3" />}
          label="Extraction stage"
          value={groundwater.stage != null ? `${groundwater.stage}%` : "UNKNOWN"}
        />
        <Info
          icon={<Beaker className="w-3 h-3" />}
          label="TDS"
          value={groundwater.tds != null ? `${groundwater.tds} mg/L` : "Not supplied"}
        />
        <Info
          icon={<Droplets className="w-3 h-3" />}
          label="Water-table depth"
          value={
            groundwater.preMonsoon != null || groundwater.postMonsoon != null
              ? `${groundwater.preMonsoon ?? "—"} / ${groundwater.postMonsoon ?? "—"} mbgl`
              : "Not supplied"
          }
        />
      </div>

      <div className="mt-3">
        <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60 mb-1">
          Screening category
        </div>
        <div
          className="border-[3px] border-black px-3 py-2 font-extrabold text-base uppercase"
          style={{
            background:
              CATEGORY_COLOR[groundwater.category] ?? "var(--status-unknown)",
          }}
        >
          {groundwater.category}
        </div>
      </div>

      {groundwater.resources && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="border-[2px] border-black p-2">
            <strong>Annual recharge:</strong>{" "}
            {groundwater.resources.totalAnnualRecharge ?? "—"}
          </div>
          <div className="border-[2px] border-black p-2">
            <strong>Current extraction:</strong>{" "}
            {groundwater.resources.totalCurrentExtraction ?? "—"}
          </div>
        </div>
      )}

      <div className="mt-3 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
        <strong>Source:</strong> {groundwater.provenance.source}<br />
        <strong>Spatial resolution:</strong>{" "}
        {groundwater.assessmentUnitVerified
          ? "Assessment unit verified"
          : "District/fallback only — not block-verified"}
        {groundwater.distanceKm !== null && (
          <>
            {" · "}
            <strong>Centroid distance:</strong> {groundwater.distanceKm.toFixed(2)} km
          </>
        )}
        {groundwater.provenance.caveat && (
          <div className="mt-1 leading-snug">{groundwater.provenance.caveat}</div>
        )}
      </div>
    </motion.section>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-[2px] border-black p-2 bg-[var(--paper)] min-w-0">
      <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="font-bold text-xs sm:text-sm break-words">{value}</div>
    </div>
  );
}

const EVIDENCE_META: Record<string, { label: string; color: string; explanation: string }> = {
  VERIFIED: {
    label: "Verified",
    color: "var(--status-verified)",
    explanation: "Read directly from a named dataset or official record for this exact site.",
  },
  PROXY: {
    label: "Proxy",
    color: "var(--status-conditional)",
    explanation: "Modelled or estimated from the nearest available data, not measured on site.",
  },
  UNKNOWN: {
    label: "Limited data",
    color: "var(--status-unknown)",
    explanation: "No matching dataset was found; treat this value as a placeholder, not a fact.",
  },
};

export function EvidenceBadge({ status }: { status: string }) {
  const meta = EVIDENCE_META[status] ?? EVIDENCE_META.UNKNOWN;
  return (
    <span className="nb-badge" style={{ background: meta.color }} title={meta.explanation}>
      {meta.label}
    </span>
  );
}

export { EVIDENCE_META };