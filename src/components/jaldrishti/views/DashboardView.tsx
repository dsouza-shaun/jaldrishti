"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { SiteMap } from "@/components/jaldrishti/SiteMap";
import { ClassificationCard } from "@/components/jaldrishti/ClassificationCard";
import { LiveConditionsPanel } from "@/components/jaldrishti/LiveConditionsPanel";
import { WaterDemandPanel } from "@/components/jaldrishti/WaterDemandPanel";
import { LocationPanel } from "@/components/jaldrishti/LocationPanel";
import { GroundwaterPanel } from "@/components/jaldrishti/GroundwaterPanel";
import { RainfallPanel } from "@/components/jaldrishti/RainfallPanel";
import { RegulatoryPanel } from "@/components/jaldrishti/RegulatoryPanel";
import { EcologyPanel } from "@/components/jaldrishti/EcologyPanel";
import { PowerPanel } from "@/components/jaldrishti/PowerPanel";
import { EvidencePanel } from "@/components/jaldrishti/EvidencePanel";
import { AIExplanationPanel } from "@/components/jaldrishti/AIExplanationPanel";
import { Search, ArrowRight } from "lucide-react";

const ANALYTICS = [
  { Component: WaterDemandPanel, key: "water" },
  { Component: GroundwaterPanel, key: "groundwater" },
  { Component: RainfallPanel, key: "rainfall" },
  { Component: RegulatoryPanel, key: "regulatory" },
  { Component: PowerPanel, key: "power" },
  { Component: LocationPanel, key: "location" },
  { Component: AIExplanationPanel, key: "explanation" },
] as const;

export function DashboardView() {
  const { analysis, setView } = useJalDrishti();

  if (!analysis) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="nb-card p-12"
          style={{ background: "var(--accent-yellow)" }}
        >
          <h1 className="text-4xl font-extrabold mb-3">No analysis yet</h1>
          <p className="text-lg text-black/70 mb-6">
            Run a screening first to see the full dashboard.
          </p>
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ y: 0 }}
            onClick={() => setView("analyze")}
            className="nb-btn nb-btn-primary text-lg !py-3 !px-6 mx-auto"
          >
            <Search className="w-5 h-5" />
            Start screening
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const dailyWater = analysis.waterDemand.waterKlPerDay;
  const annualWater = analysis.waterDemand.waterMcmPerYear;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-red)] mb-1">
            Screening result
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight break-words">
            {analysis.projectName}
          </h1>
          <p className="text-sm sm:text-base text-black/60 mt-1 break-words">A summary of water, environmental and planning considerations for this site.</p>
        </div>
      </motion.div>

      {/* Classification banner */}
      <ClassificationCard />
      <section className="nb-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-base font-bold">Estimated water need</h2>
          <p className="text-xs text-black/60">Calculated from the project size and cooling choice</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold">{typeof dailyWater === "number" ? `${dailyWater.toLocaleString(undefined, { maximumFractionDigits: 1 })} kL/day` : "Unavailable"}</div>
          {typeof annualWater === "number" && <div className="text-sm text-black/65">{annualWater.toLocaleString(undefined, { maximumFractionDigits: 2 })} million m³/year</div>}
        </div>
      </section>
      <LiveConditionsPanel />

      {/* Map and ecological assessment */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 60 }}
          className="xl:col-span-2"
        >
          <SiteMap />
        </motion.div>
        <div className="min-w-0"><EcologyPanel /></div>
      </div>

      <section aria-label="Screening analytics">
        <h2 className="mb-4 text-xl font-bold">Site analytics</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {ANALYTICS.map(({ Component, key }) => (
            <div key={key} className="min-w-0"><Component /></div>
          ))}
        </div>
      </section>

      <details className="nb-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Data sources and coverage</summary>
        <div className="mt-4"><EvidencePanel /></div>
      </details>

    </div>
  );
}
