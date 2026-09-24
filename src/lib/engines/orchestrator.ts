/**
 * Master analysis orchestrator.
 *
 * Mirrors the "Final Data Flow" described in the JalDrishti spec:
 *
 *   coords → spatial processing → water engine → regulatory rules
 *          → what-if → evidence → decision → structured JSON
 *
 * Returns a single structured JSON object that the frontend renders and the
 * optional AI explanation layer consumes verbatim.
 */

import { computeWaterDemand, defaultWueForCooling, type WaterDemandResult } from "@/lib/engines/water-demand";
import {
  evaluateCgwaRule,
  evaluateEcRule,
  evaluateEcologicalRule,
  evaluateSpcbRule,
} from "@/lib/rules/regulatory-rules";
import { classify, type ConstraintItem, type EvidenceGap } from "@/lib/engines/classification";
import { checkPointAgainstLayer } from "@/lib/gis/spatial";
import { asFeatureCollection } from "@/lib/data/ecological-zones";
import { lookupGroundwaterBlock } from "@/lib/data/groundwater";
import { nearestRainfallStation } from "@/lib/data/rainfall";

export interface AnalyzeInput {
  projectId: string;
  projectName: string;
  latitude: number;
  longitude: number;
  itLoad: number;
  pue: number;
  wue: number;
  coolingType: string;
  builtUpArea?: number;
  landTenure: string;
  proposedWaterSource: string;
  alternativeWaterSource?: string | null;
  notes?: string | null;
}

export interface AnalysisResult {
  projectId: string;
  projectName: string;
  site: {
    latitude: number;
    longitude: number;
    pointWkt: string; // POINT(lng lat)
    crs: string;
  };
  waterDemand: WaterDemandResult;
  groundwater: {
    block: string | null;
    district: string | null;
    state: string | null;
    category: "Safe" | "Semi-Critical" | "Critical" | "Over-Exploited" | "Saline" | "UNKNOWN";
    stage: number | null;
    tds: number | null;
    preMonsoon: number | null;
    postMonsoon: number | null;
    distanceKm: number;
    provenance: {
      source: string;
      sourceDate: string;
      evidenceStatus: "VERIFIED" | "PROXY" | "UNKNOWN";
    };
  };
  rainfall: {
    station: string | null;
    annualNormal: number | null;
    monsoonNormal: number | null;
    distanceKm: number;
    timeseries: { year: number; annual: number }[];
    provenance: {
      source: string;
      sourceDate: string;
      evidenceStatus: "VERIFIED" | "PROXY" | "UNKNOWN";
    };
  };
  ecology: Record<
    "esz" | "forest" | "wetland" | "crz",
    {
      overlap: boolean;
      nearestDistanceKm: number;
      intersectedPolygons: { id: string; name: string; category?: string }[];
      rule: {
        outcome: string;
        reasons: string[];
        hardConstraint: boolean;
        provenance: { source: string; sourceDate: string; evidenceStatus: string };
      };
    }
  >;
  regulatory: {
    cgwa: ReturnType<typeof evaluateCgwaRule>;
    ec: ReturnType<typeof evaluateEcRule>;
    spcb: ReturnType<typeof evaluateSpcbRule>;
  };
  power: {
    timeline: "UNKNOWN";
    substation: string | null;
    provenance: {
      source: string;
      sourceDate: string;
      evidenceStatus: "UNKNOWN";
    };
  };
  constraints: ConstraintItem[];
  evidenceGaps: EvidenceGap[];
  classification: ReturnType<typeof classify>;
  generatedAt: string;
}

const LAYER_KEYS = ["esz", "forest", "wetland", "crz"] as const;

export function analyze(input: AnalyzeInput): AnalysisResult {
  const site = { lng: input.longitude, lat: input.latitude };

  // 1. Water demand (deterministic)
  const wue = input.wue && input.wue > 0 ? input.wue : defaultWueForCooling(input.coolingType);
  const waterDemand = computeWaterDemand({
    itLoad: input.itLoad,
    pue: input.pue,
    wue,
    coolingType: input.coolingType,
  });

  // 2. Groundwater lookup
  const gw = lookupGroundwaterBlock(input.latitude, input.longitude);
  const groundwater = {
    block: gw?.block.blockName ?? null,
    district: gw?.block.district ?? null,
    state: gw?.block.state ?? null,
    category: (gw?.block.category ?? "UNKNOWN") as
      | "Safe" | "Semi-Critical" | "Critical" | "Over-Exploited" | "Saline" | "UNKNOWN",
    stage: gw?.block.stage ?? null,
    tds: gw?.block.tds ?? null,
    preMonsoon: gw?.block.preMonsoon ?? null,
    postMonsoon: gw?.block.postMonsoon ?? null,
    distanceKm: gw?.distanceKm ?? 0,
    provenance: {
      source: gw?.block.source ?? "CGWB Ground Water Year Book",
      sourceDate: gw?.block.sourceDate ?? "2023-04",
      evidenceStatus: (gw?.evidenceStatus ?? "UNKNOWN") as "VERIFIED" | "PROXY" | "UNKNOWN",
    },
  };

  // 3. Rainfall lookup
  const r = nearestRainfallStation(input.latitude, input.longitude);
  const rainfall = {
    station: r?.station.stationName ?? null,
    annualNormal: r?.station.annualNormal ?? null,
    monsoonNormal: r?.station.monsoonNormal ?? null,
    distanceKm: r?.distanceKm ?? 0,
    timeseries: r?.station.timeseries ?? [],
    provenance: {
      source: r?.station.source ?? "IMD District-Wise Rainfall Statistics",
      sourceDate: r?.station.sourceDate ?? "2023-12",
      evidenceStatus: (r?.evidenceStatus ?? "UNKNOWN") as "VERIFIED" | "PROXY" | "UNKNOWN",
    },
  };

  // 4. Ecological spatial checks
  const ecology = {} as AnalysisResult["ecology"];
  for (const key of LAYER_KEYS) {
    const fc = asFeatureCollection(key);
    const spatial = checkPointAgainstLayer(site, fc);
    const rule = evaluateEcologicalRule({
      layer: key,
      overlap: spatial.overlap,
      nearestDistanceKm: spatial.nearestDistanceKm,
      polygonName: spatial.intersectedPolygons[0]?.name,
    });
    ecology[key] = { ...spatial, rule };
  }

  // 5. Regulatory rules
  const cgwa = evaluateCgwaRule({
    groundwaterCategory: groundwater.category,
    proposedWaterSource: input.proposedWaterSource,
    alternativeWaterSource: input.alternativeWaterSource ?? null,
    itLoad: input.itLoad,
  });
  const ec = evaluateEcRule({
    builtUpArea: input.builtUpArea,
    itLoad: input.itLoad,
  });
  const spcb = evaluateSpcbRule({
    state: groundwater.state ?? "Maharashtra",
    industryType: "Data Centre",
  });

  // 6. Power - explicit UNKNOWN (no live data in MVP)
  const power = {
    timeline: "UNKNOWN" as const,
    substation: null as string | null,
    provenance: {
      source: "No live power utility API integrated in MVP",
      sourceDate: "n/a",
      evidenceStatus: "UNKNOWN" as const,
    },
  };

  // 7. Build constraint list
  const constraints: ConstraintItem[] = [];

  // CGWA
  constraints.push({
    key: "cgwa",
    label: "CGWA / Groundwater",
    kind: cgwa.hardConstraint ? "hard" : cgwa.outcome.includes("CONDITION") || cgwa.outcome.includes("FEASIBLE WITH") ? "soft" : "info",
    outcome: cgwa.outcome,
    reasons: cgwa.reasons,
    provenance: cgwa.provenance,
  });

  // Ecological
  for (const key of LAYER_KEYS) {
    const e = ecology[key];
    constraints.push({
      key: `eco-${key}`,
      label: `${key.toUpperCase()} overlap`,
      kind: e.rule.hardConstraint ? "hard" : "info",
      outcome: e.rule.outcome,
      reasons: e.rule.reasons,
      provenance: e.rule.provenance,
    });
  }

  // EC - process requirement, treat as soft (not a site prohibition)
  constraints.push({
    key: "ec",
    label: "Environmental Clearance",
    kind: ec.outcome === "EC APPLICABLE" ? "soft" : "info",
    outcome: ec.outcome,
    reasons: ec.reasons,
    provenance: ec.provenance,
  });

  // SPCB - always info (CTE is a routine requirement)
  constraints.push({
    key: "spcb",
    label: "SPCB Consent",
    kind: "info",
    outcome: spcb.outcome,
    reasons: spcb.reasons,
    provenance: spcb.provenance,
  });

  // 8. Evidence gaps (only critical fields block the decision)
  const evidenceGaps: EvidenceGap[] = [];

  if (groundwater.category === "UNKNOWN") {
    evidenceGaps.push({
      key: "gw-category",
      label: "Groundwater block category",
      whyCritical: "Required to evaluate CGWA NOC eligibility.",
    });
  }

  if (!input.builtUpArea) {
    // EC is a soft requirement; missing built-up area is informational, not blocking.
    evidenceGaps.push({
      key: "built-up-area",
      label: "Built-up area",
      whyCritical: "Required to evaluate EC applicability under EIA 2006 8(b).",
    });
  }

  // 9. Classification
  const classification = classify(constraints, evidenceGaps);

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    site: {
      latitude: input.latitude,
      longitude: input.longitude,
      pointWkt: `POINT(${input.longitude} ${input.latitude})`,
      crs: "EPSG:4326 (WGS84)",
    },
    waterDemand,
    groundwater,
    rainfall,
    ecology,
    regulatory: { cgwa, ec, spcb },
    power,
    constraints,
    evidenceGaps,
    classification,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * What-if scenario - re-runs the analysis with overridden inputs but the
 * SAME site coordinates and SAME datasets. Deterministic by construction.
 */
export function analyzeScenario(
  base: AnalyzeInput,
  overrides: Partial<Pick<AnalyzeInput, "itLoad" | "pue" | "wue" | "coolingType" | "proposedWaterSource">>,
): AnalysisResult {
  return analyze({
    ...base,
    itLoad: overrides.itLoad ?? base.itLoad,
    pue: overrides.pue ?? base.pue,
    wue: overrides.wue ?? base.wue,
    coolingType: overrides.coolingType ?? base.coolingType,
    proposedWaterSource: overrides.proposedWaterSource ?? base.proposedWaterSource,
  });
}
