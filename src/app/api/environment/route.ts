import { getEnvironmentSnapshot } from "@/lib/api/live-environment";
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
  const rate = checkEdgeRateLimit(request, "environment", 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const parsed = parseCoordinates(request);
  if (!parsed.ok) return invalidCoordinateResponse(parsed.error);

  try {
    const result = await getEnvironmentSnapshot(parsed.coordinates);
    const hasAtLeastOneProvider = Boolean(
      result.climate || result.airQuality || result.flood,
    );
    if (!hasAtLeastOneProvider) {
      return Response.json(
        {
          error: {
            code: "ALL_ENVIRONMENT_PROVIDERS_FAILED",
            failures: result.failures,
          },
        },
        { status: 502 },
      );
    }

    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600",
      },
    });
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
