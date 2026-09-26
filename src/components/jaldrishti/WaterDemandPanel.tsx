"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable, StatusChip } from "@/components/jaldrishti/Document";
import { titleCase } from "@/lib/report/document";

/**
 * Water demand, presented as a calculation trace rather than four coloured
 * tiles. The submitted parameters sit above the outputs so a reader can check
 * the arithmetic, and the formula line makes the derivation explicit.
 */
export function WaterDemandPanel() {
  const { analysis, project } = useJalDrishti();
  if (!analysis) return null;

  const w = analysis.waterDemand as unknown as {
    waterKlPerDay: number;
    waterMcmPerYear: number;
    facilityEnergyMwhPerDay: number;
    facilityEnergyKwhPerDay: number;
    itEnergyKwhPerDay: number;
    waterMld: number;
    waterLitresPerDay: number;
    wueUsed: number;
    wueSource: string;
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  };

  // IT load, PUE and cooling type are submitted inputs, not analysis outputs,
  // so they come from the stored project row. The energy figures are derived
  // here purely so the reader can follow the arithmetic.
  const inputs = [
    {
      measure: "IT load",
      value: project ? `${Number(project.itLoad).toFixed(1)} MW` : "Not available",
    },
    {
      measure: "PUE",
      value: project ? Number(project.pue).toFixed(3) : "Not available",
    },
    {
      measure: "Cooling technology",
      value: project ? titleCase(project.coolingType) : "Not available",
    },
    { measure: "WUE applied", value: `${Number(w.wueUsed).toFixed(3)} L/kWh` },
    { measure: "IT energy", value: `${Math.round(w.itEnergyKwhPerDay).toLocaleString("en-IN")} kWh/day` },
    { measure: "Facility energy", value: `${Math.round(w.facilityEnergyKwhPerDay).toLocaleString("en-IN")} kWh/day` },
  ];

  const outputs = [
    { measure: "Daily water demand", value: `${Math.round(w.waterKlPerDay).toLocaleString("en-IN")} kL/day` },
    { measure: "Annual water demand", value: `${Number(w.waterMcmPerYear).toFixed(3)} MCM/year` },
    { measure: "Daily water demand", value: `${Number(w.waterMld).toFixed(3)} MLD` },
    { measure: "Facility energy", value: `${Number(w.facilityEnergyMwhPerDay).toFixed(1)} MWh/day` },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        caption="Submitted parameters"
        columns={[
          { key: "measure", header: "Parameter", render: (row) => <span className="font-semibold">{row.measure}</span> },
          { key: "value", header: "Value", render: (row) => <span className="font-mono">{row.value}</span> },
        ]}
        rows={inputs}
      />

      <DataTable
        caption="Calculated demand"
        columns={[
          { key: "measure", header: "Measure", render: (row) => <span className="font-semibold">{row.measure}</span> },
          { key: "value", header: "Value", render: (row) => <span className="font-mono font-bold">{row.value}</span> },
        ]}
        rows={outputs}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--nb-muted)]">
        <StatusChip tone="feasible">Calculated</StatusChip>
        <span>
          Facility energy = IT load x 24 x PUE. Water demand = facility energy x WUE.
        </span>
      </div>
      <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
        WUE reference: {String(w.wueSource)}. Source: {w.provenance.source},{" "}
        {w.provenance.sourceDate}. The demand figure is a total. This screening does
        not split demand into freshwater and reclaimed components, so no such split is
        reported.
      </p>
    </div>
  );
}
