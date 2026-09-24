"use client";

import { motion } from "framer-motion";
import { useJalDrishti, type ScenarioResult } from "@/lib/stores/jaldrishti-store";
import { COOLING_TECH_WUE_BANDS, defaultWueForCooling } from "@/lib/engines/water-demand";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Loader2, Plus, Beaker } from "lucide-react";
import { useState } from "react";

const COOLING_OPTIONS = Object.keys(COOLING_TECH_WUE_BANDS);
const WATER_SOURCES = ["groundwater", "surface", "municipal", "tanker", "mixed"];

export function WhatIfPanel() {
  const { analysis, scenarios, addScenario, currentProjectId } = useJalDrishti();
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
        label, coolingType, proposedWaterSource, wue: effectiveWue,
      };
      if (itLoad !== "") body.itLoad = Number(itLoad);
      if (pue !== "") body.pue = Number(pue);

      const res = await fetch(`/api/projects/${currentProjectId}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      const scenario: ScenarioResult = {
        id: data.scenarioId,
        label,
        createdAt: new Date().toISOString(),
        result: data.result,
      };
      addScenario(scenario);

      // Success toast
      const w = data.result.waterDemand as { waterKlPerDay: number };
      const baselineKl = (analysis.waterDemand as { waterKlPerDay: number }).waterKlPerDay;
      const deltaPct = ((w.waterKlPerDay - baselineKl) / baselineKl) * 100;
      toast({
        title: "Scenario computed",
        description: `"${label}" → ${Number(w.waterKlPerDay).toLocaleString(undefined, { maximumFractionDigits: 0 })} kL/day (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs baseline).`,
      });
    } catch (e) {
      toast({
        title: "Scenario failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const base = analysis.waterDemand as { waterKlPerDay: number; waterMcmPerYear: number };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-6"
    >
      <div className="flex items-center justify-between border-b-[3px] border-black pb-3 mb-5">
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5" />
          <h3 className="text-xl font-extrabold">Build a scenario</h3>
        </div>
        <span className="text-xs font-mono text-black/60">
          Baseline: {Number(base.waterKlPerDay).toLocaleString(undefined, { maximumFractionDigits: 0 })} kL/day
        </span>
      </div>

      {/* Builder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <div className="md:col-span-2 lg:col-span-3">
          <label className="nb-label">Scenario label</label>
          <input className="nb-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="nb-label">IT load (MW)</label>
          <input type="number" className="nb-input" value={itLoad}
            onChange={(e) => setItLoad(e.target.value ? parseFloat(e.target.value) : "")}
            placeholder="Same as baseline" />
        </div>
        <div>
          <label className="nb-label">PUE</label>
          <input type="number" step="0.01" className="nb-input" value={pue}
            onChange={(e) => setPue(e.target.value ? parseFloat(e.target.value) : "")} placeholder="Same as baseline" />
        </div>
        <div>
          <label className="nb-label">WUE (L/kWh)</label>
          <input type="number" step="0.01" className="nb-input" value={wue}
            onChange={(e) => setWue(e.target.value ? parseFloat(e.target.value) : "")}
            placeholder={String(defaultWueForCooling(coolingType))} />
        </div>
        <div>
          <label className="nb-label">Cooling technology</label>
          <select className="nb-input" value={coolingType} onChange={(e) => {
            setCoolingType(e.target.value);
            setWue(defaultWueForCooling(e.target.value));
          }}>
            {COOLING_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())} (typ. {COOLING_TECH_WUE_BANDS[c].typical})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="nb-label">Water source</label>
          <select className="nb-input" value={proposedWaterSource} onChange={(e) => setProposedWaterSource(e.target.value)}>
            {WATER_SOURCES.map((w) => (
              <option key={w} value={w}>{w.replace(/\b\w/g, (m) => m.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ y: 0 }}
            onClick={runScenario}
            disabled={running}
            className="nb-btn nb-btn-primary w-full text-base !py-3"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            {running ? "Computing scenario..." : "Run this scenario"}
          </motion.button>
        </div>
      </div>

      {/* Scenarios list */}
      {scenarios.length > 0 && (
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-black/60 mb-3">
            Saved scenarios ({scenarios.length})
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto nb-scroll">
            {scenarios.map((s, i) => (
              <ScenarioCard key={s.id} scenario={s} baseline={base} index={i} />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function ScenarioCard({ scenario, baseline, index }: { scenario: ScenarioResult; baseline: { waterKlPerDay: number; waterMcmPerYear: number }; index: number }) {
  const w = scenario.result.waterDemand as { waterKlPerDay: number; waterMcmPerYear: number };
  const cls = scenario.result.classification.classification;
  const deltaPct = ((w.waterKlPerDay - baseline.waterKlPerDay) / baseline.waterKlPerDay) * 100;
  const deltaColor = deltaPct < 0 ? "var(--status-feasible)" : deltaPct > 0 ? "var(--status-constraint)" : "var(--ink)";

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
      whileHover={{ x: 4 }}
      className="border-[3px] border-black bg-[var(--paper)]"
    >
      <div className="flex items-stretch">
        <div
          className="px-3 py-2 text-xs font-extrabold uppercase tracking-wider border-r-[3px] border-black flex items-center"
          style={{
            background:
              cls.includes("High") ? "var(--accent-red)" :
              cls.includes("Conditions") ? "var(--accent-yellow)" :
              cls.includes("Insufficient") ? "var(--accent-orange)" :
              "var(--accent-green)",
            minWidth: 110,
            color: cls.includes("High") ? "#fff" : "#000",
          }}
        >
          {cls.split(" ")[0]}
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold text-base">{scenario.label}</div>
            <div className="text-xs font-mono text-black/60">
              {new Date(scenario.createdAt).toLocaleTimeString()}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-[10px] text-black/60 uppercase">Daily</div>
              <div className="font-bold text-base">
                {Number(w.waterKlPerDay).toLocaleString(undefined, { maximumFractionDigits: 0 })} kL
              </div>
            </div>
            <div>
              <div className="text-[10px] text-black/60 uppercase">Annual</div>
              <div className="font-bold text-base">{Number(w.waterMcmPerYear).toFixed(3)} MCM</div>
            </div>
            <div>
              <div className="text-[10px] text-black/60 uppercase">Δ vs baseline</div>
              <div className="font-bold text-base" style={{ color: deltaColor }}>
                {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
