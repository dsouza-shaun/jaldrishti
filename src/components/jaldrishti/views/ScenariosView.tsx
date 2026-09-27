"use client";

import { useMemo, useState } from "react";
import { Search, ArrowRight, Loader2, TrendingDown, TrendingUp, Minus, Zap } from "lucide-react";
import { useJalDrishti, type ScenarioResult } from "@/lib/stores/jaldrishti-store";
import { WhatIfPanel } from "@/components/jaldrishti/WhatIfPanel";
import { DataTable, Metric, SectionShell, StatusChip, classificationTone } from "@/components/jaldrishti/Document";
import { COOLING_TECH_WUE_BANDS, defaultWueForCooling } from "@/lib/engines/water-demand";
import { useToast } from "@/hooks/use-toast";
import { buildRecommendations, titleCase } from "@/lib/report/document";
import { useReportInput } from "@/hooks/use-report-input";

interface WaterReading {
  waterKlPerDay: number;
  waterMcmPerYear: number;
  waterMld: number;
  facilityEnergyMwhPerDay: number;
}

function readWater(result: unknown): WaterReading {
  const w = (result as { waterDemand?: Partial<WaterReading> } | null)?.waterDemand ?? {};
  return {
    waterKlPerDay: Number(w.waterKlPerDay ?? 0),
    waterMcmPerYear: Number(w.waterMcmPerYear ?? 0),
    waterMld: Number(w.waterMld ?? 0),
    facilityEnergyMwhPerDay: Number(w.facilityEnergyMwhPerDay ?? 0),
  };
}

function kl(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

/**
 * Scenario and mitigation analysis.
 *
 * Every number here comes from the real engine, which recomputes the whole
 * screening for each scenario. The chart answers one question: how much did this
 * change move total water demand. It plots total demand rather than freshwater
 * because the screening does not model a freshwater and reclaimed split, and
 * inventing one would misstate what the system knows.
 */
export function ScenariosView() {
  const { analysis, scenarios, setView, currentProjectId } = useJalDrishti();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const reportInput = useReportInput();

  const baseline = analysis ? readWater(analysis) : null;
  const baselineClass = analysis?.classification.classification ?? "";

  const rows = useMemo(
    () =>
      scenarios.map((scenario) => {
        const water = readWater(scenario.result);
        const delta = baseline ? water.waterKlPerDay - baseline.waterKlPerDay : 0;
        const percent = baseline && baseline.waterKlPerDay > 0 ? (delta / baseline.waterKlPerDay) * 100 : 0;
        return {
          scenario,
          water,
          delta,
          percent,
          classification: scenario.result.classification.classification,
        };
      }),
    [scenarios, baseline],
  );

  if (!analysis || !baseline || !currentProjectId) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-20 text-center">
        <div className="nb-card p-10">
          <h1 className="text-2xl font-extrabold mb-2">Run a screening first</h1>
          <p className="text-[var(--nb-muted)] mb-6">
            A scenario is compared against a baseline result, so there has to be one.
          </p>
          <button onClick={() => setView("analyze")} className="nb-btn nb-btn-primary text-lg">
            <Search className="w-5 h-5" />
            Start screening
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  const active =
    rows.find((row) => row.scenario.id === selected) ?? rows[0] ?? null;

  /**
   * Mitigation presets.
   *
   * Each preset is only a change to the submitted parameters, sent through the
   * existing scenario endpoint so the engine recomputes the full screening. No
   * preset invents a rule or a threshold; a cooling change simply adopts the
   * published typical WUE for that technology.
   */
  const runPreset = async (
    key: string,
    label: string,
    patch: Record<string, unknown>,
  ) => {
    setRunning(key);
    try {
      const response = await fetch(`/api/projects/${currentProjectId}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, ...patch }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Failed");

      const water = readWater(data.result);
      const delta = water.waterKlPerDay - baseline.waterKlPerDay;
      const percent = baseline.waterKlPerDay > 0 ? (delta / baseline.waterKlPerDay) * 100 : 0;

      useJalDrishti.getState().addScenario({
        id: data.scenarioId,
        label,
        createdAt: new Date().toISOString(),
        result: data.result,
      });
      setSelected(data.scenarioId);

      toast({
        title: "Scenario computed",
        description: `${kl(water.waterKlPerDay)} kL/day, ${percent >= 0 ? "+" : ""}${percent.toFixed(1)}% against baseline.`,
      });
    } catch (cause) {
      toast({
        title: "Scenario failed",
        description: cause instanceof Error ? cause.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(null);
    }
  };

  const project = reportInput?.project;
  const currentCooling = project?.coolingType ?? "water-cooled-chiller";
  const band = COOLING_TECH_WUE_BANDS[currentCooling];
  const wueImprovementPossible = band ? project!.wue > band.low : false;
  const alternative = project?.alternativeWaterSource;
  const alternativePossible = Boolean(alternative) && alternative !== project?.proposedWaterSource;

  const presets = [
    {
      key: "wue",
      label: "Improve WUE to the published low end",
      enabled: wueImprovementPossible,
      note: band ? `${project!.wue} to ${band.low} L/kWh` : "",
      run: () =>
        runPreset("wue", "Improve WUE", {
          coolingType: currentCooling,
          wue: band.low,
        }),
    },
    {
      key: "air",
      label: "Switch to air-cooled chiller",
      enabled: currentCooling !== "air-cooled-chiller",
      note: `WUE ${defaultWueForCooling("air-cooled-chiller")} L/kWh`,
      run: () =>
        runPreset("air", "Switch to air-cooled", {
          coolingType: "air-cooled-chiller",
          wue: defaultWueForCooling("air-cooled-chiller"),
        }),
    },
    {
      key: "dlc",
      label: "Switch to direct liquid cooling",
      enabled: currentCooling !== "direct-liquid",
      note: `WUE ${defaultWueForCooling("direct-liquid")} L/kWh`,
      run: () =>
        runPreset("dlc", "Switch to direct liquid cooling", {
          coolingType: "direct-liquid",
          wue: defaultWueForCooling("direct-liquid"),
        }),
    },
    {
      key: "source",
      label: "Use the alternative water source",
      enabled: alternativePossible,
      note: alternative ? titleCase(alternative) : "No alternative was submitted",
      run: () =>
        runPreset("source", "Alternative water source", {
          proposedWaterSource: alternative,
        }),
    },
  ];

  const maxDemand = Math.max(
    baseline.waterKlPerDay,
    ...rows.map((row) => row.water.waterKlPerDay),
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-8 space-y-6">
      <header>
        <div className="nb-eyebrow">What-if analysis</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
          Scenarios and mitigation
        </h1>
        <p className="text-sm text-[var(--nb-muted)] mt-1 max-w-3xl">
          Change a parameter and the full screening is recomputed from scratch. Compare
          the outcome against the baseline below.
        </p>
      </header>

      {/* Baseline. The reference every scenario is measured against. */}
      <div className="nb-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="nb-eyebrow">Baseline</div>
            <div className="text-lg font-extrabold break-words">{analysis.projectName}</div>
            <div className="mt-1">
              <StatusChip tone={classificationTone(baselineClass)}>
                {baselineClass}
              </StatusChip>
            </div>
          </div>
          <Metric
            label="Total water demand"
            value={kl(baseline.waterKlPerDay)}
            unit="kL/day"
            note={`${baseline.waterMcmPerYear.toFixed(3)} MCM/year, ${baseline.waterMld.toFixed(2)} MLD`}
          />
        </div>
      </div>

      {/* Presets */}
      <div className="nb-card p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b-2 border-black pb-1.5 mb-3">
          <Zap className="w-4 h-4" />
          <h2 className="nb-section-title">Mitigation presets</h2>
        </div>
        <p className="text-sm text-[var(--nb-muted)] mb-3">
          Each preset is a change to the submitted parameters, recomputed by the same
          engine. Disabled presets are already the current configuration.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.key}
              onClick={preset.run}
              disabled={!preset.enabled || running !== null}
              className="text-left border-[3px] border-black p-3 bg-[var(--paper)] hover:bg-[var(--nb-tint)] disabled:opacity-45 disabled:hover:bg-[var(--paper)] disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1.5 text-sm font-bold">
                {running === preset.key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                {preset.label}
              </div>
              <div className="text-xs text-[var(--nb-muted)] mt-0.5 font-mono">
                {preset.note}
              </div>
            </button>
          ))}
        </div>
      </div>

      <WhatIfPanel />

      {rows.length === 0 ? (
        <div className="nb-card-flat p-4 flex items-start gap-3 bg-[var(--nb-tint)]">
          <p className="text-sm text-[var(--nb-muted)] max-w-2xl">
            No scenarios yet. Apply a preset above, or use the form to change IT load,
            PUE, WUE, cooling technology or water source.
          </p>
        </div>
      ) : (
        <>
          {/* Comparison table */}
          <SectionShell
            id="comparison"
            title="Baseline compared with each scenario"
            description="Every value is recalculated by the screening engine. Select a row to see the before and after."
          >
            <DataTable
              columns={[
                {
                  key: "label",
                  header: "Scenario",
                  render: (row) => (
                    <button
                      onClick={() => setSelected(row.scenario.id)}
                      className={`text-left font-semibold underline-offset-2 ${
                        active?.scenario.id === row.scenario.id
                          ? "underline decoration-2"
                          : "hover:underline"
                      }`}
                    >
                      {row.scenario.label}
                    </button>
                  ),
                },
                {
                  key: "daily",
                  header: "Water demand (kL/day)",
                  align: "right",
                  render: (row) => (
                    <span className="font-mono font-bold">{kl(row.water.waterKlPerDay)}</span>
                  ),
                },
                {
                  key: "annual",
                  header: "Annual (MCM/yr)",
                  align: "right",
                  render: (row) => (
                    <span className="font-mono">{row.water.waterMcmPerYear.toFixed(3)}</span>
                  ),
                },
                {
                  key: "mld",
                  header: "MLD",
                  align: "right",
                  render: (row) => (
                    <span className="font-mono">{row.water.waterMld.toFixed(2)}</span>
                  ),
                },
                {
                  key: "energy",
                  header: "Facility energy (MWh/day)",
                  align: "right",
                  render: (row) => (
                    <span className="font-mono">
                      {row.water.facilityEnergyMwhPerDay.toFixed(0)}
                    </span>
                  ),
                },
                {
                  key: "change",
                  header: "Change",
                  align: "right",
                  render: (row) => <ChangeCell percent={row.percent} />,
                },
                {
                  key: "outcome",
                  header: "Screening outcome",
                  render: (row) => (
                    <StatusChip tone={classificationTone(row.classification)}>
                      {row.classification}
                    </StatusChip>
                  ),
                },
              ]}
              rows={rows}
              rowKey={(row) => row.scenario.id}
            />
          </SectionShell>

          {/* Reduction chart */}
          <SectionShell
            id="reduction"
            title="Total water demand reduction"
            description="How much total water demand each intervention removes, against the baseline."
          >
            <div className="space-y-2">
              <Bar
                label="Baseline"
                value={baseline.waterKlPerDay}
                max={maxDemand}
                isBaseline
              />
              {rows.map((row) => (
                <Bar
                  key={row.scenario.id}
                  label={row.scenario.label}
                  value={row.water.waterKlPerDay}
                  max={maxDemand}
                  highlight={active?.scenario.id === row.scenario.id}
                />
              ))}
            </div>
            <p className="text-xs text-[var(--nb-muted)] mt-3 leading-relaxed">
              This is total water demand. The screening does not split demand into
              freshwater and reclaimed components, so no freshwater-specific reduction is
              shown.
            </p>
          </SectionShell>

          {/* Before and after */}
          {active && (
            <SectionShell
              id="before-after"
              title={`Before and after: ${active.scenario.label}`}
              description="What this intervention changed."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ComparisonColumn
                  title="Baseline"
                  classification={baselineClass}
                  water={baseline}
                  delta={null}
                />
                <ComparisonColumn
                  title={active.scenario.label}
                  classification={active.classification}
                  water={active.water}
                  delta={active}
                />
              </div>

              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t-2 border-black pt-4">
                <Figure
                  label="Water demand saved"
                  value={`${kl(Math.abs(active.delta))} kL/day`}
                  note={
                    active.delta <= 0 ? "a reduction" : "an increase against baseline"
                  }
                />
                <Figure
                  label="Change"
                  value={`${active.percent >= 0 ? "+" : ""}${active.percent.toFixed(1)}%`}
                />
                <Figure
                  label="Screening outcome"
                  value={
                    active.classification === baselineClass
                      ? "Unchanged"
                      : `Changed to ${active.classification}`
                  }
                  note={
                    active.classification === baselineClass
                      ? "The rules produced the same classification."
                      : "The rules produced a different classification."
                  }
                />
              </dl>
            </SectionShell>
          )}
        </>
      )}

      {/* Recommendations, derived from findings rather than authored. */}
      {reportInput && (
        <SectionShell
          id="recommendations"
          title="Pre-development recommendations"
          description="Generated from the structured findings of this screening."
        >
          <ol className="space-y-2">
            {buildRecommendations(
              analysis as never,
              reportInput.project,
            ).map((item, index) => (
              <li key={index} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 border-2 border-black bg-[var(--nb-tint)] flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed pt-0.5">{item}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[var(--nb-muted)] mt-3 leading-relaxed">
            Suggested next steps derived from this screening. They are not legal
            requirements.
          </p>
        </SectionShell>
      )}
    </div>
  );
}

function ChangeCell({ percent }: { percent: number }) {
  const Icon =
    percent < -0.05 ? TrendingDown : percent > 0.05 ? TrendingUp : Minus;
  return (
    <span
      className="font-mono font-bold inline-flex items-center gap-1 justify-end"
      style={{
        color:
          percent < -0.05
            ? "var(--status-feasible)"
            : percent > 0.05
              ? "var(--status-constraint)"
              : "var(--ink)",
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {percent >= 0 ? "+" : ""}
      {percent.toFixed(1)}%
    </span>
  );
}

/**
 * One horizontal bar. A single ink fill, with the selected scenario outlined
 * rather than recoloured, so the chart reads as one series.
 */
function Bar({
  label,
  value,
  max,
  isBaseline,
  highlight,
}: {
  label: string;
  value: number;
  max: number;
  isBaseline?: boolean;
  highlight?: boolean;
}) {
  const percent = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-28 sm:w-44 text-xs font-semibold truncate shrink-0"
        title={label}
      >
        {label}
      </div>
      <div
        className={`flex-1 h-8 bg-[var(--paper)] relative ${
          highlight ? "border-[3px] border-black" : "border-2 border-[var(--nb-rule)]"
        }`}
      >
        <div
          className="h-full flex items-center justify-end pr-2"
          style={{
            width: `${percent}%`,
            background: isBaseline ? "var(--ink)" : "var(--nb-muted)",
          }}
        >
          <span className="text-xs font-bold text-white whitespace-nowrap">
            {kl(value)} kL
          </span>
        </div>
      </div>
    </div>
  );
}

function ComparisonColumn({
  title,
  classification,
  water,
  delta,
}: {
  title: string;
  classification: string;
  water: WaterReading;
  delta: { percent: number } | null;
}) {
  return (
    <div className="nb-card-flat p-4">
      <div className="nb-eyebrow mb-1">{title}</div>
      <div className="font-extrabold text-lg leading-tight mb-1">{kl(water.waterKlPerDay)} kL/day</div>
      <div className="text-xs text-[var(--nb-muted)] font-mono mb-2">
        {water.waterMcmPerYear.toFixed(3)} MCM/year
      </div>
      <StatusChip tone={classificationTone(classification)}>{classification}</StatusChip>
      {delta && <ChangeCell percent={delta.percent} />}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="nb-metric-label">{label}</dt>
      <dd className="mt-0.5 font-bold text-lg leading-tight break-words">{value}</dd>
      {note && <dd className="text-xs text-[var(--nb-muted)] mt-0.5">{note}</dd>}
    </div>
  );
}

export type { ScenarioResult };
