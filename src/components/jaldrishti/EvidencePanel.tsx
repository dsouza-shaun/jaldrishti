"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { ShieldCheck, Database, Link2, Bolt } from "lucide-react";
import { EvidenceBadge, EVIDENCE_META } from "./GroundwaterPanel";

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
    value: `${r.station} (${r.annualRainfallMm} mm)`,
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

  // Live water risk: Aqueduct, district water context, terrain.
  const waterRisk = analysis.siteData.waterRisk as unknown as {
    aqueduct: {
      available: boolean;
      sectors: Array<{ code: string; label: string; overall: { categoryLabel: string | null } }>;
      provenance: { source: string; sourceDate: string; evidenceStatus: string };
    } | null;
    district: {
      available: boolean;
      district: string | null;
      groundwater: { criticalOrOverExploitedPct: number | null } | null;
      provenance: { source: string; sourceDate: string; evidenceStatus: string };
    } | null;
    elevation: {
      available: boolean;
      elevationM: number | null;
      resolutionMPerPixel: number | null;
      provenance: { source: string; sourceDate: string; evidenceStatus: string };
    } | null;
  } | null;

  if (waterRisk?.aqueduct?.available) {
    for (const sector of waterRisk.aqueduct.sectors) {
      if (sector.code !== "smc" && sector.code !== "elp") continue;
      rows.push({
        key: `aqueduct-${sector.code}`,
        label: `Water risk: ${sector.label}`,
        value: sector.overall.categoryLabel ?? "not scored",
        source: waterRisk.aqueduct.provenance.source,
        sourceDate: waterRisk.aqueduct.provenance.sourceDate,
        evidenceStatus: waterRisk.aqueduct.provenance.evidenceStatus,
        category: "data",
      });
    }
  }

  if (waterRisk?.district?.available) {
    rows.push({
      key: "district-water",
      label: "District water context",
      value: `${waterRisk.district.district ?? "?"} (${
        waterRisk.district.groundwater?.criticalOrOverExploitedPct !== null &&
        waterRisk.district.groundwater?.criticalOrOverExploitedPct !== undefined
          ? `${waterRisk.district.groundwater.criticalOrOverExploitedPct}% Critical or Over-exploited`
          : "no unit data"
      })`,
      source: waterRisk.district.provenance.source,
      sourceDate: waterRisk.district.provenance.sourceDate,
      evidenceStatus: waterRisk.district.provenance.evidenceStatus,
      category: "data",
    });
  }

  if (waterRisk?.elevation?.available && waterRisk.elevation.elevationM !== null) {
    rows.push({
      key: "elevation",
      label: "Site elevation (terrain DEM)",
      value: `${waterRisk.elevation.elevationM} m${
        waterRisk.elevation.resolutionMPerPixel !== null
          ? ` at ${waterRisk.elevation.resolutionMPerPixel} m/px`
          : ""
      }`,
      source: waterRisk.elevation.provenance.source,
      sourceDate: waterRisk.elevation.provenance.sourceDate,
      evidenceStatus: waterRisk.elevation.provenance.evidenceStatus,
      category: "data",
    });
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
      value: `${climate.data.current.temperatureC ?? "â€”"}°C`,
      source: climate.data.attribution.label,
      sourceDate: climate.retrievedAt,
      evidenceStatus: "PROXY",
      category: "data",
    });
  }

  const landCover = analysis.siteData.landCover as unknown as {
    available: boolean;
    location: string | null;
    sample: { dominantClassCode: number | null; dominantClassLabel: string | null } | null;
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  } | null;
  if (landCover) {
    rows.push({
      key: "land-cover",
      label: "Bundled land-cover raster",
      // The ESA WorldCover class name, not the bare integer. The code is kept
      // alongside it so a reader can look the value up in the product manual.
      value: landCover.available
        ? `${landCover.location}: ${
            landCover.sample?.dominantClassLabel ??
            (landCover.sample?.dominantClassCode != null
              ? `unmapped code ${landCover.sample.dominantClassCode}`
              : "no valid pixel")
          }`
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
    value: `${p.nearbyPowerPlants.length} nearby plant record(s)`,
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
    <div>
      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">Data sources</h3>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto nb-scroll border-2 border-[var(--nb-rule)]">
        <table className="w-full text-xs">
          <thead className="bg-black text-[var(--paper)] text-[9px] uppercase tracking-wider sticky top-0">
            <tr>
              <th className="text-left p-2">Field</th>
              <th className="text-left p-2">Value</th>
              <th className="text-left p-2">Evidence</th>
              <th className="text-left p-2">Source</th>
              <th className="text-left p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className={i % 2 === 0 ? "bg-[var(--paper)]" : "bg-[var(--nb-tint)]"}>
                <td className="p-2 font-bold">
                  <span className="flex items-center gap-1">
                    {row.category === "data" ? <Database className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    {row.label}
                  </span>
                </td>
                <td className="p-2 font-mono text-[10px]">{row.value}</td>
                <td className="p-2"><EvidenceBadge status={row.evidenceStatus} /></td>
                <td className="p-2 text-[10px]">{row.source}</td>
                <td className="p-2 text-[10px] font-mono">{row.sourceDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["VERIFIED", "PROXY", "UNKNOWN"] as const).map((status) => {
          const meta = EVIDENCE_META[status];
          return (
            <div key={status} className="flex items-start gap-2 border-2 border-[var(--nb-rule)] bg-[var(--paper)] p-2">
              <EvidenceBadge status={status} />
              <p className="text-[10px] leading-snug text-[var(--nb-muted)]">{meta.explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}