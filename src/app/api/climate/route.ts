import { getClimate } from "@/lib/api/live-climate";
import {
  invalidCoordinateResponse,
  parseCoordinates,
} from "@/lib/api/request";
import { upstreamErrorResponse } from "@/lib/api/responses";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "climate", 120, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const parsed = parseCoordinates(request);
  if (!parsed.ok) return invalidCoordinateResponse(parsed.error);

  try {
    const result = await getClimate(parsed.coordinates);
    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600",
      },
    });
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
