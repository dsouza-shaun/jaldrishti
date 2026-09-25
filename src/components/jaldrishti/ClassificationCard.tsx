"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { CheckCircle2, AlertTriangle, HelpCircle, XOctagon } from "lucide-react";

const STYLE: Record<string, { bg: string; icon: React.ReactNode; text: string }> = {
  Feasible: { bg: "var(--status-feasible)", icon: <CheckCircle2 className="h-7 w-7" />, text: "#001a0a" },
  "Feasible with Conditions": { bg: "var(--status-conditional)", icon: <AlertTriangle className="h-7 w-7" />, text: "#3a2a00" },
  "Data Insufficient": { bg: "var(--status-insufficient)", icon: <HelpCircle className="h-7 w-7" />, text: "#3a1a00" },
  "High Constraint / Further Assessment Required": { bg: "var(--status-constraint)", icon: <XOctagon className="h-7 w-7" />, text: "#fff" },
};

export function ClassificationCard() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const classification = analysis.classification.classification;
  const style = STYLE[classification] ?? STYLE["Data Insufficient"];

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="nb-card p-5"
      style={{ background: style.bg, color: style.text }}
    >
      <div className="flex items-center gap-4">
        {style.icon}
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-80">Screening result</div>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{classification}</h2>
          <p className="mt-1 text-xs opacity-80">{analysis.projectName}</p>
        </div>
      </div>

      <details className="mt-4 border-t border-black/30 pt-3">
        <summary className="cursor-pointer text-sm font-bold">Why this result?</summary>
        <ul className="mt-3 space-y-2">
          {analysis.classification.reasons.map((reason, index) => (
            <li key={index} className="border-2 border-black bg-[var(--paper)] px-3 py-2 text-sm text-black">{reason}</li>
          ))}
        </ul>
        {analysis.classification.evidenceGaps.length > 0 && (
          <p className="mt-3 text-sm">Some information is unavailable and may need to be confirmed before making a decision.</p>
        )}
      </details>
    </motion.section>
  );
}
