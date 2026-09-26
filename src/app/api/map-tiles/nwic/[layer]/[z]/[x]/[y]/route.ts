import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import {
  NWIC_LAYERS,
  fetchNwicTile,
  isNwicLayerKey,
  isValidTile,
  tileToBbox3857,
  transparentTile,
  type NwicOutcome,
} from "@/lib/data/nwic-wms";

/**
 * Server-side WMS tile relay for the National Water Mission ground water map.
 *
 * This route exists for two independent reasons:
 *
 *   1. The upstream allows `Access-Control-Allow-Origin` of its own host only,
 *      so a browser cannot request these tiles even with a session.
 *   2. The upstream is behind a login. Only a server may hold the session, and
 *      a cookie must never be shipped to the client.
 *
 * The bbox is recomputed from `z`/`x`/`y` here rather than read from a query
 * parameter, so nothing a client sends can influence the upstream URL.
 *
 * Every failure answers `200` with a transparent PNG and an `X-Tile-Outcome`
 * header. A dead upstream must not turn into a sea of broken-tile icons, and
 * `200` lets the CDN cache the miss instead of re-asking for it on every pan.
 */

export const runtime = "nodejs";

/**
 * Upstream imagery changes on a survey cycle, not per request, so tiles stay
 * valid for a long time. A week of shared caching absorbs normal panning; a
 * month of staleness keeps the origin quiet during a long session.
 */
const TILE_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";

/**
 * When the upstream is known-dead, a transparent tile is the correct answer for
 * a long time. Caching it briefly would still leave the map blank, and
 * re-probing on every pan is exactly the traffic pattern we want to avoid when
 * there is no session.
 */
const BLANK_CACHE_CONTROL =
  "public, max-age=300, s-maxage=900, stale-while-revalidate=86400";

function pngResponse(
  bytes: Uint8Array,
  outcome: NwicOutcome,
  status: number | null,
  cacheControl: string,
): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": cacheControl,
      "X-Tile-Outcome": outcome,
      ...(status ? { "X-Tile-Upstream-Status": String(status) } : {}),
    },
  });
}

function blankTile(outcome: NwicOutcome, status: number | null): Response {
  return pngResponse(
    transparentTile(),
    outcome,
    status,
    outcome === "error" ? "no-store" : BLANK_CACHE_CONTROL,
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string; layer: string }> },
): Promise<Response> {
  const params = await context.params;
  const { layer: layerKey, z, x, y } = params;

  if (!isNwicLayerKey(layerKey)) {
    return new Response("Unknown ground water layer.", { status: 404 });
  }
  const layer = NWIC_LAYERS[layerKey];

  // A 256px tile is the upstream contract; anything larger just burns
  // bandwidth on a service we do not control.
  const zoom = Number(z);
  if (Number.isInteger(zoom) && zoom > layer.maxzoom) {
    return blankTile("error", null);
  }

  // Generous ceiling: a single map view asks for a few dozen tiles, and this
  // limit exists to stop a runaway client, not to ration normal use.
  const rate = checkEdgeRateLimit(request, `nwic-tile-${layerKey}`, 600, 60_000);
  if (!rate.allowed) {
    return new Response("Too many tile requests.", {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(rate.retryAfterSeconds) },
    });
  }

  const tile = { z: Number(z), x: Number(x), y: Number(y) };
  if (!isValidTile(tile)) {
    return new Response("Malformed tile coordinate.", { status: 400 });
  }

  const bbox = tileToBbox3857(tile);
  const result = await fetchNwicTile(layer, bbox);

  if (result.outcome !== "ok" || !result.bytes) {
    // Not an error to shout about: a missing session is the expected default
    // deployment. Log once at a low volume so real faults stay visible.
    if (result.outcome === "error") {
      console.warn(`[nwic] ${layerKey} ${z}/${x}/${y}: ${result.detail}`);
    }
    return blankTile(result.outcome, result.upstreamStatus);
  }

  return pngResponse(result.bytes, "ok", result.upstreamStatus, TILE_CACHE_CONTROL);
}
