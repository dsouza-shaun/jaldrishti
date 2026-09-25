import type { DataProvenance } from "@/lib/data/dataset-types";
import {
  cleanText,
  loadCsvDataset,
  parseNullableNumber,
} from "@/lib/data/dataset-loader";
import {
  haversineDistanceKm,
  type Coordinates,
} from "@/lib/data/geo";

export interface PowerPlantGeneration {
  year: number | null;
  generationGwh: number;
  estimated: boolean;
}

export interface PowerPlant {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacityMw: number | null;
  capacityDataYear: number | null;
  primaryFuel: string | null;
  otherFuels: string[];
  commissioningYear: number | null;
  owner: string | null;
  source: string | null;
  sourceUrl: string | null;
  geolocationSource: string | null;
  generationDataSource: string | null;
  latestGeneration: PowerPlantGeneration | null;
}

export interface NearbyPowerPlant extends PowerPlant {
  distanceKm: number;
}

interface PowerPlantIndex {
  byId: Map<string, PowerPlant>;
  all: PowerPlant[];
  coordinateCount: number;
  missingCoordinateCount: number;
}

const GENERATION_YEARS = [
  2013, 2014, 2015, 2016, 2017, 2018, 2019,
] as const;

const HEADERS = [
  "country",
  "name",
  "gppd_idnr",
  "capacity_mw",
  "latitude",
  "longitude",
  "primary_fuel",
  "other_fuel1",
  "other_fuel2",
  "other_fuel3",
  "commissioning_year",
  "owner",
  "source",
  "url",
  "geolocation_source",
  "year_of_capacity_data",
  ...GENERATION_YEARS.map((year) => `generation_gwh_${year}`),
  "generation_data_source",
  "estimated_generation_gwh",
] as const;

function latestGeneration(
  row: Readonly<Record<string, string>>,
): PowerPlantGeneration | null {
  for (let index = GENERATION_YEARS.length - 1; index >= 0; index -= 1) {
    const year = GENERATION_YEARS[index];
    const generation = parseNullableNumber(row[`generation_gwh_${year}`]);
    if (generation !== null) {
      return { year, generationGwh: generation, estimated: false };
    }
  }

  const estimated = parseNullableNumber(row.estimated_generation_gwh);
  return estimated === null
    ? null
    : { year: null, generationGwh: estimated, estimated: true };
}

function mapPlant(
  row: Readonly<Record<string, string>>,
): PowerPlant | null {
  const id = cleanText(row.gppd_idnr);
  const name = cleanText(row.name);
  const latitude = parseNullableNumber(row.latitude);
  const longitude = parseNullableNumber(row.longitude);
  if (!id || !name || latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    id,
    name,
    latitude,
    longitude,
    capacityMw: parseNullableNumber(row.capacity_mw),
    capacityDataYear: parseNullableNumber(row.year_of_capacity_data),
    primaryFuel: cleanText(row.primary_fuel),
    otherFuels: [row.other_fuel1, row.other_fuel2, row.other_fuel3]
      .map(cleanText)
      .filter((fuel): fuel is string => fuel !== null),
    commissioningYear: parseNullableNumber(row.commissioning_year),
    owner: cleanText(row.owner),
    source: cleanText(row.source),
    sourceUrl: cleanText(row.url),
    geolocationSource: cleanText(row.geolocation_source),
    generationDataSource: cleanText(row.generation_data_source),
    latestGeneration: latestGeneration(row),
  };
}

let indexPromise: Promise<PowerPlantIndex> | null = null;

async function buildIndex(): Promise<PowerPlantIndex> {
  const table = await loadCsvDataset(
    "india_power_plant_dataset.csv",
    HEADERS,
  );
  const all = table.rows
    .filter((row) => row.country.trim().toUpperCase() === "IND")
    .map(mapPlant)
    .filter((plant): plant is PowerPlant => plant !== null);
  return {
    byId: new Map(all.map((plant) => [plant.id, plant])),
    all,
    coordinateCount: all.length,
    missingCoordinateCount: table.rows.length - all.length,
  };
}

export function getPowerPlantDataset(): Promise<PowerPlantIndex> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

export async function getPowerPlantDatasetSummary() {
  const index = await getPowerPlantDataset();
  return {
    rawRows: index.coordinateCount + index.missingCoordinateCount,
    coordinateBearingRows: index.coordinateCount,
    missingCoordinateRows: index.missingCoordinateCount,
    datasetFile: "datasets/india_power_plant_dataset.csv",
  };
}

export async function findNearestPowerPlants(
  coordinates: Coordinates,
  topN = 5,
): Promise<Array<NearbyPowerPlant>> {
  const index = await getPowerPlantDataset();
  const boundedTopN = Math.max(1, Math.min(20, Math.trunc(topN)));
  const nearest: Array<{ plant: PowerPlant; rawDistanceKm: number }> = [];

  for (const plant of index.all) {
    const rawDistanceKm = haversineDistanceKm(coordinates, plant);
    if (
      nearest.length >= boundedTopN &&
      rawDistanceKm >= nearest.at(-1)!.rawDistanceKm
    ) {
      continue;
    }

    let insertionIndex = nearest.findIndex(
      (item) => item.rawDistanceKm > rawDistanceKm,
    );
    if (insertionIndex < 0) insertionIndex = nearest.length;
    nearest.splice(insertionIndex, 0, { plant, rawDistanceKm });
    if (nearest.length > boundedTopN) nearest.pop();
  }

  return nearest.map(({ plant, rawDistanceKm }) => ({
    ...plant,
    distanceKm: Number(rawDistanceKm.toFixed(2)),
  }));
}

export function powerPlantProvenance(plant: PowerPlant): DataProvenance {
  return {
    source: "Global Power Plant Database (GPPD), bundled India derivative",
    sourceDate: plant.capacityDataYear
      ? `Capacity data year ${plant.capacityDataYear}`
      : "Capacity data year not supplied",
    evidenceStatus: "PROXY",
    datasetFile: "datasets/india_power_plant_dataset.csv",
    sourceUrl: plant.sourceUrl ?? undefined,
    caveat:
      "Plant proximity and nameplate capacity do not establish available grid capacity, transmission distance, or connection feasibility.",
  };
}
