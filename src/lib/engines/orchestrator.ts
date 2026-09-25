import {
  computeWaterDemand,
  defaultWueForCooling,
  type WaterDemandResult,
} from "@/lib/engines/water-demand";
import {
  evaluateCgwaRule,
  evaluateEcRule,
  evaluateEcologicalRule,
  evaluateSpcbRule,
} from "@/lib/rules/regulatory-rules";
import {
  classify,
  type ConstraintItem,
  type EvidenceGap,
} from "@/lib/engines/classification";
import { checkPointAgainstLayer } from "@/lib/gis/spatial";
import { asFeatureCollection } from "@/lib/data/ecological-zones";
import { lookupGroundwaterBlock } from "@/lib/data/groundwater";
import { nearestRainfallStation } from "@/lib/data/rainfall";
import {
  findDistrictGroundwater,
  categorizeGroundwaterStage,
  type GroundwaterCategory,
} from "@/lib/data/groundwater-data";
import {
  findDistrictRainfall,
  type DistrictRainfallRecord,
} from "@/lib/data/rainfall-data";
import type { DataProvenance } from "@/lib/data/dataset-types";
import type { NearbyPowerPlant } from "@/lib/data/power-plants-data";
import {
  loadSiteDataContext,
  type DataProviderFailure,
  type SiteDataContext,
} from "@/lib/data/site-data";

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
    pointWkt: string;
    crs: string;
  };
  siteData: SiteDataContext;
  waterDemand: WaterDemandResult;
  groundwater: {
    datasetType: "DISTRICT_CSV" | "MOCK_BLOCK_FALLBACK" | "UNKNOWN";
    matchQuality: string | null;
    block: string | null;
    district: string | null;
    state: string | null;
    category: GroundwaterCategory;
    stage: number | null;
    tds: number | null;
    preMonsoon: number | null;
    postMonsoon: number | null;
    distanceKm: number | null;
    assessmentUnitVerified: boolean;
    resources: {
      totalAnnualRecharge: number | null;
      totalCurrentExtraction: number | null;
      netAvailabilityForFutureUse: number | null;
    } | null;
    provenance: DataProvenance;
  };
  rainfall: {
    datasetType: "DISTRICT_CSV" | "MOCK_STATION_FALLBACK" | "UNKNOWN";
    matchQuality: string | null;
    station: string | null;
    district: string | null;
    state: string | null;
    annualNormal: number | null;
    annualRainfallMm: number | null;
    monsoonNormal: number | null;
    monsoonRainfallMm: number | null;
    postMonsoon: number | null;
    winterRain: number | null;
    summerRain: number | null;
    monthlyMm: DistrictRainfallRecord["monthlyMm"] | null;
    distanceKm: number | null;
    timeseries: Array<{ year: number; annual: number }>;
    period: string;
    provenance: DataProvenance;
  };
  ecology: Record<
    "esz" | "forest" | "wetland" | "crz",
    {
      overlap: boolean;
      nearestDistanceKm: number;
      intersectedPolygons: { id: string; name: string; category?: string }[];
      rule: ReturnType<typeof evaluateEcologicalRule>;
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
    nearbyPowerPlants: NearbyPowerPlant[];
    provenance: DataProvenance;
  };
  constraints: ConstraintItem[];
  evidenceGaps: EvidenceGap[];
  classification: ReturnType<typeof classify>;
  generatedAt: string;
}

const LAYER_KEYS = ["esz", "forest", "wetland", "crz"] as const;

function usesGroundwater(source: string): boolean {
  const normalized = source.toLowerCase();
  return normalized.includes("ground") || normalized === "borewell";
}

function localFailure(provider: string, error: unknown): DataProviderFailure {
  return {
    provider,
    message: error instanceof Error ? error.message : "Local dataset unavailable",
  };
}

async function resolveGroundwater(
  input: AnalyzeInput,
  context: SiteDataContext,
): Promise<{
  groundwater: AnalysisResult["groundwater"];
  failure: DataProviderFailure | null;
}> {
  const candidates = context.location?.data.districtCandidates ?? [];
  let failure: DataProviderFailure | null = null;
  if (context.location) {
    try {
      const match = await findDistrictGroundwater(
        context.location.data.state,
        candidates,
      );
      if (match) {
        const { record } = match;
        return {
          groundwater: {
            datasetType: "DISTRICT_CSV",
            matchQuality: match.matchQuality,
            block: null,
            district: record.district,
            state: record.state,
            category: record.category,
            stage: record.extractionStagePercent,
            tds: null,
            preMonsoon: null,
            postMonsoon: null,
            distanceKm: null,
            assessmentUnitVerified: false,
            resources: {
              totalAnnualRecharge: record.totalAnnualRecharge,
              totalCurrentExtraction: record.totalCurrentExtraction,
              netAvailabilityForFutureUse: record.netAvailabilityForFutureUse,
            },
            provenance: record.provenance,
          },
          failure: null,
        };
      }
    } catch (error) {
      failure = localFailure("Bundled groundwater district CSV", error);
    }
  }

  const fallback = lookupGroundwaterBlock(input.latitude, input.longitude);
  if (!fallback) {
    return {
      groundwater: {
        datasetType: "UNKNOWN",
        matchQuality: null,
        block: null,
        district: context.location?.data.district ?? null,
        state: context.location?.data.state ?? null,
        category: "UNKNOWN",
        stage: null,
        tds: null,
        preMonsoon: null,
        postMonsoon: null,
        distanceKm: null,
        assessmentUnitVerified: false,
        resources: null,
        provenance: {
          source: "No matching groundwater dataset record",
          sourceDate: "n/a",
          evidenceStatus: "UNKNOWN",
        },
      },
      failure,
    };
  }

  return {
    groundwater: {
      datasetType: "MOCK_BLOCK_FALLBACK",
      matchQuality: "NEAREST_MOCK_CENTROID",
      block: fallback.block.blockName,
      district: fallback.block.district,
      state: fallback.block.state,
      category: categorizeGroundwaterStage(fallback.block.stage),
      stage: fallback.block.stage,
      tds: fallback.block.tds,
      preMonsoon: fallback.block.preMonsoon,
      postMonsoon: fallback.block.postMonsoon,
      distanceKm: fallback.distanceKm,
      assessmentUnitVerified: false,
      resources: fallback.block.recharge !== null && fallback.block.extraction !== null
        ? {
            totalAnnualRecharge: fallback.block.recharge,
            totalCurrentExtraction: fallback.block.extraction,
            netAvailabilityForFutureUse: null,
          }
        : null,
      provenance: {
        source: "Bundled mock CGWB block fallback",
        sourceDate:
          "Fallback seed labelled 2023-04; representative values are not independently verified",
        evidenceStatus: "PROXY",
        datasetFile: "src/lib/data/groundwater.ts",
        caveat:
          "Representative fallback values selected by nearest centroid; no assessment-unit polygon or bundled source document is available.",
      },
    },
    failure,
  };
}

async function resolveRainfall(
  input: AnalyzeInput,
  context: SiteDataContext,
): Promise<{
  rainfall: AnalysisResult["rainfall"];
  failure: DataProviderFailure | null;
}> {
  const candidates = context.location?.data.districtCandidates ?? [];
  let failure: DataProviderFailure | null = null;
  if (context.location) {
    try {
      const match = await findDistrictRainfall(
        context.location.data.state,
        candidates,
      );
      if (match) {
        const { record } = match;
        return {
          rainfall: {
            datasetType: "DISTRICT_CSV",
            matchQuality: match.matchQuality,
            station: `${record.district} district aggregate`,
            district: record.district,
            state: record.state,
            annualNormal: record.annualMm,
            annualRainfallMm: record.annualMm,
            monsoonNormal: record.monsoonRainMm,
            monsoonRainfallMm: record.monsoonRainMm,
            postMonsoon: record.postMonsoonRainMm,
            winterRain: record.winterRainMm,
            summerRain: record.summerRainMm,
            monthlyMm: record.monthlyMm,
            distanceKm: null,
            timeseries: [],
            period: "Not supplied by source file",
            provenance: record.provenance,
          },
          failure: null,
        };
      }
    } catch (error) {
      failure = localFailure("Bundled district rainfall CSV", error);
    }
  }

  const fallback = nearestRainfallStation(input.latitude, input.longitude);
  if (!fallback) {
    return {
      rainfall: {
        datasetType: "UNKNOWN",
        matchQuality: null,
        station: null,
        district: context.location?.data.district ?? null,
        state: context.location?.data.state ?? null,
        annualNormal: null,
        annualRainfallMm: null,
        monsoonNormal: null,
        monsoonRainfallMm: null,
        postMonsoon: null,
        winterRain: null,
        summerRain: null,
        monthlyMm: null,
        distanceKm: null,
        timeseries: [],
        period: "Unavailable",
        provenance: {
          source: "No matching rainfall dataset record",
          sourceDate: "n/a",
          evidenceStatus: "UNKNOWN",
        },
      },
      failure,
    };
  }

  const { station } = fallback;
  return {
    rainfall: {
      datasetType: "MOCK_STATION_FALLBACK",
      matchQuality: "NEAREST_MOCK_STATION",
      station: station.stationName,
      district: station.district,
      state: station.state,
      annualNormal: station.annualNormal,
      annualRainfallMm: station.annualNormal,
      monsoonNormal: station.monsoonNormal,
      monsoonRainfallMm: station.monsoonNormal,
      postMonsoon: station.postMonsoon,
      winterRain: station.winterRain,
      summerRain: station.summerRain,
      monthlyMm: null,
      distanceKm: fallback.distanceKm,
      timeseries: station.timeseries,
      period: "Representative fallback; source period not bundled",
      provenance: {
        source: "Bundled mock IMD station fallback",
        sourceDate:
          "Fallback seed labelled 2023-12; representative values are not independently verified",
        evidenceStatus: "PROXY",
        datasetFile: "src/lib/data/rainfall.ts",
        caveat:
          "Representative station seed and time series selected by nearest point; it is not a verified station observation.",
      },
    },
    failure,
  };
}

export async function analyze(
  input: AnalyzeInput,
  suppliedContext?: SiteDataContext,
): Promise<AnalysisResult> {
  const site = { lng: input.longitude, lat: input.latitude };
  const coordinates = {
    latitude: input.latitude,
    longitude: input.longitude,
  };
  const context = suppliedContext ?? (await loadSiteDataContext(coordinates));
  const [groundwaterResult, rainfallResult] = await Promise.all([
    resolveGroundwater(input, context),
    resolveRainfall(input, context),
  ]);
  const groundwater = groundwaterResult.groundwater;
  const rainfall = rainfallResult.rainfall;
  const dataFailures = [
    ...context.failures,
    ...(groundwaterResult.failure ? [groundwaterResult.failure] : []),
    ...(rainfallResult.failure ? [rainfallResult.failure] : []),
  ];
  const contextWithFailures: SiteDataContext = {
    ...context,
    failures: dataFailures,
    reusedAt: suppliedContext ? new Date().toISOString() : null,
  };

  const wue =
    input.wue && input.wue > 0
      ? input.wue
      : defaultWueForCooling(input.coolingType);
  const waterDemand = computeWaterDemand({
    itLoad: input.itLoad,
    pue: input.pue,
    wue,
    coolingType: input.coolingType,
  });

  const ecology = {} as AnalysisResult["ecology"];
  for (const key of LAYER_KEYS) {
    const featureCollection = asFeatureCollection(key);
    const spatial = checkPointAgainstLayer(site, featureCollection);
    const rule = evaluateEcologicalRule({
      layer: key,
      overlap: spatial.overlap,
      nearestDistanceKm: spatial.nearestDistanceKm,
      polygonName: spatial.intersectedPolygons[0]?.name,
      evidenceStatus: spatial.evidenceStatus,
    });
    ecology[key] = { ...spatial, rule };
  }

  const usingGroundwater = usesGroundwater(input.proposedWaterSource);
  const cgwa = evaluateCgwaRule({
    groundwaterCategory: groundwater.category,
    groundwaterEvidenceStatus: groundwater.provenance.evidenceStatus,
    assessmentUnitVerified: groundwater.assessmentUnitVerified,
    proposedWaterSource: input.proposedWaterSource,
    alternativeWaterSource: input.alternativeWaterSource ?? null,
    itLoad: input.itLoad,
  });
  const ec = evaluateEcRule({
    builtUpArea: input.builtUpArea,
    itLoad: input.itLoad,
  });
  const regulatoryState =
    context.location?.data.state ?? groundwater.state ?? rainfall.state;
  const spcb = evaluateSpcbRule({
    state: regulatoryState ?? "Unknown jurisdiction",
    industryType: "Data Centre",
  });

  const power = {
    timeline: "UNKNOWN" as const,
    substation: null as string | null,
    nearbyPowerPlants: context.nearbyPowerPlants,
    provenance: context.powerProvenance,
  };

  const constraints: ConstraintItem[] = [
    {
      key: "cgwa",
      label: "CGWA / Groundwater",
      kind: cgwa.hardConstraint
        ? "hard"
        : cgwa.outcome.includes("CONDITION") ||
            cgwa.outcome.includes("VERIFICATION")
          ? "soft"
          : "info",
      outcome: cgwa.outcome,
      reasons: cgwa.reasons,
      provenance: cgwa.provenance,
    },
  ];

  for (const key of LAYER_KEYS) {
    const layer = ecology[key];
    constraints.push({
      key: `eco-${key}`,
      label: `${key.toUpperCase()} overlap`,
      kind:
        layer.rule.hardConstraint
          ? "hard"
          : layer.rule.outcome.includes("PROXY") ||
              layer.rule.outcome.includes("VERIFICATION")
            ? "soft"
            : "info",
      outcome: layer.rule.outcome,
      reasons: layer.rule.reasons,
      provenance: layer.rule.provenance,
    });
  }

  constraints.push({
    key: "ec",
    label: "Environmental Clearance",
    kind:
      ec.outcome === "EC APPLICABLE" || ec.outcome === "DATA INSUFFICIENT"
        ? "soft"
        : "info",
    outcome: ec.outcome,
    reasons: ec.reasons,
    provenance: ec.provenance,
  });
  constraints.push({
    key: "spcb",
    label: "SPCB Consent",
    kind: "info",
    outcome: spcb.outcome,
    reasons: spcb.reasons,
    provenance: spcb.provenance,
  });
  constraints.push({
    key: "power-connection",
    label: "Power connection",
    kind: "info",
    outcome: "CONNECTION DATA UNKNOWN",
    reasons: [
      "No verified DISCOM/CEA connection timeline or deliverable-capacity feed is integrated.",
      "Nearby plants are inventory context only and do not establish grid readiness.",
    ],
    provenance: context.powerProvenance,
  });

  const evidenceGaps: EvidenceGap[] = [];
  if (!context.location) {
    evidenceGaps.push({
      key: "site-location",
      label: "Reverse-geocoded site jurisdiction",
      whyCritical:
        "District/state matching and the coverage of regulatory datasets depend on a resolved location.",
    });
  }
  if (usingGroundwater && groundwater.category === "UNKNOWN") {
    evidenceGaps.push({
      key: "gw-category",
      label: "Groundwater category",
      whyCritical:
        "Groundwater extraction requires a known CGWB category for NOC screening.",
    });
  }
  if (usingGroundwater && !groundwater.assessmentUnitVerified) {
    evidenceGaps.push({
      key: "gw-assessment-unit",
      label: "CGWB assessment-unit/block classification",
      whyCritical:
        "The bundled record is district-level or fallback data; NOC decisions require the applicable block/assessment unit.",
    });
  }
  if (
    context.location?.data.state &&
    context.location.data.state.toLowerCase() !== "maharashtra"
  ) {
    evidenceGaps.push({
      key: "ecology-coverage",
      label: "Ecological layer coverage outside Maharashtra",
      whyCritical:
        "The bundled ESZ/forest/wetland/CRZ fixtures do not provide national or state-complete clearance for this site.",
    });
  }

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
    siteData: contextWithFailures,
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

export async function analyzeScenario(
  base: AnalyzeInput,
  overrides: Partial<
    Pick<
      AnalyzeInput,
      "itLoad" | "pue" | "wue" | "coolingType" | "proposedWaterSource"
    >
  >,
  siteData?: SiteDataContext,
): Promise<AnalysisResult> {
  return analyze(
    {
      ...base,
      itLoad: overrides.itLoad ?? base.itLoad,
      pue: overrides.pue ?? base.pue,
      wue: overrides.wue ?? base.wue,
      coolingType: overrides.coolingType ?? base.coolingType,
      proposedWaterSource:
        overrides.proposedWaterSource ?? base.proposedWaterSource,
    },
    siteData,
  );
}
