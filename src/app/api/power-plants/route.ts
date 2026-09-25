import {
  findNearestPowerPlants,
  powerPlantProvenance,
} from "@/lib/data/power-plants-data";
import {
  invalidCoordinateResponse,
  parseBoundedInteger,
  parseCoordinates,
} from "@/lib/api/request";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import { upstreamErrorResponse } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "power-plants", 120, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const parsed = parseCoordinates(request);
  if (!parsed.ok) return invalidCoordinateResponse(parsed.error);
  const topN = parseBoundedInteger(request, "topN", 5, 1, 20);
  if (topN === null) {
    return Response.json(
      {
        error: {
          code: "INVALID_TOP_N",
          message: "topN must be an integer between 1 and 20.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const plants = await findNearestPowerPlants(parsed.coordinates, topN);
    return Response.json(
      {
        coordinates: parsed.coordinates,
        count: plants.length,
        plants: plants.map((plant) => ({
          ...plant,
          provenance: powerPlantProvenance(plant),
        })),
        dataSource: {
          name: "Bundled Global Power Plant Database derivative",
          datasetFile: "datasets/india_power_plant_dataset.csv",
          evidenceStatus: "PROXY",
          caveat:
            "Proximity does not establish grid capacity, transmission availability, or connection approval.",
        },
      },
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
