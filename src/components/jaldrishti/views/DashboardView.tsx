"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { SiteMap } from "@/components/jaldrishti/SiteMap";
import { SatelliteMap } from "@/components/jaldrishti/SatelliteMap";
import { WaterRiskPanel } from "@/components/jaldrishti/WaterRiskPanel";
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
  { Component: WaterRiskPanel, key: "water-risk" },
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
      {/* Header — title on the left, headline water figure on the right.
          Folding the old standalone "Estimated water need" strip in here
          removes a whole redundant box from the stack, and the eyebrow
          label that used to repeat "Screening result" (already the
          headline of the classification banner right below) is gone. */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight break-words">
            {analysis.projectName}
          </h1>
          <p className="text-sm sm:text-base text-black/60 mt-1 break-words">A summary of water, environmental and planning considerations for this site.</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-black/60">Estimated water need</div>
          <div className="text-2xl font-extrabold" style={{ color: "var(--accent-red)" }}>
            {typeof dailyWater === "number" ? `${dailyWater.toLocaleString(undefined, { maximumFractionDigits: 1 })} kL/day` : "Unavailable"}
          </div>
          {typeof annualWater === "number" && <div className="text-sm text-black/65">{annualWater.toLocaleString(undefined, { maximumFractionDigits: 2 })} million m³/year</div>}
        </div>
      </motion.div>

      {/* Classification banner */}
      <ClassificationCard />
      <LiveConditionsPanel />

      {/* Map and ecological assessment. The map sets the row height; the
          ecology card is told to fill it (h-full, in EcologyPanel) rather
          than sit at its natural height with a gap underneath. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3 items-stretch">
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

      {/* Second map, deliberately separate from SiteMap: SiteMap answers
          "which regulatory polygons overlap this site", this one answers
          "what does the ground actually look like". Splitting them keeps
          either map from accumulating seven toggles. */}
      <SatelliteMap />

      <section aria-label="Screening analytics">
        <h2 className="mb-4 text-xl font-bold">Site analytics</h2>
        {/* Multi-column flow instead of a row-locked grid: each panel is a
            different height (a chart here, a short table there), so a grid
            would stretch every card in a row to match the tallest one and
            leave dead space under the shorter ones. Columns let each card
            keep its own height and the next card start right below it. */}
        <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
          {ANALYTICS.map(({ Component, key }) => (
            <div key={key} className="mb-4 break-inside-avoid"><Component /></div>
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