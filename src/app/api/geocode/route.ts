import { reverseGeocode } from "@/lib/api/reverse-geocoder";
import { upstreamErrorResponse } from "@/lib/api/responses";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import {
  invalidCoordinateResponse,
  parseCoordinates,
} from "@/lib/api/request";
import { findDistrictGroundwater } from "@/lib/data/groundwater-data";
import { findDistrictRainfall } from "@/lib/data/rainfall-data";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "geocode", 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const parsed = parseCoordinates(request);
  if (!parsed.ok) return invalidCoordinateResponse(parsed.error);

  try {
    const result = await reverseGeocode(parsed.coordinates);
    const candidates = result.data.districtCandidates;
    const localErrors: string[] = [];
    const [groundwater, rainfall] = await Promise.all([
      findDistrictGroundwater(result.data.state, candidates).catch((error) => {
        console.error("[geocode-groundwater-csv]", error);
        localErrors.push("groundwater");
        return null;
      }),
      findDistrictRainfall(result.data.state, candidates).catch((error) => {
        console.error("[geocode-rainfall-csv]", error);
        localErrors.push("rainfall");
        return null;
      }),
    ]);
    return Response.json(
      {
        ...result,
        districtDatasets: {
          groundwater,
          rainfall,
        },
        localDataErrors: localErrors,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
