"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable, StatusChip, evidenceTone } from "@/components/jaldrishti/Document";

const LAYER_META = {
  esz:     { label: "Eco-Sensitive Zone", reference: "Wildlife (Protection) Act" },
  forest:  { label: "Forest",              reference: "Forest (Conservation) Act" },
  wetland: { label: "Wetland",             reference: "Wetland (Rules) 2017" },
  crz:     { label: "Coastal Regulation Zone", reference: "CRZ Notification 2018" },
} as const;

type LayerKey = keyof typeof LAYER_META;

/**
 * The ecological assessment as a scannable table.
 *
 * This replaces four separately coloured boxes, each of which demanded its own
 * glance. A table lets a reviewer read down the constraint column and see
 * immediately which layers were tested, which came back clean, and which one
 * needs attention.
 */
export function EcologyPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const eco = analysis.ecology as Record<
    LayerKey,
    {
      overlap: boolean;
      nearestDistanceKm: number;
      intersectedPolygons: { name: string; category?: string }[];
      rule: {
        outcome: string;
        reasons: string[];
        hardConstraint: boolean;
        provenance: { source: string; sourceDate: string; evidenceStatus: string };
      };
    }
  >;

  const rows = (Object.keys(LAYER_META) as LayerKey[]).map((layer) => ({
    key: layer,
    layer,
    meta: LAYER_META[layer],
    entry: eco[layer],
  }));

  return (
    <div className="space-y-3">
      <DataTable
        columns={[
          { key: "constraint", header: "Constraint", render: (row) => <span className="font-semibold">{row.meta.label}</span> },
          {
            key: "status",
            header: "Status",
            render: (row) =>
              row.entry?.overlap ? (
                <StatusChip tone="constraint">Potential overlap</StatusChip>
              ) : (
                <StatusChip tone="feasible">No overlap found</StatusChip>
              ),
          },
          {
            key: "finding",
            header: "Finding",
            render: (row) => {
              if (!row.entry) return "Not assessed";
              if (row.entry.overlap) {
                const names = row.entry.intersectedPolygons?.map((polygon) => polygon.name).filter(Boolean);
                return (
                  <div className="text-sm">
                    <div className="font-bold uppercase text-xs">{row.entry.rule.outcome}</div>
                    {names && names.length > 0 && (
                      <div className="mt-0.5 text-[var(--nb-muted)]">{names.join(", ")}</div>
                    )}
                    {row.entry.rule.reasons.map((reason, index) => (
                      <div key={index} className="mt-0.5 text-xs text-[var(--nb-muted)] leading-snug">
                        {reason}
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="text-sm">
                  <span className="font-mono text-xs">
                    Nearest {row.entry.nearestDistanceKm.toFixed(2)} km
                  </span>
                  {row.entry.rule.reasons.map((reason, index) => (
                    <div key={index} className="mt-0.5 text-xs text-[var(--nb-muted)] leading-snug">
                      {reason}
                    </div>
                  ))}
                </div>
              );
            },
          },
          {
            key: "evidence",
            header: "Evidence",
            render: (row) => (
              <StatusChip tone={evidenceTone(row.entry?.rule.provenance.evidenceStatus ?? "UNKNOWN")}>
                {row.entry?.rule.provenance.evidenceStatus === "VERIFIED" ? "Sourced" : row.entry?.rule.provenance.evidenceStatus === "PROXY" ? "Modelled" : "Limited"}
              </StatusChip>
            ),
          },
          {
            key: "reference",
            header: "Reference",
            render: (row) => (
              <span className="text-xs text-[var(--nb-muted)]">{row.meta.reference}</span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.key}
      />
      <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
        Constraints are tested against the available boundary layers. No detected
        overlap is not a clearance, and absence of a layer in the source data is not
        evidence of absence on the ground.
      </p>
    </div>
  );
}
