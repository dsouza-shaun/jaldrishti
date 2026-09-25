import {
  getClimate,
  type ClimateResult,
} from "@/lib/api/live-climate";
import {
  reverseGeocode,
  type ReverseGeocodeResult,
} from "@/lib/api/reverse-geocoder";
import type { DataProvenance } from "@/lib/data/dataset-types";
import { type Coordinates } from "@/lib/data/geo";
import {
  lookupLandCover,
  type LandCoverLookup,
} from "@/lib/data/land-cover-data";
import {
  findNearestPowerPlants,
  type NearbyPowerPlant,
} from "@/lib/data/power-plants-data";

export interface DataProviderFailure {
  provider: string;
  message: string;
}

export interface SiteDataContext {
  location: ReverseGeocodeResult | null;
  climate: ClimateResult | null;
  nearbyPowerPlants: NearbyPowerPlant[];
  powerProvenance: DataProvenance;
  landCover: LandCoverLookup | null;
  failures: DataProviderFailure[];
  /** Set when a scenario reuses the baseline site's data snapshot. */
  reusedAt?: string | null;
}

const POWER_PROVENANCE: DataProvenance = {
  source: "Global Power Plant Database (GPPD), bundled India derivative",
  sourceDate: "Capacity and generation vintages vary by plant",
  evidenceStatus: "PROXY",
  datasetFile: "datasets/india_power_plant_dataset.csv",
  caveat:
    "Plant proximity and nameplate capacity do not establish grid capacity, transmission availability, or connection feasibility.",
};

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Provider unavailable";
}

async function capture<T>(
  provider: string,
  operation: () => Promise<T>,
): Promise<{ value: T | null; failure: DataProviderFailure | null }> {
  try {
    return { value: await operation(), failure: null };
  } catch (error) {
    return {
      value: null,
      failure: { provider, message: failureMessage(error) },
    };
  }
}

/** Loads all independent site-context sources concurrently and degrades safely. */
export async function loadSiteDataContext(
  coordinates: Coordinates,
): Promise<SiteDataContext> {
  const [location, climate, powerPlants, landCover] = await Promise.all([
    capture("Nominatim / OpenStreetMap", () => reverseGeocode(coordinates)),
    capture("Open-Meteo Weather Forecast API", () => getClimate(coordinates)),
    capture("Bundled power-plant dataset", () =>
      findNearestPowerPlants(coordinates, 5),
    ),
    capture("Bundled WorldCover rasters", () => lookupLandCover(coordinates)),
  ]);

  return {
    location: location.value,
    climate: climate.value,
    nearbyPowerPlants: powerPlants.value ?? [],
    powerProvenance: POWER_PROVENANCE,
    landCover: landCover.value,
    failures: [location.failure, climate.failure, powerPlants.failure, landCover.failure].filter(
      (failure): failure is DataProviderFailure => failure !== null,
    ),
    reusedAt: null,
  };
}
