import {
  invalidCoordinateResponse,
  parseCoordinates,
} from "@/lib/api/request";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import { upstreamErrorResponse } from "@/lib/api/responses";
import { lookupLandCover } from "@/lib/data/land-cover-data";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "land-cover", 120, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const parsed = parseCoordinates(request);
  if (!parsed.ok) return invalidCoordinateResponse(parsed.error);

  try {
    const result = await lookupLandCover(parsed.coordinates);
    return Response.json(
      { coordinates: parsed.coordinates, ...result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
