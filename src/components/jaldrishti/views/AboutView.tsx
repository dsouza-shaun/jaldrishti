"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { REGULATORY_RULES_CATALOG } from "@/lib/rules/regulatory-rules";
import {
  Search, ArrowRight, Database, ShieldCheck, Layers, Beaker, CloudRain,
  MapPin, BookOpen, CheckCircle2,
} from "lucide-react";

const PIPELINE = [
  { n: 1, title: "Project inputs", text: "Site coordinates, IT load, PUE, WUE, cooling technology, water source.", icon: MapPin, color: "var(--accent-red)" },
  { n: 2, title: "Spatial checks", text: "Site point tested against ESZ, forest, wetland and CRZ polygons for overlaps and proximity.", icon: Layers, color: "var(--accent-purple)" },
  { n: 3, title: "Water demand", text: "Deterministic engine computes daily and annual water requirement from IT load, PUE and WUE.", icon: Beaker, color: "var(--accent-yellow)" },
  { n: 4, title: "Regulatory rules", text: "CGWA groundwater rules, environmental clearance thresholds and pollution-board requirements applied.", icon: ShieldCheck, color: "var(--accent-orange)" },
  { n: 5, title: "Classification", text: "Hard constraints, evidence gaps and soft conditions resolved into a four-way outcome.", icon: CheckCircle2, color: "var(--accent-green)" },
];

const DATASETS = [
  { title: "Groundwater resources", source: "Central Ground Water Board (CGWB) Ground Water Year Book", coverage: "Maharashtra, Telangana, Tamil Nadu", icon: Database, color: "var(--accent-red)" },
  { title: "Rainfall & climate", source: "India Meteorological Department (IMD) district-wise rainfall statistics", coverage: "10-year time-series at major stations", icon: CloudRain, color: "var(--accent-purple)" },
  { title: "Eco-sensitive zones", source: "Ministry of Environment, Forest and Climate Change (MoEFCC) notifications", coverage: "ESZ around protected areas", icon: Layers, color: "var(--accent-green)" },
  { title: "Wetlands", source: "Maharashtra State Wetland Authority / MCZMA", coverage: "Creek, mangrove and lake wetlands", icon: Database, color: "var(--accent-teal)" },
  { title: "Coastal Regulation Zone", source: "MoEFCC CRZ Notification 2018", coverage: "Coastal land strips", icon: Layers, color: "var(--accent-orange)" },
  { title: "Forest cover", source: "Forest (Conservation) Act 1980 + state forest department data", coverage: "Reserved and protected forests", icon: Database, color: "var(--status-feasible)" },
];

const EVIDENCE = [
  { label: "Verified", desc: "Comes directly from a primary government source.", color: "var(--status-verified)" },
  { label: "Proxy", desc: "Derived from a nearby station or related dataset.", color: "var(--status-proxy)" },
  { label: "Unknown", desc: "No reliable data available — never invented.", color: "var(--status-unknown)" },
];

export function AboutView() {
  const { setView } = useJalDrishti();

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-8 py-8 sm:py-10 space-y-12 sm:space-y-16">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-red)]">
          How JalDrishti works
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl">
          Transparent by design.
        </h1>
        <p className="text-base sm:text-lg text-black/70 max-w-2xl">
          JalDrishti is not a black-box score and not an AI that predicts
          feasibility. Every screening result can be traced from the final
          classification all the way back to the underlying data, source, and
          date.
        </p>
      </motion.div>

      {/* Pipeline */}
      <section>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-6 sm:mb-8">The screening pipeline</h2>
        <div className="space-y-4">
          {PIPELINE.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="nb-card p-4 sm:p-5 flex items-start gap-3 sm:gap-5"
              >
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 border-[3px] border-black flex items-center justify-center shrink-0 shadow-[3px_3px_0_0_#000]"
                  style={{ background: step.color }}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-extrabold text-black/50">STEP {step.n}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold">{step.title}</h3>
                  <p className="text-sm sm:text-base text-black/70 mt-1">{step.text}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Evidence categories */}
      <section>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">Evidence you can trust</h2>
        <p className="text-base sm:text-lg text-black/70 mb-5 sm:mb-6 max-w-2xl">
          Every data point carries an evidence label. JalDrishti never invents
          values — when data is missing, it says so.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {EVIDENCE.map((e, i) => (
            <motion.div
              key={e.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="nb-card-flat p-4 sm:p-5"
              style={{ background: e.color }}
            >
              <div className="text-lg sm:text-xl font-extrabold mb-1">{e.label}</div>
              <div className="text-sm opacity-85">{e.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Datasets */}
      <section>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">Datasets used</h2>
        <p className="text-base sm:text-lg text-black/70 mb-5 sm:mb-6 max-w-2xl">
          Real Indian government datasets, periodically refreshed. No
          fabricated values.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DATASETS.map((d, i) => {
            const Icon = d.icon;
            return (
              <motion.div
                key={d.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="nb-card-flat p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 border-[3px] border-black flex items-center justify-center shrink-0"
                    style={{ background: d.color }}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold">{d.title}</h3>
                    <p className="text-xs sm:text-sm text-black/70 mt-0.5">{d.source}</p>
                    <p className="text-[10px] sm:text-xs text-black/50 mt-1 font-mono">{d.coverage}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Rules */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-6 h-6" />
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Rules applied</h2>
        </div>
        <p className="text-base sm:text-lg text-black/70 mb-5 sm:mb-6 max-w-2xl">
          Each rule references the actual Indian regulation it implements.
          Rules are kept separate from the application code so they remain
          auditable.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REGULATORY_RULES_CATALOG.map((r, i) => (
            <motion.div
              key={r.ruleCode}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="nb-card-flat p-3 sm:p-4"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--accent-red)]">{r.ruleCode}</span>
                <span className="nb-badge !text-[9px] sm:!text-xs" style={{ background: "var(--accent-yellow)" }}>{r.domain}</span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold leading-tight">{r.title}</h3>
              <p className="text-xs sm:text-sm text-black/70 mt-1">{r.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Disclaimer + CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="nb-card-flat p-4 sm:p-6"
        style={{ background: "var(--accent-yellow)" }}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold mb-1">Important</h3>
            <p className="text-sm sm:text-base text-black/80 leading-relaxed">
              JalDrishti is a pre-development screening aid, not a regulatory
              approval. All classifications should be reviewed by qualified
              environmental and legal consultants before any investment
              decision. Missing data is flagged as <strong>Unknown</strong> —
              it is never silently filled in.
            </p>
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <div className="text-center pb-8">
        <button onClick={() => setView("analyze")} className="nb-btn nb-btn-primary text-lg !py-3.5 !px-7">
          <Search className="w-5 h-5" />
          Run your first screening
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
