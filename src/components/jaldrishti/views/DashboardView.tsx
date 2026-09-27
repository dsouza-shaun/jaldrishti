"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, FileText, Sparkles, LayoutGrid, Rows3, Printer } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { ResultBanner } from "@/components/jaldrishti/ResultBanner";
import { SiteMap } from "@/components/jaldrishti/SiteMap";
import { EcologyPanel } from "@/components/jaldrishti/EcologyPanel";
import { WaterDemandPanel } from "@/components/jaldrishti/WaterDemandPanel";
import { WaterRiskPanel } from "@/components/jaldrishti/WaterRiskPanel";
import { GroundwaterPanel } from "@/components/jaldrishti/GroundwaterPanel";
import { RainfallPanel } from "@/components/jaldrishti/RainfallPanel";
import { RegulatoryPanel } from "@/components/jaldrishti/RegulatoryPanel";
import { PowerPanel } from "@/components/jaldrishti/PowerPanel";
import { LocationPanel } from "@/components/jaldrishti/LocationPanel";
import { LiveConditionsPanel } from "@/components/jaldrishti/LiveConditionsPanel";
import { EvidencePanel } from "@/components/jaldrishti/EvidencePanel";
import { ReviewStatusStrip } from "@/components/jaldrishti/ReviewStatusStrip";
import { SectionShell, DataTable, StatusChip } from "@/components/jaldrishti/Document";
import { buildRecommendations, selectHeadlineConditions } from "@/lib/report/document";
import { useReportInput } from "@/hooks/use-report-input";

const LAYOUT_KEY = "jaldrishti.dashboard.layout";

type LayoutMode = "tabs" | "sections";

interface ConstraintLike {
  key: string;
  label: string;
  outcome: string;
  kind: string;
}

interface GapLike {
  key: string;
  label: string;
  whyCritical: string;
}

interface Section {
  id: string;
  label: string;
  /** Short label for the tab strip. */
  short: string;
  render: () => React.ReactNode;
}

/**
 * The screening result dashboard.
 *
 * Two things dominate the page: the screening result and the estimated water
 * requirement, both stated exactly once in the banner at the top. Everything
 * below supports them.
 *
 * The remaining assessment is split into eight sections which the reader can
 * view either as a horizontal tab strip, one at a time, or stacked in reading
 * order. The choice is theirs and it persists.
 */
export function DashboardView() {
  const {
    analysis,
    project,
    setView,
    currentProjectId,
    dashboardLayout,
    setDashboardLayout,
  } = useJalDrishti();
  const router = useRouter();
  const [tab, setTab] = useState("result");
  // Conditions beyond the first three stay collapsed until asked for, so the
  // result is readable at a glance and the remainder is still one click away.
  const [showAllConditions, setShowAllConditions] = useState(false);

  // Layout preference is a display choice, so it belongs in local storage
  // rather than in the shared application state that the API mirrors.
  useEffect(() => {
    const stored = window.localStorage.getItem(LAYOUT_KEY);
    if (stored === "tabs" || stored === "sections") {
      if (stored !== dashboardLayout) setDashboardLayout(stored);
    }
  }, [dashboardLayout, setDashboardLayout]);

  const applyLayout = (mode: LayoutMode) => {
    setDashboardLayout(mode);
    window.localStorage.setItem(LAYOUT_KEY, mode);
  };

  const reportInput = useReportInput();

  const sections = useMemo<Section[]>(() => {
    if (!analysis) return [];

    const classification = analysis.classification;
    // The engine's flat reason list expands every constraint into its outcome
    // plus each sub-reason, which reads as twenty near-duplicate lines. The
    // headline selector collapses that to one line per constraint.
    const headline = selectHeadlineConditions(
      {
        classification: classification.classification,
        hardConstraints: classification.hardConstraints as never,
        softConstraints: classification.softConstraints as never,
        evidenceGaps: analysis.evidenceGaps as never,
        reasons: classification.reasons as never,
      },
      3,
    );
    // The store keeps these loosely typed; the engine's shapes are precise, so
    // narrow them once here rather than casting at every use site.
    const hard = (classification.hardConstraints ?? []) as unknown as ConstraintLike[];
    const soft = (classification.softConstraints ?? []) as unknown as ConstraintLike[];
    const gaps = (analysis.evidenceGaps ?? []) as unknown as GapLike[];

    return [
      {
        id: "result",
        label: "Screening Result",
        short: "Result",
        render: () => (
          <div className="space-y-5">
            <div>
              <h3 className="nb-eyebrow mb-2">Why this result</h3>
              {headline.shown.length === 0 ? (
                <p className="text-sm text-[var(--nb-muted)]">
                  No constraint or evidence gap triggered a reason.
                </p>
              ) : (
                <>
                  <ConditionList items={headline.shown} startAt={1} />
                  {headline.rest.length > 0 && (
                    showAllConditions ? (
                      <div className="mt-2.5">
                        <ConditionList items={headline.rest} startAt={headline.shown.length + 1} />
                        <button
                          onClick={() => setShowAllConditions(false)}
                          className="nb-btn !py-1 !px-2.5 text-xs mt-3"
                        >
                          Show fewer
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAllConditions(true)}
                        className="nb-btn !py-1 !px-2.5 text-xs mt-3"
                      >
                        See all {headline.total} conditions
                      </button>
                    )
                  )}
                </>
              )}
            </div>

            <DataTable
              caption="Constraints by weight"
              columns={[
                { key: "label", header: "Constraint", render: (row) => <span className="font-bold">{row.label}</span> },
                { key: "outcome", header: "Outcome", render: (row) => <span className="font-bold uppercase text-sm">{row.outcome}</span> },
                {
                  key: "weight",
                  header: "Weight",
                  render: (row) =>
                    row.kind === "hard" ? (
                      <StatusChip
                        tone="constraint"
                        title="A hard constraint. Any one of these on its own results in High Constraint, and further assessment is required."
                      >
                        Hard
                      </StatusChip>
                    ) : (
                      <StatusChip
                        tone="neutral"
                        title="A soft constraint. These do not decide the outcome alone, but they become conditions that must be addressed and confirmed."
                      >
                        Soft
                      </StatusChip>
                    ),
                },
              ]}
              rows={[...hard, ...soft]}
              rowKey={(row) => row.key}
              empty="No constraints were recorded for this site."
            />
          </div>
        ),
      },
      {
        id: "water",
        label: "Water Demand",
        short: "Water",
        render: () => <WaterDemandPanel />,
      },
      {
        id: "environment",
        label: "Site and Environment",
        short: "Site",
        render: () => (
          <div className="space-y-6">
            <div>
              <h3 className="nb-eyebrow mb-2">Site context</h3>
              <SiteMap />
            </div>
            <div>
              <h3 className="nb-eyebrow mb-2">Environmental and ecological assessment</h3>
              <EcologyPanel />
            </div>
            <div>
              <h3 className="nb-eyebrow mb-2">Resolved location</h3>
              <LocationPanel />
            </div>
          </div>
        ),
      },
      {
        id: "groundwater",
        label: "Water Source",
        short: "Source",
        render: () => (
          <div className="space-y-5">
            <DataTable
              caption="Proposed water source"
              columns={[
                { key: "field", header: "Field", render: (row) => <span className="font-semibold">{row.field}</span> },
                { key: "value", header: "Value", render: (row) => row.value },
              ]}
              rows={[
                { field: "Proposed source", value: pretty(project?.proposedWaterSource) },
                { field: "Alternative source", value: pretty(project?.alternativeWaterSource) },
                {
                  field: "Evidence status",
                  value: (
                    <StatusChip tone="conditional">
                      Project-specific verification required
                    </StatusChip>
                  ),
                },
              ]}
            />
            <div>
              <h3 className="nb-eyebrow mb-2">Regional groundwater evidence</h3>
              <GroundwaterPanel />
            </div>
          </div>
        ),
      },
      {
        id: "regulatory",
        label: "Regulatory",
        short: "Regulatory",
        render: () => <RegulatoryPanel />,
      },
      {
        id: "climate",
        label: "Climate and Water Context",
        short: "Climate",
        render: () => (
          <div className="space-y-6">
            <div>
              <h3 className="nb-eyebrow mb-2">Rainfall</h3>
              <RainfallPanel />
            </div>
            <div>
              <h3 className="nb-eyebrow mb-2">Live water risk</h3>
              <WaterRiskPanel />
            </div>
            <div>
              <h3 className="nb-eyebrow mb-2">Power generation context</h3>
              <PowerPanel />
            </div>
            <div className="border-t border-[var(--nb-rule)] pt-5">
              <LiveConditionsPanel />
            </div>
          </div>
        ),
      },
      {
        id: "verification",
        label: "Verification Required",
        short: "Verification",
        render: () => (
          <div className="space-y-4">
            <DataTable
              columns={[
                { key: "label", header: "Item", render: (row) => <span className="font-semibold">{row.label}</span> },
                { key: "why", header: "Why it matters", render: (row) => <span className="text-sm">{row.whyCritical}</span> },
              ]}
              rows={gaps}
              rowKey={(row) => row.key}
              empty="No evidence gaps were recorded. All checked sources responded."
            />
            <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
              Items above are unavailable or unverified in this screening. They must be
              confirmed before a decision is taken.
            </p>
            <div className="border-t border-[var(--nb-rule)] pt-4">
              <h3 className="nb-eyebrow mb-2">Full source register</h3>
              <EvidencePanel />
            </div>
          </div>
        ),
      },
      {
        id: "recommendations",
        label: "Recommendations",
        short: "Next steps",
        render: () => {
          const items = reportInput
            ? buildRecommendations(
                analysis as never,
                reportInput.project,
              )
            : [];
          return (
            <div className="space-y-3">
              <ol className="space-y-2">
                {items.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 border-2 border-black bg-[var(--nb-tint)] flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
                Suggested next steps derived from this screening. They are not legal
                requirements and do not establish compliance.
              </p>
            </div>
          );
        },
      },
    ];
    // showAllConditions is read inside the render closures below, so it has to
    // be a dependency. Without it the memoised sections keep the collapsed
    // closures and the "See all conditions" button appears to do nothing.
  }, [analysis, project, reportInput, showAllConditions]);

  if (!analysis) {
    return (
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-20 text-center">
        <div className="nb-card p-10">
          <h1 className="text-3xl font-extrabold mb-2">No screening result yet</h1>
          <p className="text-[var(--nb-muted)] mb-6">
            Run a screening to see the result, the estimated water requirement and the
            evidence behind both.
          </p>
          <button
            onClick={() => setView("analyze")}
            className="nb-btn nb-btn-primary text-lg"
          >
            <Search className="w-5 h-5" />
            Start screening
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  const activeIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === tab),
  );
  const active = sections[activeIndex];

  const generatedOn = new Date(analysis.generatedAt ?? Date.now());

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-8 space-y-6">
      {/* Page header. Identifies the site; deliberately quieter than the result. */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight break-words mt-0.5">
            {analysis.projectName}
          </h1>
          <p className="text-sm text-[var(--nb-muted)] mt-1">
            Screened on {generatedOn.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 nb-no-print">
          <button
            onClick={() => router.push(currentProjectId ? `/report?project=${currentProjectId}` : "/report")}
            className="nb-btn"
          >
            <FileText className="w-4 h-4" />
            View report
          </button>
          <button
            onClick={() =>
              router.push(
                currentProjectId
                  ? `/explanation?project=${currentProjectId}`
                  : "/explanation",
              )
            }
            className="nb-btn"
          >
            <Sparkles className="w-4 h-4" />
            AI explanation
          </button>
        </div>
      </header>

      {/* The result and the headline figure, stated once. */}
      <ResultBanner />

      <ReviewStatusStrip projectId={currentProjectId} />

      {/* Presentation toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 nb-no-print">
        <div
          className="inline-flex border-[3px] border-black"
          role="group"
          aria-label="Dashboard layout"
        >
          <button
            onClick={() => applyLayout("tabs")}
            aria-pressed={dashboardLayout === "tabs"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold ${
              dashboardLayout === "tabs"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] hover:bg-[var(--nb-tint)]"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Tabs
          </button>
          <button
            onClick={() => applyLayout("sections")}
            aria-pressed={dashboardLayout === "sections"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold border-l-[3px] border-black ${
              dashboardLayout === "sections"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] hover:bg-[var(--nb-tint)]"
            }`}
          >
            <Rows3 className="w-4 h-4" />
            Sections
          </button>
        </div>

        <span className="text-xs text-[var(--nb-muted)]">
          {dashboardLayout === "tabs"
            ? "Showing one section at a time"
            : "Showing every section in reading order"}
        </span>
      </div>

      {dashboardLayout === "tabs" ? (
        <div className="nb-card">
          {/* Tab strip. Arrow keys move between tabs, as in a browser. */}
          <div
            role="tablist"
            aria-label="Assessment sections"
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const delta = event.key === "ArrowRight" ? 1 : -1;
              const next = (activeIndex + delta + sections.length) % sections.length;
              setTab(sections[next].id);
              document.getElementById(`tab-${sections[next].id}`)?.focus();
            }}
            className="flex overflow-x-auto nb-scroll border-b-[3px] border-black"
          >
            {sections.map((section) => {
              const selected = section.id === active.id;
              return (
                <button
                  key={section.id}
                  id={`tab-${section.id}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${section.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(section.id)}
                  className={`shrink-0 px-3 sm:px-4 py-2.5 text-sm font-bold border-r-2 border-black whitespace-nowrap ${
                    selected
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--paper)] hover:bg-[var(--nb-tint)]"
                  }`}
                >
                  {section.short}
                </button>
              );
            })}
          </div>

          <div
            id={`panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${active.id}`}
            className="p-4 sm:p-5"
          >
            <SectionShell id={active.id} title={active.label}>
              {active.render()}
            </SectionShell>
          </div>
        </div>
      ) : (
        <div className="nb-card p-4 sm:p-6 space-y-8">
          {sections.map((section) => (
            <SectionShell key={section.id} id={section.id} title={section.label}>
              {section.render()}
            </SectionShell>
          ))}
        </div>
      )}

      <PrintHint />
    </div>
  );
}

function pretty(value: string | null | undefined): string {
  if (!value) return "Not supplied";
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * One line per condition: what was checked, and the finding.
 *
 * The engine's raw outcome and its supporting reasons stay in the full report;
 * carrying them here is what made the list read as twenty separate problems
 * rather than three.
 */
function ConditionList({
  items,
  startAt,
}: {
  items: Array<{ id: string; label: string; summary: string }>;
  startAt: number;
}) {
  return (
    <ol className="space-y-2.5">
      {items.map((condition, index) => (
        <li key={condition.id} className="flex gap-3">
          <span className="shrink-0 w-6 h-6 border-2 border-black bg-[var(--nb-tint)] flex items-center justify-center text-xs font-bold">
            {startAt + index}
          </span>
          <span className="min-w-0 text-sm leading-relaxed pt-0.5">
            <span className="font-bold">{condition.label}</span>
            {condition.summary && (
              <>
                <span className="text-[var(--nb-muted)]">: </span>
                <span className="font-semibold">{condition.summary}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PrintHint() {
  return (
    <p className="text-xs text-[var(--nb-muted)] flex items-center gap-1.5 nb-no-print">
      <Printer className="w-3.5 h-3.5" />
      The full report, including PDF and Word downloads, is on the Reports page.
    </p>
  );
}
