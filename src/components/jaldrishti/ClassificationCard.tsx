"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { CheckCircle2, AlertTriangle, HelpCircle, XOctagon, ChevronRight } from "lucide-react";
import { useState } from "react";

const STYLE: Record<string, { bg: string; icon: React.ReactNode; text: string }> = {
  "Feasible": { bg: "var(--status-feasible)", icon: <CheckCircle2 className="w-7 h-7" />, text: "#001a0a" },
  "Feasible with Conditions": { bg: "var(--status-conditional)", icon: <AlertTriangle className="w-7 h-7" />, text: "#3a2a00" },
  "Data Insufficient": { bg: "var(--status-insufficient)", icon: <HelpCircle className="w-7 h-7" />, text: "#3a1a00" },
  "High Constraint / Further Assessment Required": {
    bg: "var(--status-constraint)",
    icon: <XOctagon className="w-7 h-7" />,
    text: "#fff",
  },
};

export function ClassificationCard() {
  const { analysis } = useJalDrishti();
  const [showTrace, setShowTrace] = useState(false);

  if (!analysis) return null;

  const cls = analysis.classification.classification;
  const style = STYLE[cls] ?? STYLE["Data Insufficient"];

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="nb-card p-5 nb-shadow-hard-lg"
      style={{ background: style.bg, color: style.text }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ rotate: -10, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
          >
            {style.icon}
          </motion.div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-80">
              Screening result
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold leading-none mt-1">{cls}</h2>
            <p className="text-xs mt-1 opacity-80 font-mono">{analysis.projectName}</p>
          </div>
        </div>

        <button
          onClick={() => setShowTrace((s) => !s)}
          className="text-[10px] font-extrabold uppercase border-[2px] border-current px-2 py-1"
        >
          {showTrace ? "Hide" : "Show"} trace <ChevronRight className={`w-3 h-3 inline transition-transform ${showTrace ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Reasons */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {analysis.classification.reasons.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className="bg-[var(--paper)] text-black border-[2px] border-black px-3 py-1.5 text-xs"
          >
            {r}
          </motion.div>
        ))}
      </div>

      {/* Trace */}
      {showTrace && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mt-4 bg-black text-[var(--paper)] p-3 border-[2px] border-black"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-widest mb-2 text-[var(--accent-yellow)]">
            Decision Trace (auditable)
          </div>
          <div className="font-mono text-xs space-y-1">
            {analysis.classification.trace.map((t, i) => (
              <div key={i}>
                <span className="text-[var(--accent-green)]">[{String(i + 1).padStart(2, "0")}]</span>{" "}
                <span className="text-[var(--paper)]">{t.step}</span>
                <span className="text-[var(--accent-red)]"> → </span>
                <span className="text-[var(--accent-yellow)]">{t.result}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sub-counts */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Stat label="Hard constraints" value={analysis.classification.hardConstraints.length} color="var(--accent-red)" />
        <Stat label="Soft constraints" value={analysis.classification.softConstraints.length} color="var(--accent-orange)" />
        <Stat label="Evidence gaps" value={analysis.classification.evidenceGaps.length} color="var(--accent-yellow)" />
        <Stat label="Total checks" value={analysis.constraints.length} color="var(--accent-purple)" />
      </div>
    </motion.section>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--paper)] text-black border-[2px] border-black px-3 py-2">
      <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}
