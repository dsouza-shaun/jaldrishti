"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { SiteMap } from "@/components/jaldrishti/SiteMap";
import { ClassificationCard } from "@/components/jaldrishti/ClassificationCard";
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

const PANELS = [
  { Comp: LocationPanel, key: "location" },
  { Comp: WaterDemandPanel, key: "water" },
  { Comp: GroundwaterPanel, key: "gw" },
  { Comp: RainfallPanel,    key: "rf" },
  { Comp: RegulatoryPanel,  key: "reg" },
  { Comp: PowerPanel,       key: "pow" },
  { Comp: AIExplanationPanel, key: "ai" },
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
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight break-words">
            {analysis.projectName}
          </h1>
          <p className="text-sm sm:text-base text-black/60 mt-1 break-words">
            Site: {analysis.site.latitude.toFixed(4)}, {analysis.site.longitude.toFixed(4)} · Generated {new Date(analysis.generatedAt).toLocaleString()}
          </p>
        </div>
      </motion.div>

      {/* Classification banner */}
      <ClassificationCard />

      {/* Map + Ecology summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 60 }}
          className="lg:col-span-3"
        >
          <SiteMap />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 60, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <EcologyPanel />
        </motion.div>
      </div>

      {/* Evidence panels grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-3 sm:mb-4 mt-2">Site evidence</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {PANELS.map(({ Comp, key }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 80 }}
            >
              <Comp />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Full provenance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <EvidencePanel />
      </motion.div>
    </div>
  );
}
