import {
  ExternalApiError,
  fetchJsonCached,
  type ProviderResult,
} from "@/lib/api/external-api";
import { createSerialRateLimiter } from "@/lib/api/rate-limiter";
import {
  roundCoordinate,
  type Coordinates,
} from "@/lib/data/geo";

export interface ReverseGeocodedLocation {
  queryCoordinates: Coordinates;
  resolvedCoordinates: Coordinates | null;
  displayName: string;
  village: string | null;
  hamlet: string | null;
  town: string | null;
  city: string | null;
  district: string | null;
  districtCandidates: string[];
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  attribution: {
    label: string;
    licenseUrl: string;
    usagePolicyUrl: string;
  };
}

export type ReverseGeocodeResult = ProviderResult<ReverseGeocodedLocation>;

interface NominatimAddress {
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  suburb?: string;
  hamlet?: string;
  neighbourhood?: string;
  county?: string;
  state_district?: string;
  city_district?: string;
  district?: string;
  state?: string;
  "ISO3166-2-lvl4"?: string;
  postcode?: string;
}

interface NominatimResponse {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
}

const globalWithLimiter = globalThis as typeof globalThis & {
  __jaldrishtiNominatimLimiterV1?: ReturnType<typeof createSerialRateLimiter>;
};

const nominatimLimiter =
  globalWithLimiter.__jaldrishtiNominatimLimiterV1 ??
  (globalWithLimiter.__jaldrishtiNominatimLimiterV1 =
    createSerialRateLimiter(1_100));

function getNominatimBaseUrl(): URL {
  const configured = process.env.NOMINATIM_BASE_URL?.trim();
  const url = new URL(configured || "https://nominatim.openstreetmap.org");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NOMINATIM_BASE_URL must use HTTP or HTTPS");
  }
  return url;
}

function firstText(...values: Array<string | undefined>): string | null {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? null;
}

function uniqueTexts(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function parseCoordinate(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapNominatimResponse(
  response: NominatimResponse,
  queryCoordinates: Coordinates,
): ReverseGeocodedLocation {
  if (response.error) {
    throw new ExternalApiError(response.error, "Nominatim", 404);
  }

  const address = response.address ?? {};
  const districtCandidates = uniqueTexts([
    address.state_district,
    address.district,
    address.city_district,
    address.county,
    address.city,
    address.municipality,
    address.town,
  ]);

  return {
    queryCoordinates,
    resolvedCoordinates: {
      latitude: parseCoordinate(response.lat) ?? queryCoordinates.latitude,
      longitude: parseCoordinate(response.lon) ?? queryCoordinates.longitude,
    },
    displayName: response.display_name?.trim() || "Unknown locality",
    village: firstText(address.village),
    hamlet: firstText(address.hamlet),
    town: firstText(address.town),
    city: firstText(address.city, address.municipality, address.town),
    district: districtCandidates[0] ?? null,
    districtCandidates,
    state: firstText(address.state),
    stateCode: firstText(address["ISO3166-2-lvl4"]),
    pincode: firstText(address.postcode),
    attribution: {
      label: "© OpenStreetMap contributors",
      licenseUrl: "https://www.openstreetmap.org/copyright",
      usagePolicyUrl: "https://operations.osmfoundation.org/policies/nominatim/",
    },
  };
}

export async function reverseGeocode(
  coordinates: Coordinates,
): Promise<ReverseGeocodeResult> {
  // Roughly 100 m resolution is sufficient for district-level matching and
  // prevents tiny map movements from creating a new upstream request.
  const queryCoordinates = {
    latitude: roundCoordinate(coordinates.latitude, 3),
    longitude: roundCoordinate(coordinates.longitude, 3),
  };
  const baseUrl = getNominatimBaseUrl();
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/u, "")}/reverse`;
  baseUrl.searchParams.set("format", "jsonv2");
  baseUrl.searchParams.set("lat", String(queryCoordinates.latitude));
  baseUrl.searchParams.set("lon", String(queryCoordinates.longitude));
  baseUrl.searchParams.set(
    "zoom",
    process.env.NOMINATIM_ZOOM?.trim() || "14",
  );
  baseUrl.searchParams.set("addressdetails", "1");
  baseUrl.searchParams.set("accept-language", "en");

  const configuredAgent = process.env.NOMINATIM_USER_AGENT?.trim();
  const userAgent = configuredAgent || "JalDrishti/0.3.1";
  const contact = process.env.NOMINATIM_EMAIL?.trim();
  const headers = {
    "User-Agent": contact ? `${userAgent} (${contact})` : userAgent,
  };

  const result = await fetchJsonCached<NominatimResponse>(
    `nominatim:v2:${queryCoordinates.latitude},${queryCoordinates.longitude}`,
    baseUrl,
    {
      provider: "Nominatim / OpenStreetMap",
      ttlMs: 24 * 60 * 60 * 1_000,
      staleMs: 7 * 24 * 60 * 60 * 1_000,
      timeoutMs: 8_000,
      headers,
      cacheTags: ["external", "geocoding", "nominatim"],
      requestScheduler: (operation) => nominatimLimiter.run(operation),
    },
  );

  return {
    ...result,
    data: mapNominatimResponse(result.data, queryCoordinates),
  };
}
