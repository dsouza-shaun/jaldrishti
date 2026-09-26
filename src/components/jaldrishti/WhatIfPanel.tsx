"use client";

import { useState } from "react";
import { useJalDrishti, type ScenarioResult } from "@/lib/stores/jaldrishti-store";
import { COOLING_TECH_WUE_BANDS, defaultWueForCooling } from "@/lib/engines/water-demand";
import { useToast } from "@/hooks/use-toast";
import { Beaker, Loader2, Plus } from "lucide-react";
import { titleCase } from "@/lib/report/document";

const COOLING_OPTIONS = Object.keys(COOLING_TECH_WUE_BANDS);
const WATER_SOURCES = ["groundwater", "surface", "municipal", "tanker", "mixed"];

/**
 * The scenario builder.
 *
 * Unchanged in behaviour: it posts to the same scenario endpoint, which reruns
 * the whole screening. Only the presentation changed, from a card with a
 * scrolling list to a plain form with the computed results removed, because the
 * comparison table on the page already shows them.
 */
export function WhatIfPanel() {
  const { analysis, scenarios, currentProjectId } = useJalDrishti();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("Switch to air-cooled");
  const [itLoad, setItLoad] = useState<number | "">("");
  const [pue, setPue] = useState<number | "">("");
  const [wue, setWue] = useState<number | "">("");
  const [coolingType, setCoolingType] = useState("air-cooled-chiller");
  const [proposedWaterSource, setProposedWaterSource] = useState("municipal");

  if (!analysis || !currentProjectId) return null;

  const runScenario = async () => {
    setRunning(true);
    try {
      const effectiveWue = wue !== "" ? Number(wue) : defaultWueForCooling(coolingType);
      const body: Record<string, unknown> = {
        label,
        coolingType,
        proposedWaterSource,
        wue: effectiveWue,
      };
      if (itLoad !== "") body.itLoad = Number(itLoad);
      if (pue !== "") body.pue = Number(pue);

      const response = await fetch(`/api/projects/${currentProjectId}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Failed");

      const data = await response.json();
      useJalDrishti.getState().addScenario({
        id: data.scenarioId,
        label,
        createdAt: new Date().toISOString(),
        result: data.result,
      } as ScenarioResult);
    } catch (cause) {
      toast({
        title: "Scenario failed",
        description: cause instanceof Error ? cause.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="nb-card p-4 sm:p-5">
      <div className="flex items-center gap-2 border-b-2 border-black pb-1.5 mb-4">
        <Beaker className="w-4 h-4" />
        <h2 className="nb-section-title">Build a scenario</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="md:col-span-2 xl:col-span-3">
          <label className="nb-label" htmlFor="scenario-label">
            Scenario label
          </label>
          <input
            id="scenario-label"
            className="nb-input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div>
          <label className="nb-label" htmlFor="scenario-itload">
            IT load (MW)
          </label>
          <input
            id="scenario-itload"
            type="number"
            className="nb-input"
            value={itLoad}
            onChange={(event) =>
              setItLoad(event.target.value ? parseFloat(event.target.value) : "")
            }
            placeholder="Same as baseline"
          />
        </div>

        <div>
          <label className="nb-label" htmlFor="scenario-pue">
            PUE
          </label>
          <input
            id="scenario-pue"
            type="number"
            step="0.01"
            className="nb-input"
            value={pue}
            onChange={(event) =>
              setPue(event.target.value ? parseFloat(event.target.value) : "")
            }
            placeholder="Same as baseline"
          />
        </div>

        <div>
          <label className="nb-label" htmlFor="scenario-wue">
            WUE (L/kWh)
          </label>
          <input
            id="scenario-wue"
            type="number"
            step="0.01"
            className="nb-input"
            value={wue}
            onChange={(event) =>
              setWue(event.target.value ? parseFloat(event.target.value) : "")
            }
            placeholder={String(defaultWueForCooling(coolingType))}
          />
        </div>

        <div>
          <label className="nb-label" htmlFor="scenario-cooling">
            Cooling technology
          </label>
          <select
            id="scenario-cooling"
            className="nb-input"
            value={coolingType}
            onChange={(event) => {
              setCoolingType(event.target.value);
              setWue(defaultWueForCooling(event.target.value));
            }}
          >
            {COOLING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)} (typ. {COOLING_TECH_WUE_BANDS[option].typical})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="nb-label" htmlFor="scenario-source">
            Water source
          </label>
          <select
            id="scenario-source"
            className="nb-input"
            value={proposedWaterSource}
            onChange={(event) => setProposedWaterSource(event.target.value)}
          >
            {WATER_SOURCES.map((source) => (
              <option key={source} value={source}>
                {titleCase(source)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <button
            onClick={runScenario}
            disabled={running}
            className="nb-btn nb-btn-primary w-full justify-center"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {running ? "Computing" : "Run this scenario"}
          </button>
        </div>
      </div>

      {scenarios.length > 0 && (
        <p className="text-xs text-[var(--nb-muted)] mt-4 border-t border-[var(--nb-rule)] pt-3">
          {scenarios.length} scenario{scenarios.length === 1 ? "" : "s"} computed. Results
          are listed in the comparison below.
        </p>
      )}
    </div>
  );
}
