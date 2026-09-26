import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import { getLandCoverCatalog } from "@/lib/data/land-cover-render";

/**
 * Catalogue of the bundled ESA WorldCover footprints.
 *
 * The client needs the bounds to place each raster on the map as a MapLibre
 * `image` source, and the legend to label the overlay. Without this the
 * bundled rasters are sampled for one class code and then never seen.
 */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "land-cover-catalog", 60, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const catalog = await getLandCoverCatalog();
    return Response.json(catalog, {
      headers: {
        // The bundle is fixed at build time, so this can be cached hard.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("[land-cover-catalog]", error);
    return Response.json(
      { error: "Bundled land-cover rasters are unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
