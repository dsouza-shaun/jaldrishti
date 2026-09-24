"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { ShieldCheck, Database, Link2, Bolt } from "lucide-react";

interface EvidenceRow {
  key: string;
  label: string;
  value: string;
  source: string;
  sourceDate: string;
  evidenceStatus: string;
  category: "data" | "rule";
}

export function EvidencePanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const rows: EvidenceRow[] = [];

  // Water demand
  const w = analysis.waterDemand as { provenance: { source: string; sourceDate: string; evidenceStatus: string }; wueUsed: number };
  rows.push({
    key: "water-demand",
    label: "Water demand (calc)",
    value: `WUE ${w.wueUsed} L/kWh`,
    source: w.provenance.source,
    sourceDate: w.provenance.sourceDate,
    evidenceStatus: w.provenance.evidenceStatus,
    category: "rule",
  });

  // Groundwater
  const g = analysis.groundwater as { block: string | null; category: string; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  rows.push({
    key: "gw",
    label: "Groundwater block",
    value: `${g.block ?? "UNKNOWN"} (${g.category})`,
    source: g.provenance.source,
    sourceDate: g.provenance.sourceDate,
    evidenceStatus: g.provenance.evidenceStatus,
    category: "data",
  });

  // Rainfall
  const r = analysis.rainfall as { station: string | null; annualNormal: number | null; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  rows.push({
    key: "rainfall",
    label: "Rainfall station",
    value: `${r.station ?? "—"} (${r.annualNormal ?? "—"} mm)`,
    source: r.provenance.source,
    sourceDate: r.provenance.sourceDate,
    evidenceStatus: r.provenance.evidenceStatus,
    category: "data",
  });

  // Ecology
  const eco = analysis.ecology as Record<string, { rule: { provenance: { source: string; sourceDate: string; evidenceStatus: string } } }>;
  for (const k of ["esz", "forest", "wetland", "crz"]) {
    const e = eco[k];
    if (e) {
      rows.push({
        key: `eco-${k}`,
        label: `${k.toUpperCase()} polygons`,
        value: "MoEFCC / state wetland authority",
        source: e.rule.provenance.source,
        sourceDate: e.rule.provenance.sourceDate,
        evidenceStatus: e.rule.provenance.evidenceStatus,
        category: "data",
      });
    }
  }

  // Rules
  const reg = analysis.regulatory as Record<string, { provenance: { source: string; sourceDate: string; evidenceStatus: string }; outcome: string }>;
  for (const k of ["cgwa", "ec", "spcb"]) {
    const v = reg[k];
    if (v) {
      rows.push({
        key: `rule-${k}`,
        label: `Rule: ${k.toUpperCase()}`,
        value: v.outcome,
        source: v.provenance.source,
        sourceDate: v.provenance.sourceDate,
        evidenceStatus: v.provenance.evidenceStatus,
        category: "rule",
      });
    }
  }

  // Power
  const p = analysis.power as { timeline: string; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  rows.push({
    key: "power",
    label: "Power connection timeline",
    value: p.timeline,
    source: p.provenance.source,
    sourceDate: p.provenance.sourceDate,
    evidenceStatus: p.provenance.evidenceStatus,
    category: "data",
  });

  const verified = rows.filter((r) => r.evidenceStatus === "VERIFIED").length;
  const proxy = rows.filter((r) => r.evidenceStatus === "PROXY").length;
  const unknown = rows.filter((r) => r.evidenceStatus === "UNKNOWN").length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">Evidence & Provenance</h3>
        </div>
        <div className="flex gap-1">
          <span className="nb-badge" style={{ background: "var(--status-verified)" }}>{verified} VERIFIED</span>
          <span className="nb-badge" style={{ background: "var(--status-proxy)" }}>{proxy} PROXY</span>
          <span className="nb-badge" style={{ background: "var(--status-unknown)" }}>{unknown} UNKNOWN</span>
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto nb-scroll border-[2px] border-black">
        <table className="w-full text-xs">
          <thead className="bg-black text-[var(--paper)] text-[9px] uppercase tracking-wider sticky top-0">
            <tr>
              <th className="text-left p-2">Field</th>
              <th className="text-left p-2">Value</th>
              <th className="text-left p-2">Source</th>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Ev.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className={i % 2 === 0 ? "bg-[var(--paper)]" : "bg-[var(--muted)]"}>
                <td className="p-2 font-bold">
                  <span className="flex items-center gap-1">
                    {row.category === "data" ? <Database className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    {row.label}
                  </span>
                </td>
                <td className="p-2 font-mono text-[10px]">{row.value}</td>
                <td className="p-2 text-[10px]">{row.source}</td>
                <td className="p-2 text-[10px] font-mono">{row.sourceDate}</td>
                <td className="p-2">
                  <span
                    className="nb-badge"
                    style={{
                      background:
                        row.evidenceStatus === "VERIFIED" ? "var(--status-verified)" :
                        row.evidenceStatus === "PROXY" ? "var(--status-proxy)" :
                        "var(--status-unknown)",
                    }}
                  >
                    {row.evidenceStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2 flex items-center gap-1">
        <Bolt className="w-3 h-3" />
        Every value carries its source and evidence status — all the way to the final classification.
      </div>
    </motion.section>
  );
}
