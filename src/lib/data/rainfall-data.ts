import type { DataProvenance } from "@/lib/data/dataset-types";
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

export interface DistrictRainfallRecord {
  rowNumber: number;
  state: string;
  district: string;
  monthlyMm: {
    january: number | null;
    february: number | null;
    march: number | null;
    april: number | null;
    may: number | null;
    june: number | null;
    july: number | null;
    august: number | null;
    september: number | null;
    october: number | null;
    november: number | null;
    december: number | null;
  };
  annualMm: number | null;
  winterRainMm: number | null;
  summerRainMm: number | null;
  monsoonRainMm: number | null;
  postMonsoonRainMm: number | null;
  provenance: DataProvenance;
}

export interface RainfallMatch {
  record: DistrictRainfallRecord;
  matchQuality: "EXACT_STATE_AND_DISTRICT" | "UNIQUE_DISTRICT_WITHOUT_STATE";
}

export interface HistoricalRainfallYear {
  year: number;
  monthlyMm: DistrictRainfallRecord["monthlyMm"];
  annualMm: number | null;
  winterRainMm: number | null;
  summerRainMm: number | null;
  monsoonRainMm: number | null;
  postMonsoonRainMm: number | null;
}

export interface HistoricalRainfallSeries {
  subdivision: string;
  startYear: number;
  endYear: number;
  years: HistoricalRainfallYear[];
  availableStartYear: number;
  availableEndYear: number;
  requestedYearCount: number;
  returnedYearCount: number;
  annualObservationCount: number;
  missingAnnualObservationCount: number;
  meanAnnualMm: number | null;
  provenance: DataProvenance;
}

interface RainfallIndex {
  districtsByState: Map<string, DistrictRainfallRecord>;
  districtsByName: Map<string, DistrictRainfallRecord[]>;
  historicalBySubdivision: Map<string, HistoricalRainfallYear[]>;
  districtRowCount: number;
  historicalRowCount: number;
}

const MONTH_KEYS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const DISTRICT_HEADERS = [
  "STATE_UT_NAME",
  "DISTRICT",
  ...MONTH_KEYS,
  "ANNUAL",
  "Jan-Feb",
  "Mar-May",
  "Jun-Sep",
  "Oct-Dec",
] as const;

const HISTORICAL_HEADERS = [
  "SUBDIVISION",
  "YEAR",
  ...MONTH_KEYS,
  "ANNUAL",
  "Jan-Feb",
  "Mar-May",
  "Jun-Sep",
  "Oct-Dec",
] as const;

function mapMonthly(row: Readonly<Record<string, string>>) {
  return {
    january: parseNullableNumber(row.JAN),
    february: parseNullableNumber(row.FEB),
    march: parseNullableNumber(row.MAR),
    april: parseNullableNumber(row.APR),
    may: parseNullableNumber(row.MAY),
    june: parseNullableNumber(row.JUN),
    july: parseNullableNumber(row.JUL),
    august: parseNullableNumber(row.AUG),
    september: parseNullableNumber(row.SEP),
    october: parseNullableNumber(row.OCT),
    november: parseNullableNumber(row.NOV),
    december: parseNullableNumber(row.DEC),
  };
}

function mapDistrictRow(
  row: Readonly<Record<string, string>>,
  rowIndex: number,
): DistrictRainfallRecord | null {
  const state = cleanText(row.STATE_UT_NAME);
  const district = cleanText(row.DISTRICT);
  if (!state || !district) return null;

  return {
    rowNumber: rowIndex + 2,
    state,
    district,
    monthlyMm: mapMonthly(row),
    annualMm: parseNullableNumber(row.ANNUAL),
    winterRainMm: parseNullableNumber(row["Jan-Feb"]),
    summerRainMm: parseNullableNumber(row["Mar-May"]),
    monsoonRainMm: parseNullableNumber(row["Jun-Sep"]),
    postMonsoonRainMm: parseNullableNumber(row["Oct-Dec"]),
    provenance: {
      source: "IMD district rainfall CSV",
      sourceDate: "Normal period not supplied in the dataset",
      evidenceStatus: "VERIFIED",
      datasetFile: "datasets/district_wise_rainfall.csv",
      caveat:
        "District aggregate, not a station observation. The file does not identify its normal period or publication date.",
    },
  };
}

function mapHistoricalRow(
  row: Readonly<Record<string, string>>,
): HistoricalRainfallYear | null {
  const subdivision = cleanText(row.SUBDIVISION);
  const year = parseNullableNumber(row.YEAR);
  if (!subdivision || year === null) return null;

  return {
    year: Math.trunc(year),
    monthlyMm: mapMonthly(row),
    annualMm: parseNullableNumber(row.ANNUAL),
    winterRainMm: parseNullableNumber(row["Jan-Feb"]),
    summerRainMm: parseNullableNumber(row["Mar-May"]),
    monsoonRainMm: parseNullableNumber(row["Jun-Sep"]),
    postMonsoonRainMm: parseNullableNumber(row["Oct-Dec"]),
  };
}

let indexPromise: Promise<RainfallIndex> | null = null;

async function buildIndex(): Promise<RainfallIndex> {
  const [districtTable, historicalTable] = await Promise.all([
    loadCsvDataset("district_wise_rainfall.csv", DISTRICT_HEADERS),
    loadCsvDataset("rainfall_in_india_1901-2015.csv", HISTORICAL_HEADERS),
  ]);

  const districts = districtTable.rows
    .map(mapDistrictRow)
    .filter((record): record is DistrictRainfallRecord => record !== null);
  const districtsByState = new Map<string, DistrictRainfallRecord>();
  const districtsByName = new Map<string, DistrictRainfallRecord[]>();
  for (const district of districts) {
    districtsByState.set(regionKey(district.state, district.district), district);
    const key = normalizeRegionName(district.district);
    const records = districtsByName.get(key) ?? [];
    records.push(district);
    districtsByName.set(key, records);
  }

  const historicalBySubdivision = new Map<string, HistoricalRainfallYear[]>();
  for (const row of historicalTable.rows) {
    const historical = mapHistoricalRow(row);
    if (!historical) continue;
    // The normalized key is derived from the raw row so the public
    // subdivision label can retain its original IMD spelling.
    const subdivision = cleanText(row.SUBDIVISION);
    if (!subdivision) continue;
    const subdivisionKey = normalizeRegionName(subdivision);
    const years = historicalBySubdivision.get(subdivisionKey) ?? [];
    years.push(historical);
    historicalBySubdivision.set(subdivisionKey, years);
  }
  for (const years of historicalBySubdivision.values()) {
    years.sort((left, right) => left.year - right.year);
  }

  return {
    districtsByState,
    districtsByName,
    historicalBySubdivision,
    districtRowCount: districtTable.rows.length,
    historicalRowCount: historicalTable.rows.length,
  };
}

export async function getRainfallDatasetSummary() {
  const index = await getRainfallDataset();
  return {
    districtRows: index.districtRowCount,
    historicalRows: index.historicalRowCount,
    subdivisions: index.historicalBySubdivision.size,
    districtDatasetFile: "datasets/district_wise_rainfall.csv",
    historicalDatasetFile: "datasets/rainfall_in_india_1901-2015.csv",
  };
}

export function getRainfallDataset(): Promise<RainfallIndex> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

export async function findDistrictRainfall(
  state: string | null | undefined,
  districtCandidates: readonly string[],
): Promise<RainfallMatch | null> {
  const index = await getRainfallDataset();
  const normalizedState = normalizeStateName(state);

  for (const candidate of districtCandidates) {
    const record = index.districtsByState.get(regionKey(state, candidate));
    if (record) {
      return { record, matchQuality: "EXACT_STATE_AND_DISTRICT" };
    }
  }

  if (!normalizedState) {
    for (const candidate of districtCandidates) {
      const records = index.districtsByName.get(normalizeRegionName(candidate)) ?? [];
      const unique = [
        ...new Map(
          records.map((record) => [regionKey(record.state, record.district), record]),
        ).values(),
      ];
      if (unique.length === 1) {
        return {
          record: unique[0],
          matchQuality: "UNIQUE_DISTRICT_WITHOUT_STATE",
        };
      }
    }
  }

  return null;
}

function mean(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => value !== null);
  return finite.length > 0
    ? Number(
        (finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(2),
      )
    : null;
}

export async function getHistoricalRainfall(
  subdivision: string,
  startYear = 1901,
  endYear = 2015,
): Promise<HistoricalRainfallSeries | null> {
  const index = await getRainfallDataset();
  const key = normalizeRegionName(subdivision);
  const records = index.historicalBySubdivision.get(key);
  if (!records || records.length === 0) return null;

  const boundedStart = Math.max(1, Math.trunc(startYear));
  const boundedEnd = Math.max(boundedStart, Math.trunc(endYear));
  const years = records.filter(
    (record) => record.year >= boundedStart && record.year <= boundedEnd,
  );

  if (years.length === 0) return null;
  const annualObservations = years.filter(
    (record) => record.annualMm !== null,
  ).length;
  return {
    subdivision: subdivision.trim().toUpperCase(),
    startYear: boundedStart,
    endYear: boundedEnd,
    availableStartYear: records[0].year,
    availableEndYear: records.at(-1)!.year,
    requestedYearCount: boundedEnd - boundedStart + 1,
    returnedYearCount: years.length,
    annualObservationCount: annualObservations,
    missingAnnualObservationCount: years.length - annualObservations,
    years,
    meanAnnualMm: mean(years.map((record) => record.annualMm)),
    provenance: {
      source: "Bundled IMD meteorological-subdivision rainfall history",
      sourceDate: "Rows span the years present from the early 1900s through 2015",
      evidenceStatus: "PROXY",
      datasetFile: "datasets/rainfall_in_india_1901-2015.csv",
      caveat:
        "IMD meteorological subdivisions are not districts. No automatic district-to-subdivision crosswalk is inferred.",
    },
  };
}
