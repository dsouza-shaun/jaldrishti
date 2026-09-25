import { getHistoricalRainfall } from "@/lib/data/rainfall-data";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import { upstreamErrorResponse } from "@/lib/api/responses";

export const runtime = "nodejs";

function yearParameter(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
): number | null {
  const raw = searchParams.get(name);
  if (raw === null) return defaultValue;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1800 && value <= 2100
    ? value
    : null;
}

export async function GET(request: Request): Promise<Response> {
  const rate = checkEdgeRateLimit(request, "rainfall-history", 60, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const url = new URL(request.url);
  const subdivision = url.searchParams.get("subdivision")?.trim();
  if (!subdivision || subdivision.length > 100) {
    return Response.json(
      {
        error: {
          code: "INVALID_SUBDIVISION",
          message: "Provide an IMD subdivision name of 1-100 characters.",
        },
      },
      { status: 400 },
    );
  }

  const startYear = yearParameter(url.searchParams, "startYear", 1901);
  const endYear = yearParameter(url.searchParams, "endYear", 2015);
  if (startYear === null || endYear === null || endYear < startYear) {
    return Response.json(
      {
        error: {
          code: "INVALID_YEAR_RANGE",
          message: "Use integer years between 1800 and 2100 with endYear >= startYear.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await getHistoricalRainfall(subdivision, startYear, endYear);
    if (!result) {
      return Response.json(
        {
          error: {
            code: "SUBDIVISION_NOT_FOUND",
            message: "No exact IMD meteorological-subdivision match or data in the requested range was found.",
          },
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
