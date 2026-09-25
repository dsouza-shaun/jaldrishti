import { ExternalApiError } from "@/lib/api/external-api";

export function upstreamErrorResponse(error: unknown): Response {
  if (error instanceof ExternalApiError) {
    if (error.status === 429) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            provider: error.provider,
            message: "Too many provider requests. Retry shortly.",
          },
        },
        {
          status: 429,
          headers: { "Cache-Control": "no-store", "Retry-After": "5" },
        },
      );
    }

    if (error.status === 404) {
      return Response.json(
        {
          error: {
            code: "LOCATION_NOT_FOUND",
            provider: error.provider,
            message: "No reverse-geocoding result was found for this point.",
          },
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error(`[${error.provider}]`, error);
    return Response.json(
      {
        error: {
          code: "UPSTREAM_PROVIDER_ERROR",
          provider: error.provider,
          message: "The upstream data provider is temporarily unavailable.",
        },
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  console.error("[data-provider]", error);
  return Response.json(
    {
      error: {
        code: "DATA_PROVIDER_UNAVAILABLE",
        message: "The requested data is temporarily unavailable.",
      },
    },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
