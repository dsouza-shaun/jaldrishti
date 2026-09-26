"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable, StatusChip, evidenceTone } from "@/components/jaldrishti/Document";

const EVIDENCE_META: Record<string, { label: string; explanation: string }> = {
  VERIFIED: {
    label: "Verified",
    explanation: "Read directly from a named dataset or official record for this exact site.",
  },
  PROXY: {
    label: "Proxy",
    explanation: "Modelled or estimated from the nearest available data, not measured on site.",
  },
  UNKNOWN: {
    label: "Limited data",
    explanation: "No matching dataset was found; treat this value as a placeholder, not a fact.",
  },
};

export function EvidenceBadge({ status }: { status: string }) {
  const meta = EVIDENCE_META[status] ?? EVIDENCE_META.UNKNOWN;
  return (
    <StatusChip tone={evidenceTone(status)} title={meta.explanation}>
      {meta.label}
    </StatusChip>
  );
}

export { EVIDENCE_META };

const CATEGORY_TONE: Record<string, "feasible" | "conditional" | "insufficient" | "constraint" | "muted"> = {
  Safe: "feasible",
  "Semi-Critical": "conditional",
  Critical: "insufficient",
  "Over-Exploited": "constraint",
  Saline: "constraint",
  UNKNOWN: "muted",
};

const DATASET_LABEL: Record<string, string> = {
  DISTRICT_CSV: "District dataset",
  MOCK_BLOCK_FALLBACK: "Nearby area estimate",
  UNKNOWN: "No dataset match",
};

/**
 * Water source and groundwater evidence as a field/finding table. The category
 * is a status chip because it drives the CGWA rule; everything else is context
 * and stays in the table.
 */
export function GroundwaterPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const gw = analysis.groundwater as unknown as {
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
    provenance: { source: string; sourceDate: string; evidenceStatus: string; caveat?: string };
  };

  const rows: Array<{ field: string; value: React.ReactNode }> = [
    {
      field: "Screening category",
      value: <StatusChip tone={CATEGORY_TONE[gw.category] ?? "muted"}>{gw.category}</StatusChip>,
    },
    { field: "Dataset", value: DATASET_LABEL[gw.datasetType] ?? gw.datasetType },
    { field: "District", value: gw.district ?? "Not available" },
    { field: "State", value: gw.state ?? "Not available" },
    { field: "Block or assessment unit", value: gw.block ?? "Not identified" },
    {
      field: "Assessment unit verified",
      value: gw.assessmentUnitVerified ? "Yes" : "No, district level only",
    },
    {
      field: "Extraction stage",
      value: gw.stage != null ? `${gw.stage.toFixed(1)}%` : "Not available",
    },
    { field: "Total dissolved solids", value: gw.tds != null ? `${gw.tds} mg/L` : "Not supplied" },
    {
      field: "Water table depth",
      value:
        gw.preMonsoon != null || gw.postMonsoon != null
          ? `${gw.preMonsoon ?? "-"} / ${gw.postMonsoon ?? "-"} mbgl`
          : "Not supplied",
    },
    {
      field: "Annual recharge",
      value: gw.resources?.totalAnnualRecharge != null ? `${gw.resources.totalAnnualRecharge} ham` : "Not available",
    },
    {
      field: "Current extraction",
      value: gw.resources?.totalCurrentExtraction != null ? `${gw.resources.totalCurrentExtraction} ham` : "Not available",
    },
    {
      field: "Distance to record",
      value: gw.distanceKm != null ? `${gw.distanceKm.toFixed(2)} km` : "Not applicable",
    },
    { field: "Evidence status", value: <EvidenceBadge status={gw.provenance.evidenceStatus} /> },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        columns={[
          { key: "field", header: "Field", render: (row) => <span className="font-semibold">{row.field}</span> },
          { key: "value", header: "Finding", render: (row) => <span className="text-sm">{row.value}</span> },
        ]}
        rows={rows}
      />
      <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
        Source: {gw.provenance.source}, {gw.provenance.sourceDate}.
        {gw.provenance.caveat ? ` ${gw.provenance.caveat}` : ""}
      </p>
    </div>
  );
}
