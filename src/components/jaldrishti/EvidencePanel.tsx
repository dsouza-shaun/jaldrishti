"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { ShieldCheck, Database, Link2, Bolt } from "lucide-react";

interface EvidenceRow {
  key: string;
  label: string;
  value: string;
  source: string;
  sourceDate: string;
  evidenceStatus: string;
  category: "data" | "rule";
}

export function EvidencePanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const rows: EvidenceRow[] = [];

  const location = analysis.siteData.location as unknown as {
    retrievedAt: string;
    cacheStatus: string;
    data: {
      displayName: string;
      district: string | null;
      state: string | null;
      pincode: string | null;
      attribution: { label: string };
    };
  } | null;
  if (location) {
    rows.push({
      key: "location",
      label: "Reverse-geocoded location",
      value: `${location.data.district ?? "?"}, ${location.data.state ?? "?"}`,
      source: location.data.attribution.label,
      sourceDate: location.retrievedAt,
      evidenceStatus: "PROXY",
      category: "data",
    });
  }

  // Water demand
  const w = analysis.waterDemand as { provenance: { source: string; sourceDate: string; evidenceStatus: string }; wueUsed: number };
  rows.push({
    key: "water-demand",
    label: "Water demand (calc)",
    value: `WUE ${w.wueUsed} L/kWh`,
    source: w.provenance.source,
    sourceDate: w.provenance.sourceDate,
    evidenceStatus: w.provenance.evidenceStatus,
    category: "rule",
  });

  // Groundwater
  const g = analysis.groundwater as { datasetType: string; block: string | null; district: string | null; category: string; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  rows.push({
    key: "gw",
    label: "Groundwater screening",
    value: `${g.datasetType === "DISTRICT_CSV" ? g.district : g.block ?? "UNKNOWN"} (${g.category})`,
    source: g.provenance.source,
    sourceDate: g.provenance.sourceDate,
    evidenceStatus: g.provenance.evidenceStatus,
    category: "data",
  });

  // Rainfall
  const r = analysis.rainfall as { station: string | null; annualRainfallMm: number | null; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  rows.push({
    key: "rainfall",
    label: "Rainfall dataset record",
    value: `${r.station ?? "—"} (${r.annualRainfallMm ?? "—"} mm)`,
    source: r.provenance.source,
    sourceDate: r.provenance.sourceDate,
    evidenceStatus: r.provenance.evidenceStatus,
    category: "data",
  });

  // Ecology
  const eco = analysis.ecology as Record<string, { rule: { provenance: { source: string; sourceDate: string; evidenceStatus: string } } }>;
  for (const k of ["esz", "forest", "wetland", "crz"]) {
    const e = eco[k];
    if (e) {
      rows.push({
        key: `eco-${k}`,
        label: `${k.toUpperCase()} polygons`,
        value: "MoEFCC / state wetland authority",
        source: e.rule.provenance.source,
        sourceDate: e.rule.provenance.sourceDate,
        evidenceStatus: e.rule.provenance.evidenceStatus,
        category: "data",
      });
    }
  }

  const climate = analysis.siteData.climate as unknown as {
    provider: string;
    retrievedAt: string;
    data: {
      current: { temperatureC: number | null } | null;
      attribution: { label: string };
    };
  } | null;
  if (climate?.data.current) {
    rows.push({
      key: "climate",
      label: "Modelled current weather",
      value: `${climate.data.current.temperatureC ?? "—"}°C`,
      source: climate.data.attribution.label,
      sourceDate: climate.retrievedAt,
      evidenceStatus: "PROXY",
      category: "data",
    });
  }

  const landCover = analysis.siteData.landCover as unknown as {
    available: boolean;
    location: string | null;
    sample: { dominantClassCode: number | null } | null;
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  } | null;
  if (landCover) {
    rows.push({
      key: "land-cover",
      label: "Bundled land-cover raster",
      value: landCover.available
        ? `${landCover.location}: code ${landCover.sample?.dominantClassCode ?? "unknown"}`
        : "Outside available raster footprints",
      source: landCover.provenance.source,
      sourceDate: landCover.provenance.sourceDate,
      evidenceStatus: landCover.provenance.evidenceStatus,
      category: "data",
    });
  }

  // Rules
  const reg = analysis.regulatory as Record<string, { provenance: { source: string; sourceDate: string; evidenceStatus: string }; outcome: string }>;
  for (const k of ["cgwa", "ec", "spcb"]) {
    const v = reg[k];
    if (v) {
      rows.push({
        key: `rule-${k}`,
        label: `Rule: ${k.toUpperCase()}`,
        value: v.outcome,
        source: v.provenance.source,
        sourceDate: v.provenance.sourceDate,
        evidenceStatus: v.provenance.evidenceStatus,
        category: "rule",
      });
    }
  }

  // Power
  const p = analysis.power as { timeline: string; nearbyPowerPlants: Array<{ name: string; distanceKm: number }>; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
  rows.push({
    key: "power",
    label: "Power inventory / connection",
    value: `${p.timeline}; ${p.nearbyPowerPlants.length} nearby plant record(s)`,
    source: p.provenance.source,
    sourceDate: p.provenance.sourceDate,
    evidenceStatus: p.provenance.evidenceStatus,
    category: "data",
  });

  for (const [index, failure] of analysis.siteData.failures.entries()) {
    rows.push({
      key: `provider-failure-${index}`,
      label: `Provider unavailable: ${failure.provider}`,
      value: failure.message,
      source: failure.provider,
      sourceDate: "Current analysis attempt",
      evidenceStatus: "UNKNOWN",
      category: "data",
    });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">Data sources</h3>
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto nb-scroll border-[2px] border-black">
        <table className="w-full text-xs">
          <thead className="bg-black text-[var(--paper)] text-[9px] uppercase tracking-wider sticky top-0">
            <tr>
              <th className="text-left p-2">Field</th>
              <th className="text-left p-2">Value</th>
              <th className="text-left p-2">Source</th>
              <th className="text-left p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className={i % 2 === 0 ? "bg-[var(--paper)]" : "bg-[var(--muted)]"}>
                <td className="p-2 font-bold">
                  <span className="flex items-center gap-1">
                    {row.category === "data" ? <Database className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    {row.label}
                  </span>
                </td>
                <td className="p-2 font-mono text-[10px]">{row.value}</td>
                <td className="p-2 text-[10px]">{row.source}</td>
                <td className="p-2 text-[10px] font-mono">{row.sourceDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2 flex items-center gap-1">
        <Bolt className="w-3 h-3" />
        Every value carries its source and evidence status — all the way to the final classification.
      </div>
    </motion.section>
  );
}
