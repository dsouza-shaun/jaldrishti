import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import {
  invalidCoordinateResponse,
  parseCoordinates,
} from "@/lib/api/request";
import { loadWaterRiskContext } from "@/lib/data/water-risk";

/**
 * Live water-risk read for one site: WRI Aqueduct 4.0 (sector-weighted, with a
 * semiconductor weighting), India district-level water quality and scarcity,
 * and a terrain elevation sample.
 *
 * All three upstreams are keyless and CORS-open, but they are still read
 * server-side so that the process-level cache in `@/lib/api/cached-json` is
 * shared and so the browser never depends on a third party's uptime.
 */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "water-risk", 40, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const parsed = parseCoordinates(request);
  if (!parsed.ok) return invalidCoordinateResponse(parsed.error);

  const { context, failures } = await loadWaterRiskContext(parsed.coordinates);

  // The response is only cacheable when every source answered; a partial
  // payload must not be pinned in a CDN for a day.
  const complete =
    context.aqueduct.available &&
    context.district.available &&
    context.elevation.available;

  return Response.json(
    { coordinates: parsed.coordinates, ...context, failures },
    {
      headers: {
        "Cache-Control": complete
          ? "public, s-maxage=86400, stale-while-revalidate=604800"
          : "no-store",
      },
    },
  );
}
