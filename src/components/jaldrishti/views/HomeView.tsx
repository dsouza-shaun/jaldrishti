"use client";

import { Search, ArrowRight, Droplets, Layers, ShieldCheck, FileSearch, Info } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { StatusChip } from "@/components/jaldrishti/Document";

/**
 * The four screening lenses. One ink square each, no per-card colour, because
 * colour on this page would compete with the result colours the user meets on
 * the dashboard.
 */
const LENSES = [
  {
    icon: Droplets,
    title: "Water demand",
    text: "Daily and annual demand calculated from IT load, PUE, WUE and the cooling technology, with the derivation shown.",
  },
  {
    icon: Layers,
    title: "Environmental constraints",
    text: "Overlap tested against eco-sensitive zones, forest, wetland and coastal regulation boundaries.",
  },
  {
    icon: ShieldCheck,
    title: "Regulatory screening",
    text: "Groundwater extraction, environmental clearance and consent checks, each with its rule and its source.",
  },
  {
    icon: FileSearch,
    title: "Site evidence",
    text: "Rainfall, groundwater and water-risk context, each marked as sourced, modelled or needing verification.",
  },
];

const OUTCOMES = [
  { label: "Feasible", desc: "No constraint was triggered by the available evidence.", tone: "feasible" as const },
  { label: "Feasible with conditions", desc: "Constraints were detected and must be addressed.", tone: "conditional" as const },
  { label: "Data insufficient", desc: "Required evidence was unavailable, so no conclusion follows.", tone: "insufficient" as const },
  { label: "High constraint", desc: "A hard constraint was triggered and further assessment is required.", tone: "constraint" as const },
];

export function HomeView() {
  const { setView } = useJalDrishti();

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 md:px-8 py-10 sm:py-14 space-y-12 sm:space-y-16">
      {/* Purpose */}
      <section>
        <div className="nb-eyebrow">Pre-development screening</div>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.05] tracking-tight mt-2 max-w-3xl">
          Know the water risk before you build.
        </h1>
        <p className="text-base sm:text-lg text-[var(--nb-muted)] mt-4 max-w-2xl leading-relaxed">
          JalDrishti screens proposed data-centre sites in India for water demand,
          environmental constraints, regulatory considerations and site evidence, and
          produces an explainable preliminary screening result.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={() => setView("analyze")} className="nb-btn nb-btn-primary text-base !py-3 !px-5">
            <Search className="w-5 h-5" />
            Start screening
            <ArrowRight className="w-5 h-5" />
          </button>
          <button onClick={() => setView("about")} className="nb-btn text-base !py-3 !px-5">
            <Info className="w-4 h-4" />
            How it works
          </button>
        </div>
      </section>

      {/* The four lenses */}
      <section>
        <div className="border-b-2 border-black pb-1 mb-4">
          <h2 className="nb-section-title">What a screening covers</h2>
        </div>
        <div className="nb-card">
          {LENSES.map((lens, index) => {
            const Icon = lens.icon;
            return (
              <div
                key={lens.title}
                className={`flex gap-4 p-4 sm:p-5 ${
                  index > 0 ? "border-t border-[var(--nb-rule)]" : ""
                }`}
              >
                <div className="shrink-0 w-9 h-9 border-[3px] border-black bg-[var(--nb-tint)] flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold">{lens.title}</h3>
                  <p className="text-sm text-[var(--nb-muted)] mt-0.5 leading-relaxed">
                    {lens.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Outcomes */}
      <section>
        <div className="border-b-2 border-black pb-1 mb-4">
          <h2 className="nb-section-title">Screening outcomes</h2>
        </div>
        <p className="text-sm text-[var(--nb-muted)] mb-4 max-w-2xl">
          Every site is classified into one of four outcomes by the rule engine. Each one
          is backed by the constraints and evidence that produced it.
        </p>
        <div className="nb-card divide-y divide-[var(--nb-rule)]">
          {OUTCOMES.map((outcome) => (
            <div key={outcome.label} className="flex flex-wrap items-center gap-3 p-4">
              <StatusChip tone={outcome.tone}>{outcome.label}</StatusChip>
              <span className="text-sm text-[var(--nb-muted)]">{outcome.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Standing position */}
      <section className="nb-card-flat p-5 bg-[var(--nb-tint)]">
        <div className="nb-eyebrow mb-1.5">What this is not</div>
        <p className="text-sm leading-relaxed max-w-3xl">
          JalDrishti provides preliminary decision support. It is not the authority, and a
          screening result is not an approval, a consent or a statement of legal
          compliance. Every figure is either calculated from the submitted parameters,
          sourced from a named dataset, or marked as needing verification. Project-specific
          entitlements, allocations and permissions must be confirmed with the relevant
          authority.
        </p>
      </section>
    </div>
  );
}
