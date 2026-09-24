"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { ShieldAlert, BookOpen } from "lucide-react";
import { EvidenceBadge } from "./GroundwaterPanel";

export function RegulatoryPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const reg = analysis.regulatory as {
    cgwa: { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
    ec:   { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
    spcb: { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  };

  const rows = [
    { key: "cgwa", label: "CGWA / Groundwater NOC", data: reg.cgwa },
    { key: "ec",   label: "Environmental Clearance", data: reg.ec },
    { key: "spcb", label: "SPCB Consent (CTE/CTO)", data: reg.spcb },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">Regulatory Exposure</h3>
        </div>
        <span className="text-[10px] font-mono text-black/60">3 rule engines</span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="border-[2px] border-black bg-[var(--paper)]">
            <div className="flex items-stretch">
              <div
                className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wider border-r-[2px] border-black flex items-center"
                style={{
                  background:
                    r.data.hardConstraint ? "var(--accent-red)" :
                    r.data.outcome.includes("CONDITION") || r.data.outcome.includes("APPLICABLE") || r.data.outcome.includes("REQUIRED") ? "var(--accent-yellow)" :
                    r.data.outcome.includes("INSUFFICIENT") ? "var(--status-unknown)" :
                    "var(--accent-green)",
                  minWidth: 110,
                }}
              >
                {r.label}
              </div>
              <div className="flex-1 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-sm uppercase">{r.data.outcome}</div>
                  <EvidenceBadge status={r.data.provenance.evidenceStatus} />
                </div>
                <ul className="mt-1 space-y-0.5">
                  {r.data.reasons.map((reason, i) => (
                    <li key={i} className="text-[11px] text-black/80 leading-snug">· {reason}</li>
                  ))}
                </ul>
                <div className="mt-1 text-[9px] font-mono text-black/60 flex items-center gap-1">
                  <BookOpen className="w-2.5 h-2.5" />
                  {r.data.provenance.source} · {r.data.provenance.sourceDate}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
