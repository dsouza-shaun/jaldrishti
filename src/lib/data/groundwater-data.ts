import {
  cleanText,
  loadCsvDataset,
  parseNullableNumber,
} from "@/lib/data/dataset-loader";
import {
  normalizeRegionName,
  normalizeStateName,
  regionKey,
} from "@/lib/data/geo";
import type { DataProvenance } from "@/lib/data/dataset-types";

export type GroundwaterCategory =
  | "Safe"
  | "Semi-Critical"
  | "Critical"
  | "Over-Exploited"
  | "UNKNOWN";

export interface DistrictGroundwaterRecord {
  rowNumber: number;
  state: string;
  district: string;
  rechargeMonsoonRainfall: number | null;
  rechargeMonsoonOther: number | null;
  rechargeNonMonsoonRainfall: number | null;
  rechargeNonMonsoonOther: number | null;
  totalAnnualRecharge: number | null;
  totalNaturalDischarges: number | null;
  annualExtractableResource: number | null;
  extractionIrrigation: number | null;
  extractionDomesticIndustrial: number | null;
  totalCurrentExtraction: number | null;
  domesticAllocationAsOn2025: number | null;
  netAvailabilityForFutureUse: number | null;
  extractionStagePercent: number | null;
  category: GroundwaterCategory;
  provenance: DataProvenance;
}

export interface GroundwaterMatch {
  record: DistrictGroundwaterRecord;
  matchQuality: "EXACT_STATE_AND_DISTRICT" | "UNIQUE_DISTRICT_WITHOUT_STATE";
}

interface GroundwaterIndex {
  byStateDistrict: Map<string, DistrictGroundwaterRecord>;
  byDistrict: Map<string, DistrictGroundwaterRecord[]>;
  all: DistrictGroundwaterRecord[];
}

const HEADERS = [
  "S.no.",
  "Name of State",
  "Name of District",
  "Recharge from rainfall During Monsoon Season",
  "Recharge from other sources During Monsoon Season",
  "Recharge from rainfall During Non Monsoon Season",
  "Recharge from other sources During Non Monsoon Season",
  "Total Annual Ground Water Recharge",
  "Total Natural Discharges",
  "Annual Extractable Ground Water Resource",
  "Current Annual Ground Water Extraction For Irrigation",
  "Current Annual Ground Water Extraction For Domestic & Industrial Use",
  "Total Current Annual Ground Water Extraction",
  "Annual GW Allocation for Domestic Use as on 2025",
  "Net Ground Water Availability for future use",
  "Stage of Ground Water Extraction (%)",
] as const;

export function categorizeGroundwaterStage(
  stagePercent: number | null,
): GroundwaterCategory {
  if (stagePercent === null) return "UNKNOWN";
  if (stagePercent < 50) return "Safe";
  if (stagePercent < 70) return "Semi-Critical";
  if (stagePercent < 90) return "Critical";
  return "Over-Exploited";
}

function mapRow(
  row: Readonly<Record<string, string>>,
  rowIndex: number,
): DistrictGroundwaterRecord | null {
  const state = cleanText(row["Name of State"]);
  const district = cleanText(row["Name of District"]);
  if (!state || !district) return null;

  const stage = parseNullableNumber(row["Stage of Ground Water Extraction (%)"]);
  return {
    rowNumber: rowIndex + 2,
    state,
    district,
    rechargeMonsoonRainfall: parseNullableNumber(
      row["Recharge from rainfall During Monsoon Season"],
    ),
    rechargeMonsoonOther: parseNullableNumber(
      row["Recharge from other sources During Monsoon Season"],
    ),
    rechargeNonMonsoonRainfall: parseNullableNumber(
      row["Recharge from rainfall During Non Monsoon Season"],
    ),
    rechargeNonMonsoonOther: parseNullableNumber(
      row["Recharge from other sources During Non Monsoon Season"],
    ),
    totalAnnualRecharge: parseNullableNumber(
      row["Total Annual Ground Water Recharge"],
    ),
    totalNaturalDischarges: parseNullableNumber(row["Total Natural Discharges"]),
    annualExtractableResource: parseNullableNumber(
      row["Annual Extractable Ground Water Resource"],
    ),
    extractionIrrigation: parseNullableNumber(
      row["Current Annual Ground Water Extraction For Irrigation"],
    ),
    extractionDomesticIndustrial: parseNullableNumber(
      row["Current Annual Ground Water Extraction For Domestic & Industrial Use"],
    ),
    totalCurrentExtraction: parseNullableNumber(
      row["Total Current Annual Ground Water Extraction"],
    ),
    domesticAllocationAsOn2025: parseNullableNumber(
      row["Annual GW Allocation for Domestic Use as on 2025"],
    ),
    netAvailabilityForFutureUse: parseNullableNumber(
      row["Net Ground Water Availability for future use"],
    ),
    extractionStagePercent: stage,
    category: categorizeGroundwaterStage(stage),
    provenance: {
      source: "Bundled India groundwater district resource CSV",
      sourceDate:
        "Unknown assessment vintage; filename suggests 2017 and the header also contains a 2025 allocation field",
      evidenceStatus: "PROXY",
      datasetFile: "datasets/ground_water_2017.csv",
      caveat:
        "District-level groundwater-resource proxy, not a CGWB block or assessment-unit record. The CSV does not encode units in its headers, and the screening category is derived from the extraction-stage percentage using conventional bands rather than supplied as a source field.",
    },
  } satisfies DistrictGroundwaterRecord;
}

let indexPromise: Promise<GroundwaterIndex> | null = null;

async function buildIndex(): Promise<GroundwaterIndex> {
  const table = await loadCsvDataset("ground_water_2017.csv", HEADERS);
  const all = table.rows
    .map(mapRow)
    .filter((record): record is DistrictGroundwaterRecord => record !== null);
  const byStateDistrict = new Map<string, DistrictGroundwaterRecord>();
  const byDistrict = new Map<string, DistrictGroundwaterRecord[]>();

  for (const record of all) {
    byStateDistrict.set(regionKey(record.state, record.district), record);
    const districtKey = normalizeRegionName(record.district);
    const records = byDistrict.get(districtKey) ?? [];
    records.push(record);
    byDistrict.set(districtKey, records);
  }

  return { byStateDistrict, byDistrict, all };
}

export async function getGroundwaterDatasetSummary() {
  const index = await getGroundwaterDataset();
  return {
    rows: index.all.length,
    unknownStageRows: index.all.filter(
      (record) => record.extractionStagePercent === null,
    ).length,
    datasetFile: "datasets/ground_water_2017.csv",
  };
}

export function getGroundwaterDataset(): Promise<GroundwaterIndex> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

export async function findDistrictGroundwater(
  state: string | null | undefined,
  districtCandidates: readonly string[],
): Promise<GroundwaterMatch | null> {
  const index = await getGroundwaterDataset();
  const normalizedState = normalizeStateName(state);

  for (const candidate of districtCandidates) {
    const record = index.byStateDistrict.get(regionKey(state, candidate));
    if (record) {
      return { record, matchQuality: "EXACT_STATE_AND_DISTRICT" };
    }
  }

  if (!normalizedState) {
    for (const candidate of districtCandidates) {
      const records = index.byDistrict.get(normalizeRegionName(candidate)) ?? [];
      const uniqueRecords = [...new Map(records.map((record) => [regionKey(record.state, record.district), record])).values()];
      if (uniqueRecords.length === 1) {
        return {
          record: uniqueRecords[0],
          matchQuality: "UNIQUE_DISTRICT_WITHOUT_STATE",
        };
      }
    }
  }

  return null;
}
