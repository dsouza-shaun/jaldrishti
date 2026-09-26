"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable, StatusChip, evidenceTone } from "@/components/jaldrishti/Document";

interface RuleRow {
  key: string;
  label: string;
  outcome: string;
  reasons: string[];
  hardConstraint: boolean;
  source: string;
  sourceDate: string;
  evidenceStatus: string;
}

/**
 * The three rule engines as a scannable table: what was checked, what came
 * back, how binding it is, and which rule produced it. Reasons stay attached
 * to their row so the outcome is never a bare label.
 */
export function RegulatoryPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const reg = analysis.regulatory as {
    cgwa: { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
    ec:   { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
    spcb: { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  };

  const rows: RuleRow[] = [
    { key: "cgwa", label: "Groundwater extraction (CGWA NOC)", data: reg.cgwa },
    { key: "ec", label: "Environmental clearance", data: reg.ec },
    { key: "spcb", label: "Consent to establish and operate (SPCB)", data: reg.spcb },
  ].map((entry) => ({
    key: entry.key,
    label: entry.label,
    outcome: entry.data.outcome,
    reasons: entry.data.reasons,
    hardConstraint: entry.data.hardConstraint,
    source: entry.data.provenance.source,
    sourceDate: entry.data.provenance.sourceDate,
    evidenceStatus: entry.data.provenance.evidenceStatus,
  }));

  return (
    <DataTable
      columns={[
        { key: "label", header: "Check", render: (row) => <span className="font-semibold">{row.label}</span> },
        {
          key: "outcome",
          header: "Outcome",
          render: (row) => (
            <div>
              <div className="font-bold uppercase text-sm">{row.outcome}</div>
              {row.reasons.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {row.reasons.map((reason, index) => (
                    <li key={index} className="text-xs text-[var(--nb-muted)] leading-snug">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        },
        {
          key: "binding",
          header: "Binding",
          render: (row) =>
            row.hardConstraint ? (
              <StatusChip tone="constraint">Hard</StatusChip>
            ) : (
              <StatusChip tone="neutral">Soft</StatusChip>
            ),
        },
        {
          key: "status",
          header: "Evidence",
          render: (row) => (
            <StatusChip tone={evidenceTone(row.evidenceStatus)}>
              {row.evidenceStatus === "VERIFIED" ? "Sourced" : row.evidenceStatus === "PROXY" ? "Modelled" : "Limited"}
            </StatusChip>
          ),
        },
        {
          key: "source",
          header: "Reference",
          render: (row) => (
            <span className="text-xs text-[var(--nb-muted)] leading-snug">
              {row.source}
              <br />
              {row.sourceDate}
            </span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(row) => row.key}
    />
  );
}
