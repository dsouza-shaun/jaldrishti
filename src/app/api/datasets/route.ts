import { getGroundwaterDatasetSummary } from "@/lib/data/groundwater-data";
import { getLandCoverDataset } from "@/lib/data/land-cover-data";
import { getPowerPlantDatasetSummary } from "@/lib/data/power-plants-data";
import { getRainfallDatasetSummary } from "@/lib/data/rainfall-data";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "datasets", 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const [groundwater, rainfall, powerPlants, landCover] = await Promise.all([
      getGroundwaterDatasetSummary(),
      getRainfallDatasetSummary(),
      getPowerPlantDatasetSummary(),
      getLandCoverDataset(),
    ]);

    return Response.json(
      {
        status:
          landCover.summary.skippedFiles.length > 0 ? "degraded" : "ok",
        checkedAt: new Date().toISOString(),
        datasets: {
          groundwater,
          rainfall,
          powerPlants,
          landCover: landCover.summary,
        },
        cache:
          "CSV tables and typed indexes are loaded once per server process; upstream API responses use TTL plus stale-on-error caching.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("[dataset-health]", error);
    return Response.json(
      {
        status: "error",
        error: "Dataset initialization failed.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
