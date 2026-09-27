"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { REGULATORY_RULES_CATALOG } from "@/lib/rules/regulatory-rules";
import {
  Search, ArrowRight, Database, ShieldCheck, Layers, Beaker, CloudRain,
  MapPin, BookOpen, CheckCircle2, Droplets, Waves, HardHat, Building2,
} from "lucide-react";

const PIPELINE = [
  { n: 1, title: "Project inputs", text: "Site coordinates, IT load, PUE, WUE, cooling technology, water source.", icon: MapPin },
  { n: 2, title: "Spatial checks", text: "Site point tested against ESZ, forest, wetland and CRZ polygons for overlaps and proximity.", icon: Layers },
  { n: 3, title: "Water demand", text: "Deterministic engine computes daily and annual water requirement from IT load, PUE and WUE.", icon: Beaker },
  { n: 4, title: "Regulatory rules", text: "CGWA groundwater rules, environmental clearance thresholds and pollution-board requirements applied.", icon: ShieldCheck },
  { n: 5, title: "Classification", text: "Hard constraints, evidence gaps and soft conditions resolved into a four-way outcome.", icon: CheckCircle2 },
];

const DATASETS = [
  { title: "Water risk, sector-weighted", source: "WRI Aqueduct 4.0, via the Esri India Living Atlas", coverage: "Aquifer water stress and depletion, with a Semiconductor and Electric Power weighting", icon: Droplets },
  { title: "Groundwater resources", source: "Central Ground Water Board (CGWB) Ground Water Year Book", coverage: "District-level recharge, extraction and stage of extraction", icon: Database },
  { title: "District water context", source: "India district-level water quality and scarcity estimates, via Esri India Living Atlas", coverage: "Assessment-unit status, JRC surface water extent, IMD rainfall variability, aquifer geology", icon: Waves },
  { title: "Ground water map", source: "National Water Mission - Jal Shakti (live WMS relay)", coverage: "Monitoring stations and state availability surface, when a session is configured", icon: Database },
  { title: "Rainfall and climate", source: "India Meteorological Department (IMD) district-wise rainfall statistics", coverage: "1901-2015 subdivision time-series and live Open-Meteo conditions", icon: CloudRain },
  { title: "Power plants", source: "Global Power Plant Database (WRI) derivative", coverage: "Installed capacity, fuel type and commissioning year", icon: Database },
  { title: "Live basemap and ecology", source: "OpenStreetMap via OpenMapTiles and OpenFreeMap, plus the Overpass API", coverage: "Forests, wetlands, protected areas, coastlines and surface water", icon: Layers },
];

const EVIDENCE = [
  { label: "Calculated", desc: "Derived from the submitted project inputs using a published formula, such as facility energy multiplied by WUE." },
  { label: "Sourced", desc: "Read from a named public dataset or official record, with the source and its date recorded alongside the value." },
  { label: "Needs verification", desc: "Project-specific detail that only the applicant or the authority can confirm, such as a water allocation or entitlement." },
];

const ROLES = [
  {
    icon: HardHat,
    title: "Developer",
    text: "Submits a site and its project parameters, runs the screening, explores scenarios, and submits the resulting report for review.",
  },
  {
    icon: Building2,
    title: "Authority",
    text: "Reviews submitted screenings against the evidence, and records an assessment with comments. A recorded decision is a review record, not a statutory approval.",
  },
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
                  className="w-12 h-12 sm:w-14 sm:h-14 border-[3px] border-black bg-[var(--nb-tint)] flex items-center justify-center shrink-0"
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.2} />
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
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">How evidence is labelled</h2>
        <p className="text-base text-[var(--nb-muted)] mb-5 max-w-2xl">
          Every value in a screening carries one of three labels. JalDrishti does not
          invent values: when data is missing, it says so.
        </p>
        <div className="nb-card">
          {EVIDENCE.map((item, index) => (
            <div
              key={item.label}
              className={`p-4 sm:p-5 ${index > 0 ? "border-t border-[var(--nb-rule)]" : ""}`}
            >
              <div className="font-extrabold">{item.label}</div>
              <div className="text-sm text-[var(--nb-muted)] mt-0.5 leading-relaxed">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Roles and access</h2>
        <p className="text-base text-[var(--nb-muted)] mb-5 max-w-2xl">
          Sign-in is required. A Developer sees only the projects they submitted; an
          Authority sees every submitted project in order to review it.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.title} className="nb-card-flat p-4 sm:p-5 flex gap-3">
                <div className="shrink-0 w-9 h-9 border-[3px] border-black bg-[var(--nb-tint)] flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold">{role.title}</h3>
                  <p className="text-sm text-[var(--nb-muted)] mt-0.5 leading-relaxed">
                    {role.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="nb-card-flat p-4 sm:p-5 mt-4 bg-[var(--nb-tint)]">
          <div className="nb-eyebrow mb-1.5">Prototype scope</div>
          <p className="text-sm leading-relaxed">
            Authentication is a working demonstration, not a production-grade identity
            system. Passwords are bcrypt-hashed and sessions are server-side records, but
            there is no password reset, no email verification, no multi-factor
            authentication and no lockout after repeated failures. The existing per-IP
            rate limiter is the only brute-force mitigation. Deployments intended for
            official use need a proper identity provider.
          </p>
          <div className="mt-3 pt-3 border-t border-[var(--nb-rule)]">
            <div className="nb-eyebrow mb-1">Demo accounts</div>
            <ul className="text-sm font-mono space-y-0.5">
              <li>developer / dev@demo</li>
              <li>developer2 / dev2@demo</li>
              <li>authority / auth@demo</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Datasets */}
      <section>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">Datasets used</h2>
        <p className="text-base sm:text-lg text-black/70 mb-5 sm:mb-6 max-w-2xl">
          Government datasets provide local context, while live services add current weather and location details when available.
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
                  <div className="w-9 h-9 sm:w-10 sm:h-10 border-[3px] border-black bg-[var(--nb-tint)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold">{d.title}</h3>
                    <p className="text-xs sm:text-sm text-black/70 mt-0.5">{d.source}</p>
                    <p className="text-xs text-black/50 mt-1 font-mono">{d.coverage}</p>
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
                <span className="text-xs font-mono font-bold text-[var(--accent-red)]">{r.ruleCode}</span>
                <span className="nb-badge !text-xs" style={{ background: "var(--nb-tint)" }}>{r.domain}</span>
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
        style={{ background: "var(--nb-tint)" }}
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
