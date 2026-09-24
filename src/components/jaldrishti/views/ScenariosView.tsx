"use client";

import { motion } from "framer-motion";
import { useJalDrishti, type ScenarioResult } from "@/lib/stores/jaldrishti-store";
import { WhatIfPanel } from "@/components/jaldrishti/WhatIfPanel";
import { Search, ArrowRight, FlaskConical, TrendingDown, TrendingUp, BarChart3 } from "lucide-react";

export function ScenariosView() {
  const { analysis, scenarios, setView } = useJalDrishti();

  if (!analysis) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 text-center">
        <div className="nb-card p-12" style={{ background: "var(--accent-yellow)" }}>
          <h1 className="text-4xl font-extrabold mb-3">Run a screening first</h1>
          <p className="text-lg text-black/70 mb-6">
            What-if scenarios need a baseline analysis to compare against.
          </p>
          <button onClick={() => setView("analyze")} className="nb-btn nb-btn-primary text-lg !py-3 !px-6 mx-auto">
            <Search className="w-5 h-5" />
            Start screening
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  const baselineKl = (analysis.waterDemand as { waterKlPerDay: number }).waterKlPerDay;
  const baselineMcm = (analysis.waterDemand as { waterMcmPerYear: number }).waterMcmPerYear;
  const baselineCls = analysis.classification.classification;

  // Find best (lowest water) and worst (highest water) scenarios
  const sortedScenarios = [...scenarios].sort((a, b) => {
    const aw = (a.result.waterDemand as { waterKlPerDay: number }).waterKlPerDay;
    const bw = (b.result.waterDemand as { waterKlPerDay: number }).waterKlPerDay;
    return aw - bw;
  });
  const best = sortedScenarios[0];
  const worst = sortedScenarios[sortedScenarios.length - 1];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-red)]">
          What-if analysis
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight">
          Explore alternatives.
        </h1>
        <p className="text-base sm:text-lg text-black/70 max-w-3xl">
          Change cooling technology, water source, or capacity and instantly
          see how the screening changes. Every scenario is recomputed from
          scratch — no guesswork.
        </p>
      </motion.div>

      {/* Baseline summary card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="nb-card p-4 sm:p-6"
        style={{ background: "var(--ink)", color: "var(--paper)" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <div className="col-span-2 md:col-span-1">
            <div className="text-xs uppercase tracking-wider text-white/60 mb-1">Baseline project</div>
            <div className="text-lg sm:text-xl font-extrabold leading-tight break-words">{analysis.projectName}</div>
          </div>
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/60 mb-1">Daily water</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--accent-yellow)]">
              {Number(baselineKl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-xs sm:text-base text-white/70 ml-1">kL/day</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/60 mb-1">Annual water</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--accent-green)]">
              {Number(baselineMcm).toFixed(3)}
              <span className="text-xs sm:text-base text-white/70 ml-1">MCM/yr</span>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/60 mb-1">Classification</div>
            <div className="text-sm sm:text-base font-bold leading-tight">{baselineCls}</div>
          </div>
        </div>
      </motion.div>

      {/* Best / worst comparison (only if 2+ scenarios) */}
      {scenarios.length >= 2 && best && worst && best.id !== worst.id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5"
        >
          <ComparisonCard label="Lowest water demand" scenario={best} baselineKl={baselineKl} icon={TrendingDown} color="var(--status-feasible)" />
          <ComparisonCard label="Highest water demand" scenario={worst} baselineKl={baselineKl} icon={TrendingUp} color="var(--status-constraint)" />
        </motion.div>
      )}

      {/* What-if builder + saved scenarios */}
      <WhatIfPanel />

      {/* All scenarios as a chart-style summary */}
      {scenarios.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="nb-card p-4 sm:p-6"
        >
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-extrabold">All scenarios vs baseline</h2>
          </div>
          <div className="space-y-2">
            {/* Baseline bar */}
            <ScenarioBar label="Baseline" kL={baselineKl} baselineKl={baselineKl} isBaseline />
            {scenarios.map((s) => (
              <ScenarioBar
                key={s.id}
                label={s.label}
                kL={(s.result.waterDemand as { waterKlPerDay: number }).waterKlPerDay}
                baselineKl={baselineKl}
              />
            ))}
          </div>
        </motion.div>
      )}

      {scenarios.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="nb-card-flat p-4 sm:p-6 flex items-start gap-3"
          style={{ background: "var(--accent-yellow)" }}
        >
          <FlaskConical className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-base">
            <strong>Get started:</strong> Use the form above to run your first
            what-if scenario — try switching cooling technology or water source
            to see the impact on water demand and screening classification.
          </p>
        </motion.div>
      )}
    </div>
  );
}

function ComparisonCard({
  label, scenario, baselineKl, icon: Icon, color,
}: {
  label: string;
  scenario: ScenarioResult;
  baselineKl: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const w = scenario.result.waterDemand as { waterKlPerDay: number; waterMcmPerYear: number };
  const cls = scenario.result.classification.classification;
  const deltaPct = ((w.waterKlPerDay - baselineKl) / baselineKl) * 100;

  return (
    <div className="nb-card-flat p-4 sm:p-5" style={{ background: color }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <div className="text-xs font-extrabold uppercase tracking-wider">{label}</div>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold mb-1 break-words">{scenario.label}</div>
      <div className="text-xs sm:text-sm opacity-80 mb-3">{cls}</div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-sm">
        <div>
          <div className="text-[10px] sm:text-xs opacity-70 uppercase">Daily</div>
          <div className="font-bold text-base sm:text-lg">
            {Number(w.waterKlPerDay).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <div className="text-[10px] sm:text-xs opacity-70 uppercase">Annual</div>
          <div className="font-bold text-base sm:text-lg">{Number(w.waterMcmPerYear).toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] sm:text-xs opacity-70 uppercase">Δ vs base</div>
          <div className="font-bold text-base sm:text-lg">
            {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioBar({ label, kL, baselineKl, isBaseline }: { label: string; kL: number; baselineKl: number; isBaseline?: boolean }) {
  const pct = Math.min(100, Math.max(8, (kL / Math.max(kL, baselineKl)) * 100));
  const deltaPct = ((kL - baselineKl) / baselineKl) * 100;
  const barColor = isBaseline
    ? "var(--ink)"
    : kL < baselineKl
      ? "var(--status-feasible)"
      : kL > baselineKl
        ? "var(--status-constraint)"
        : "var(--status-conditional)";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-24 sm:w-40 text-xs sm:text-sm font-bold truncate shrink-0" title={label}>{label}</div>
      <div className="flex-1 border-[2px] border-black h-8 sm:h-9 bg-[var(--paper)] relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full flex items-center justify-end pr-1 sm:pr-2"
          style={{ background: barColor }}
        >
          <span className="text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">
            {Number(kL).toLocaleString(undefined, { maximumFractionDigits: 0 })} kL
          </span>
        </motion.div>
      </div>
      <div className="w-14 sm:w-20 text-right text-[10px] sm:text-sm font-mono font-bold" style={{ color: isBaseline ? "var(--ink)" : deltaPct < 0 ? "var(--status-feasible)" : deltaPct > 0 ? "var(--status-constraint)" : "var(--ink)" }}>
        {isBaseline ? "base" : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(0)}%`}
      </div>
    </div>
  );
}
