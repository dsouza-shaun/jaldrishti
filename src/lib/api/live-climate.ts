import {
  addOpenMeteoApiKey,
  getOpenMeteoUrl,
} from "@/lib/api/open-meteo-url";
import {
  fetchJsonCached,
  type ProviderAttribution,
  type ProviderResult,
} from "@/lib/api/external-api";
import {
  roundCoordinate,
  type Coordinates,
} from "@/lib/data/geo";

const WEATHER_DESCRIPTIONS: Readonly<Record<number, string>> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  97: "Heavy thunderstorm",
  99: "Thunderstorm with heavy hail",
};

export interface CurrentClimate {
  time: string | null;
  intervalSeconds: number | null;
  isDay: boolean | null;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  relativeHumidityPercent: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  showersMm: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  cloudCoverPercent: number | null;
  surfacePressureHpa: number | null;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
  windDirectionDegrees: number | null;
  shortwaveRadiationWm2: number | null;
  directRadiationWm2: number | null;
  evapotranspirationMm: number | null;
  referenceEt0Mm: number | null;
  soilMoistureM3M3: {
    depth0To1cm: number | null;
    depth3To9cm: number | null;
    depth27To81cm: number | null;
  };
  vapourPressureDeficitKpa: number | null;
  convectiveAvailablePotentialEnergy: number | null;
}

export interface DailyClimate {
  date: string;
  weatherCode: number | null;
  weatherDescription: string | null;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  temperatureMeanC: number | null;
  precipitationMm: number | null;
  precipitationProbabilityMaxPercent: number | null;
  precipitationHours: number | null;
  et0Mm: number | null;
  shortwaveRadiationMjM2: number | null;
  sunshineDurationSeconds: number | null;
  uvIndexMax: number | null;
  windSpeedMaxKmh: number | null;
  windGustMaxKmh: number | null;
}

export interface HourlyClimate {
  time: string;
  temperatureC: number | null;
  relativeHumidityPercent: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPercent: number | null;
  evapotranspirationMm: number | null;
  referenceEt0Mm: number | null;
  shortwaveRadiationWm2: number | null;
  windSpeed80mKmh: number | null;
  windSpeed120mKmh: number | null;
  soilMoisture3To9cmM3M3: number | null;
}

export interface ClimateSnapshot {
  coordinates: Coordinates;
  resolvedCoordinates: Coordinates;
  elevationM: number | null;
  timezone: string | null;
  utcOffsetSeconds: number | null;
  current: CurrentClimate | null;
  hourly: HourlyClimate[];
  daily: DailyClimate[];
  sevenDayWaterBalanceMm: {
    precipitation: number | null;
    referenceEt0: number | null;
    precipitationMinusEt0: number | null;
  };
  attribution: ProviderAttribution;
  modelCaveat: string;
}

export type ClimateResult = ProviderResult<ClimateSnapshot>;

interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  current?: Record<string, number | string | null>;
  hourly?: Record<string, Array<number | string | null> | undefined>;
  daily?: Record<string, Array<number | string | null> | undefined>;
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

function describeWeather(code: number | null): string | null {
  return code === null ? null : (WEATHER_DESCRIPTIONS[code] ?? "Unknown");
}

function mapCurrent(
  current: Record<string, number | string | null> | undefined,
): CurrentClimate | null {
  if (!current) return null;
  const weatherCode = finiteNumber(current.weather_code);

  return {
    time: textValue(current.time),
    intervalSeconds: finiteNumber(current.interval),
    isDay:
      current.is_day === null || current.is_day === undefined
        ? null
        : Boolean(current.is_day),
    temperatureC: finiteNumber(current.temperature_2m),
    apparentTemperatureC: finiteNumber(current.apparent_temperature),
    relativeHumidityPercent: finiteNumber(current.relative_humidity_2m),
    precipitationMm: finiteNumber(current.precipitation),
    rainMm: finiteNumber(current.rain),
    showersMm: finiteNumber(current.showers),
    weatherCode,
    weatherDescription: describeWeather(weatherCode),
    cloudCoverPercent: finiteNumber(current.cloud_cover),
    surfacePressureHpa: finiteNumber(current.surface_pressure),
    windSpeedKmh: finiteNumber(current.wind_speed_10m),
    windGustKmh: finiteNumber(current.wind_gusts_10m),
    windDirectionDegrees: finiteNumber(current.wind_direction_10m),
    shortwaveRadiationWm2: finiteNumber(current.shortwave_radiation),
    directRadiationWm2: finiteNumber(current.direct_radiation),
    evapotranspirationMm: finiteNumber(current.evapotranspiration),
    referenceEt0Mm: finiteNumber(current.et0_fao_evapotranspiration),
    soilMoistureM3M3: {
      depth0To1cm: finiteNumber(current.soil_moisture_0_to_1cm),
      depth3To9cm: finiteNumber(current.soil_moisture_3_to_9cm),
      depth27To81cm: finiteNumber(current.soil_moisture_27_to_81cm),
    },
    vapourPressureDeficitKpa: finiteNumber(current.vapour_pressure_deficit),
    convectiveAvailablePotentialEnergy: finiteNumber(current.cape),
  };
}

function mapDaily(response: OpenMeteoResponse): DailyClimate[] {
  const daily = response.daily;
  const dates = daily?.time;
  if (!dates) return [];

  const columns = {
    weatherCode: finiteNumberArray(daily.weather_code),
    temperatureMaxC: finiteNumberArray(daily.temperature_2m_max),
    temperatureMinC: finiteNumberArray(daily.temperature_2m_min),
    temperatureMeanC: finiteNumberArray(daily.temperature_2m_mean),
    precipitationMm: finiteNumberArray(daily.precipitation_sum),
    precipitationProbabilityMaxPercent: finiteNumberArray(
      daily.precipitation_probability_max,
    ),
    precipitationHours: finiteNumberArray(daily.precipitation_hours),
    et0Mm: finiteNumberArray(daily.et0_fao_evapotranspiration),
    shortwaveRadiationMjM2: finiteNumberArray(daily.shortwave_radiation_sum),
    sunshineDurationSeconds: finiteNumberArray(daily.sunshine_duration),
    uvIndexMax: finiteNumberArray(daily.uv_index_max),
    windSpeedMaxKmh: finiteNumberArray(daily.wind_speed_10m_max),
    windGustMaxKmh: finiteNumberArray(daily.wind_gusts_10m_max),
  };

  return dates.slice(0, 7).map((date, index) => ({
    date: String(date),
    weatherCode: columns.weatherCode[index] ?? null,
    weatherDescription: describeWeather(columns.weatherCode[index] ?? null),
    temperatureMaxC: columns.temperatureMaxC[index] ?? null,
    temperatureMinC: columns.temperatureMinC[index] ?? null,
    temperatureMeanC: columns.temperatureMeanC[index] ?? null,
    precipitationMm: columns.precipitationMm[index] ?? null,
    precipitationProbabilityMaxPercent:
      columns.precipitationProbabilityMaxPercent[index] ?? null,
    precipitationHours: columns.precipitationHours[index] ?? null,
    et0Mm: columns.et0Mm[index] ?? null,
    shortwaveRadiationMjM2: columns.shortwaveRadiationMjM2[index] ?? null,
    sunshineDurationSeconds: columns.sunshineDurationSeconds[index] ?? null,
    uvIndexMax: columns.uvIndexMax[index] ?? null,
    windSpeedMaxKmh: columns.windSpeedMaxKmh[index] ?? null,
    windGustMaxKmh: columns.windGustMaxKmh[index] ?? null,
  }));
}

function mapHourly(response: OpenMeteoResponse): HourlyClimate[] {
  const hourly = response.hourly;
  const times = hourly?.time;
  if (!times) return [];

  const temperature = finiteNumberArray(hourly.temperature_2m);
  const humidity = finiteNumberArray(hourly.relative_humidity_2m);
  const precipitation = finiteNumberArray(hourly.precipitation);
  const probability = finiteNumberArray(hourly.precipitation_probability);
  const evapotranspiration = finiteNumberArray(hourly.evapotranspiration);
  const et0 = finiteNumberArray(hourly.et0_fao_evapotranspiration);
  const radiation = finiteNumberArray(hourly.shortwave_radiation);
  const wind80 = finiteNumberArray(hourly.wind_speed_80m);
  const wind120 = finiteNumberArray(hourly.wind_speed_120m);
  const soilMoisture = finiteNumberArray(hourly.soil_moisture_3_to_9cm);

  return times.slice(0, 24).map((time, index) => ({
    time: String(time),
    temperatureC: temperature[index] ?? null,
    relativeHumidityPercent: humidity[index] ?? null,
    precipitationMm: precipitation[index] ?? null,
    precipitationProbabilityPercent: probability[index] ?? null,
    evapotranspirationMm: evapotranspiration[index] ?? null,
    referenceEt0Mm: et0[index] ?? null,
    shortwaveRadiationWm2: radiation[index] ?? null,
    windSpeed80mKmh: wind80[index] ?? null,
    windSpeed120mKmh: wind120[index] ?? null,
    soilMoisture3To9cmM3M3: soilMoisture[index] ?? null,
  }));
}

function completeSum(
  values: Array<number | null>,
  expectedCount = 7,
): number | null {
  if (
    values.length !== expectedCount ||
    values.length === 0 ||
    values.some((value) => value === null)
  ) {
    return null;
  }
  return Number(
    values.reduce<number>((total, value) => total + (value ?? 0), 0).toFixed(2),
  );
}

export async function getClimate(
  coordinates: Coordinates,
): Promise<ClimateResult> {
  const queryCoordinates = {
    latitude: roundCoordinate(coordinates.latitude, 3),
    longitude: roundCoordinate(coordinates.longitude, 3),
  };
  const url = getOpenMeteoUrl(
    "OPEN_METEO_FORECAST_BASE_URL",
    "https://api.open-meteo.com/v1/forecast",
    "https://customer-api.open-meteo.com/v1/forecast",
  );
  url.search = new URLSearchParams({
    latitude: String(queryCoordinates.latitude),
    longitude: String(queryCoordinates.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "weather_code",
      "cloud_cover",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "shortwave_radiation",
      "direct_radiation",
      "evapotranspiration",
      "et0_fao_evapotranspiration",
      "soil_moisture_0_to_1cm",
      "soil_moisture_3_to_9cm",
      "soil_moisture_27_to_81cm",
      "vapour_pressure_deficit",
      "cape",
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "evapotranspiration",
      "et0_fao_evapotranspiration",
      "shortwave_radiation",
      "wind_speed_80m",
      "wind_speed_120m",
      "soil_moisture_3_to_9cm",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "temperature_2m_mean",
      "precipitation_sum",
      "precipitation_probability_max",
      "precipitation_hours",
      "et0_fao_evapotranspiration",
      "shortwave_radiation_sum",
      "sunshine_duration",
      "uv_index_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
    ].join(","),
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timezone: "auto",
    forecast_hours: "48",
    forecast_days: "7",
  }).toString();
  addOpenMeteoApiKey(url);

  const result = await fetchJsonCached<OpenMeteoResponse>(
    `open-meteo:forecast:v2:${queryCoordinates.latitude},${queryCoordinates.longitude}`,
    url,
    {
      provider: "Open-Meteo Weather Forecast API",
      ttlMs: 30 * 60 * 1_000,
      staleMs: 6 * 60 * 60 * 1_000,
      timeoutMs: 8_000,
      cacheTags: ["external", "weather", "open-meteo"],
    },
  );

  if (!result.data.current && !result.data.daily) {
    throw new Error(
      result.data.reason || "Open-Meteo returned no usable weather data",
    );
  }

  const daily = mapDaily(result.data);
  const precipitation = completeSum(
    daily.map((day) => day.precipitationMm),
  );
  const et0 = completeSum(daily.map((day) => day.et0Mm));

  return {
    ...result,
    data: {
      coordinates: queryCoordinates,
      resolvedCoordinates: {
        latitude: finiteNumber(result.data.latitude) ?? queryCoordinates.latitude,
        longitude: finiteNumber(result.data.longitude) ?? queryCoordinates.longitude,
      },
      elevationM: finiteNumber(result.data.elevation),
      timezone: textValue(result.data.timezone),
      utcOffsetSeconds: finiteNumber(result.data.utc_offset_seconds),
      current: mapCurrent(result.data.current),
      hourly: mapHourly(result.data),
      daily,
      sevenDayWaterBalanceMm: {
        precipitation,
        referenceEt0: et0,
        precipitationMinusEt0:
          precipitation === null || et0 === null
            ? null
            : Number((precipitation - et0).toFixed(2)),
      },
      attribution: {
        label: "Weather data by Open-Meteo.com",
        sourceUrl: "https://open-meteo.com/en/docs",
        licenseUrl: "https://open-meteo.com/en/terms",
        transformationNote:
          "Variables are selected, temporally sliced, and lightly normalized by JalDrishti.",
      },
      modelCaveat:
        "Model-derived weather, soil moisture, radiation, and ET0; not a station observation or regulatory measurement.",
    },
  };
}
