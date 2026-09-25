import {
  ExternalApiError,
  fetchJsonCached,
  type ProviderAttribution,
  type ProviderResult,
} from "@/lib/api/external-api";
import {
  addOpenMeteoApiKey,
  getOpenMeteoUrl,
} from "@/lib/api/open-meteo-url";
import { getClimate, type ClimateResult } from "@/lib/api/live-climate";
import {
  roundCoordinate,
  type Coordinates,
} from "@/lib/data/geo";

export interface AirQualityReading {
  time: string | null;
  intervalSeconds: number | null;
  pm10UgM3: number | null;
  pm25UgM3: number | null;
  carbonMonoxideUgM3: number | null;
  nitrogenDioxideUgM3: number | null;
  sulphurDioxideUgM3: number | null;
  ozoneUgM3: number | null;
  dustUgM3: number | null;
  aerosolOpticalDepth: number | null;
  uvIndex: number | null;
  usAqi: number | null;
  usAqiLabel: string | null;
}

export interface AirQualityForecastPoint {
  time: string;
  pm10UgM3: number | null;
  pm25UgM3: number | null;
}

export interface AirQualitySnapshot {
  coordinates: Coordinates;
  utcOffsetSeconds: number | null;
  current: AirQualityReading | null;
  next24Hours: AirQualityForecastPoint[];
  spatialResolutionKm: number;
  attribution: ProviderAttribution;
  caveat: string;
}

export type AirQualityResult = ProviderResult<AirQualitySnapshot>;

export interface RiverDischargePoint {
  date: string;
  dischargeCubicMetresPerSecond: number | null;
  period: "past" | "forecast";
}

export interface AggregateCoverage {
  mean: number | null;
  sampleCount: number;
  expectedCount: number;
  complete: boolean;
}

export interface FloodSnapshot {
  coordinates: Coordinates;
  resolvedCoordinates: Coordinates;
  timezone: string;
  validThrough: string | null;
  isStale: boolean;
  latest: RiverDischargePoint | null;
  periodCoverage: {
    past7: AggregateCoverage;
    forecast7: AggregateCoverage;
    forecast30: AggregateCoverage;
  };
  forecast7Day: RiverDischargePoint[];
  forecast30Day: RiverDischargePoint[];
  trendPercentVsPast7DayMean: number | null;
  attribution: ProviderAttribution;
  caveat: string;
}

export type FloodResult = ProviderResult<FloodSnapshot>;

export interface EnvironmentPartialFailure {
  provider: string;
  message: string;
}

export interface EnvironmentSnapshot {
  generatedAt: string;
  climate: ClimateResult | null;
  airQuality: AirQualityResult | null;
  flood: FloodResult | null;
  failures: EnvironmentPartialFailure[];
}

interface AirQualityResponse {
  latitude?: number;
  longitude?: number;
  utc_offset_seconds?: number;
  current?: Record<string, number | string | null>;
  hourly?: Record<string, Array<number | string | null> | undefined>;
  reason?: string;
}

interface FloodResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  daily?: {
    time?: string[];
    river_discharge?: Array<number | null>;
  };
  reason?: string;
}

function finiteNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteNumberArray(
  values: Array<number | string | null> | undefined,
): Array<number | null> {
  return (values ?? []).map(finiteNumber);
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function usAqiLabel(value: number | null): string | null {
  if (value === null) return null;
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}

function mapAirQualityCurrent(
  current: Record<string, number | string | null> | undefined,
): AirQualityReading | null {
  if (!current) return null;
  const usAqi = finiteNumber(current.us_aqi);
  return {
    time: textValue(current.time),
    intervalSeconds: finiteNumber(current.interval),
    pm10UgM3: finiteNumber(current.pm10),
    pm25UgM3: finiteNumber(current.pm2_5),
    carbonMonoxideUgM3: finiteNumber(current.carbon_monoxide),
    nitrogenDioxideUgM3: finiteNumber(current.nitrogen_dioxide),
    sulphurDioxideUgM3: finiteNumber(current.sulphur_dioxide),
    ozoneUgM3: finiteNumber(current.ozone),
    dustUgM3: finiteNumber(current.dust),
    aerosolOpticalDepth: finiteNumber(current.aerosol_optical_depth),
    uvIndex: finiteNumber(current.uv_index),
    usAqi,
    usAqiLabel: usAqiLabel(usAqi),
  };
}

export async function getAirQuality(
  coordinates: Coordinates,
): Promise<AirQualityResult> {
  const queryCoordinates = {
    latitude: roundCoordinate(coordinates.latitude, 2),
    longitude: roundCoordinate(coordinates.longitude, 2),
  };
  const url = getOpenMeteoUrl(
    "OPEN_METEO_AIR_QUALITY_BASE_URL",
    "https://air-quality-api.open-meteo.com/v1/air-quality",
    "https://customer-air-quality-api.open-meteo.com/v1/air-quality",
  );
  url.search = new URLSearchParams({
    latitude: String(queryCoordinates.latitude),
    longitude: String(queryCoordinates.longitude),
    current: [
      "pm10",
      "pm2_5",
      "carbon_monoxide",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "ozone",
      "aerosol_optical_depth",
      "dust",
      "uv_index",
      "us_aqi",
    ].join(","),
    hourly: "pm10,pm2_5",
    domains: "cams_global",
    timezone: "auto",
    forecast_hours: "72",
  }).toString();
  addOpenMeteoApiKey(url);

  const result = await fetchJsonCached<AirQualityResponse>(
    `open-meteo:air-quality:v1:${queryCoordinates.latitude},${queryCoordinates.longitude}`,
    url,
    {
      provider: "Open-Meteo Air Quality API (CAMS)",
      ttlMs: 60 * 60 * 1_000,
      staleMs: 6 * 60 * 60 * 1_000,
      timeoutMs: 8_000,
      cacheTags: ["external", "air-quality", "open-meteo"],
    },
  );

  const hourlyTimes = result.data.hourly?.time ?? [];
  const pm10 = finiteNumberArray(result.data.hourly?.pm10);
  const pm25 = finiteNumberArray(result.data.hourly?.pm2_5);
  const next24Hours = hourlyTimes.slice(0, 24).map((time, index) => ({
    time: String(time),
    pm10UgM3: pm10[index] ?? null,
    pm25UgM3: pm25[index] ?? null,
  }));

  if (!result.data.current && next24Hours.length === 0) {
    throw new Error(result.data.reason || "Air-quality provider returned no data");
  }

  return {
    ...result,
    data: {
      coordinates: queryCoordinates,
      utcOffsetSeconds: finiteNumber(result.data.utc_offset_seconds),
      current: mapAirQualityCurrent(result.data.current),
      next24Hours,
      spatialResolutionKm: 45,
      attribution: {
        label: "Air-quality data by Open-Meteo.com / CAMS ENSEMBLE",
        sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
        licenseUrl: "https://open-meteo.com/en/terms",
        transformationNote:
          "JalDrishti requests CAMS-global current and 72-hour fields and exposes the first 24 hours.",
      },
      caveat:
        "Global CAMS model forecast, not an Indian regulatory station observation. US AQI is shown only as a model indicator.",
    },
  };
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function summarize(
  values: Array<number | null>,
  expectedCount: number,
): AggregateCoverage {
  const finite = values.filter((value): value is number => value !== null);
  return {
    mean:
      finite.length === 0
        ? null
        : Number(
            (
              finite.reduce((sum, value) => sum + value, 0) / finite.length
            ).toFixed(2),
          ),
    sampleCount: finite.length,
    expectedCount,
    complete: finite.length === expectedCount && expectedCount > 0,
  };
}

export async function getFloodForecast(
  coordinates: Coordinates,
): Promise<FloodResult> {
  const queryCoordinates = {
    latitude: roundCoordinate(coordinates.latitude, 2),
    longitude: roundCoordinate(coordinates.longitude, 2),
  };
  const url = getOpenMeteoUrl(
    "OPEN_METEO_FLOOD_BASE_URL",
    "https://flood-api.open-meteo.com/v1/flood",
    "https://customer-flood-api.open-meteo.com/v1/flood",
  );
  url.search = new URLSearchParams({
    latitude: String(queryCoordinates.latitude),
    longitude: String(queryCoordinates.longitude),
    daily: "river_discharge",
    past_days: "7",
    forecast_days: "30",
  }).toString();
  addOpenMeteoApiKey(url);

  const result = await fetchJsonCached<FloodResponse>(
    `open-meteo:flood:v1:${utcDate()}:${queryCoordinates.latitude},${queryCoordinates.longitude}`,
    url,
    {
      provider: "Open-Meteo Flood API (GloFAS)",
      ttlMs: 60 * 60 * 1_000,
      staleMs: 3 * 60 * 60 * 1_000,
      timeoutMs: 8_000,
      cacheTags: ["external", "flood", "open-meteo"],
    },
  );

  const times = result.data.daily?.time;
  const discharge = finiteNumberArray(result.data.daily?.river_discharge);
  if (!times || times.length === 0) {
    throw new Error(result.data.reason || "Flood provider returned no data");
  }

  const today = utcDate();
  const allPoints = times.map((date, index) => ({
    date,
    dischargeCubicMetresPerSecond: discharge[index] ?? null,
    period: (date < today ? "past" : "forecast") as "past" | "forecast",
  }));
  const past = allPoints.filter((point) => point.period === "past").slice(-7);
  const forecast = allPoints
    .filter((point) => point.period === "forecast")
    .slice(0, 30);
  const pastSummary = summarize(
    past.map((point) => point.dischargeCubicMetresPerSecond),
    7,
  );
  const forecast7Summary = summarize(
    forecast.slice(0, 7).map((point) => point.dischargeCubicMetresPerSecond),
    7,
  );
  const forecast30Summary = summarize(
    forecast.map((point) => point.dischargeCubicMetresPerSecond),
    30,
  );
  const latest = past.at(-1) ?? allPoints[0] ?? null;
  const validThrough = allPoints.at(-1)?.date ?? null;
  const isStale = result.cacheStatus === "STALE" || !validThrough || validThrough < today;
  const trendPercentVsPast7DayMean =
    latest?.dischargeCubicMetresPerSecond !== null &&
    latest?.dischargeCubicMetresPerSecond !== undefined &&
    pastSummary.mean !== null && pastSummary.mean !== 0
      ? Number(
          (
            ((latest.dischargeCubicMetresPerSecond - pastSummary.mean) /
              pastSummary.mean) *
            100
          ).toFixed(1),
        )
      : null;

  return {
    ...result,
    data: {
      coordinates: queryCoordinates,
      resolvedCoordinates: {
        latitude: finiteNumber(result.data.latitude) ?? queryCoordinates.latitude,
        longitude: finiteNumber(result.data.longitude) ?? queryCoordinates.longitude,
      },
      timezone: "UTC",
      validThrough,
      isStale,
      latest,
      periodCoverage: {
        past7: pastSummary,
        forecast7: forecast7Summary,
        forecast30: forecast30Summary,
      },
      forecast7Day: forecast.slice(0, 7),
      forecast30Day: forecast,
      trendPercentVsPast7DayMean,
      attribution: {
        label: "River discharge by Open-Meteo.com / Copernicus GloFAS",
        sourceUrl: "https://open-meteo.com/en/docs/flood-api",
        licenseUrl: "https://open-meteo.com/en/terms",
        transformationNote:
          "Daily discharge dates are classified in UTC; JalDrishti reports coverage counts and stale validity instead of treating missing days as zero.",
      },
      caveat:
        "GloFAS selects the largest river in a roughly 5 km grid cell. It is a discharge proxy, not a gauge reading or site-level flood-depth assessment.",
    },
  };
}

function partialFailure(provider: string, reason: unknown): EnvironmentPartialFailure {
  const status = reason instanceof ExternalApiError ? reason.status : undefined;
  return {
    provider,
    message:
      status === 429
        ? "Provider rate limit reached."
        : "Provider unavailable; this source was omitted.",
  };
}

export async function getEnvironmentSnapshot(
  coordinates: Coordinates,
): Promise<EnvironmentSnapshot> {
  const [climate, airQuality, flood] = await Promise.allSettled([
    getClimate(coordinates),
    getAirQuality(coordinates),
    getFloodForecast(coordinates),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    climate: climate.status === "fulfilled" ? climate.value : null,
    airQuality: airQuality.status === "fulfilled" ? airQuality.value : null,
    flood: flood.status === "fulfilled" ? flood.value : null,
    failures: [
      ...(climate.status === "rejected"
        ? [partialFailure("Open-Meteo Weather Forecast API", climate.reason)]
        : []),
      ...(airQuality.status === "rejected"
        ? [partialFailure("Open-Meteo Air Quality API", airQuality.reason)]
        : []),
      ...(flood.status === "rejected"
        ? [partialFailure("Open-Meteo Flood API", flood.reason)]
        : []),
    ],
  };
}
