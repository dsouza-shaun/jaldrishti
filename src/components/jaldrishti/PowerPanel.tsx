"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Bolt } from "lucide-react";

export function PowerPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const p = analysis.power as {
    timeline: string;
    substation: string | null;
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Bolt className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">Power / Grid</h3>
        </div>
        <span
          className="nb-badge"
          style={{ background: "var(--status-unknown)" }}
        >
          {p.provenance.evidenceStatus}
        </span>
      </div>

      <div className="border-[2px] border-black p-3 bg-[var(--paper)]">
        <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60">Connection timeline</div>
        <div className="font-extrabold text-base" style={{ color: "var(--accent-orange)" }}>
          {p.timeline}
        </div>
        <div className="text-[11px] text-black/70 mt-1">
          Power connection timeline data unavailable for this site. Full-system
          feature: integrate state DISCOM / CEA APIs to estimate grid
          readiness and sub-station proximity risk.
        </div>
      </div>

      <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
        <strong>Source:</strong> {p.provenance.source}
        <br />
        The system does NOT fabricate a timeline. UNKNOWN is the honest answer.
      </div>
    </motion.section>
  );
}
