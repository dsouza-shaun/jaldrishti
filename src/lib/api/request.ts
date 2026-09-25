import {
  isValidCoordinates,
  type Coordinates,
} from "@/lib/data/geo";

export type CoordinateParseResult =
  | { ok: true; coordinates: Coordinates }
  | { ok: false; error: string };

function parseNumber(value: string | null, field: string): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCoordinates(request: Request): CoordinateParseResult {
  const url = new URL(request.url);
  const latitude = parseNumber(url.searchParams.get("lat"), "lat");
  const longitude = parseNumber(
    url.searchParams.get("lng") ?? url.searchParams.get("lon"),
    "lng",
  );

  if (latitude === null || longitude === null) {
    return {
      ok: false,
      error: "Provide finite numeric lat and lng query parameters.",
    };
  }

  const coordinates = { latitude, longitude };
  if (!isValidCoordinates(coordinates)) {
    return {
      ok: false,
      error: "lat must be between -90 and 90 and lng between -180 and 180.",
    };
  }

  const inSupportedIndiaRegion =
    coordinates.latitude >= 5 &&
    coordinates.latitude <= 38.5 &&
    coordinates.longitude >= 67 &&
    coordinates.longitude <= 98.5;
  if (!inSupportedIndiaRegion) {
    return {
      ok: false,
      error:
        "This screening currently accepts coordinates only in the supported India region.",
    };
  }

  return { ok: true, coordinates };
}

export function invalidCoordinateResponse(error: string): Response {
  return Response.json(
    { error: { code: "INVALID_COORDINATES", message: error } },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export function parseBoundedInteger(
  request: Request,
  field: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number | null {
  const rawValue = new URL(request.url).searchParams.get(field);
  if (rawValue === null) return defaultValue;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    return null;
  }
  return value;
}
