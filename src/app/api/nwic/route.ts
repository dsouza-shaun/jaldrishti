import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import {
  NWIC_LAYERS,
  fetchNwicFeatureInfo,
  isNwicLayerKey,
  lonLatToTile,
  nwicProvenance,
  pointToTilePixel,
  probeNwic,
  tileToBbox3857,
} from "@/lib/data/nwic-wms";

/**
 * Companion to the tile relay at `/api/map-tiles/nwic/...`.
 *
 *   GET ?action=status            -> is the National Water Mission layer live?
 *   GET ?action=info&lat=&lng=    -> GetFeatureInfo for a clicked map point
 *
 * `status` exists so the map can label the groundwater toggle honestly. An
 * empty toggle with no explanation reads as a bug; a toggle marked
 * "session required" reads as a deployment decision.
 *
 * Both actions run server-side for the same reason the tiles do: the session
 * cookie must stay on the server, and the upstream refuses foreign origins.
 */

export const runtime = "nodejs";

const STATUS_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

function badRequest(message: string): Response {
  return Response.json(
    { error: { code: "BAD_REQUEST", message } },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * `Number(null)` is 0 and `Number("")` is 0, so a missing parameter would
 * otherwise become a perfectly valid query for 0,0 — off the coast of Africa in
 * the Gulf of Guinea. Absent and blank are rejected before conversion.
 */
function parseNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "status";

  if (action === "status") {
    const rate = checkEdgeRateLimit(request, "nwic-status", 20, 60_000);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
    const status = await probeNwic();
    return Response.json(status, {
      headers: { "Cache-Control": STATUS_CACHE_CONTROL },
    });
  }

  if (action === "info") {
    const rate = checkEdgeRateLimit(request, "nwic-info", 60, 60_000);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

    const layerKey = url.searchParams.get("layer") ?? "stations";
    if (!isNwicLayerKey(layerKey)) {
      return badRequest(
        `layer must be one of: ${Object.keys(NWIC_LAYERS).join(", ")}.`,
      );
    }
    const layer = NWIC_LAYERS[layerKey];

    const latitude = parseNumber(url.searchParams.get("lat"));
    const longitude = parseNumber(
      url.searchParams.get("lng") ?? url.searchParams.get("lon"),
    );
    if (latitude === null || longitude === null) {
      return badRequest("Provide finite numeric lat and lng query parameters.");
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return badRequest("lat must be -90..90 and lng must be -180..180.");
    }

    // The upstream expects I/J in pixels within a 256px tile, so the click has
    // to be resolved to a tile first. Snap to a whole zoom, capped at what the
    // layer can actually render, and never below zero.
    const requestedZoom = parseNumber(url.searchParams.get("zoom"));
    const zoom = Math.max(
      0,
      Math.min(
        layer.maxzoom,
        requestedZoom === null ? layer.maxzoom : Math.round(requestedZoom),
      ),
    );

    const tile = lonLatToTile(longitude, latitude, zoom);
    const bbox = tileToBbox3857(tile);
    const pixel = pointToTilePixel(longitude, latitude, tile);
    const result = await fetchNwicFeatureInfo(layer, bbox, pixel);

    if (result.outcome !== "ok") {
      return Response.json(
        {
          outcome: result.outcome,
          feature: null,
          message: result.detail ?? "The ground water service is unavailable.",
          provenance: nwicProvenance(),
          tile,
        },
        {
          status: result.outcome === "no-session" ? 503 : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return Response.json(
      {
        outcome: "ok",
        feature: result.feature,
        message: result.detail ?? null,
        tile,
        pixel,
        provenance: nwicProvenance(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  }

  return badRequest("action must be one of: status, info.");
}
