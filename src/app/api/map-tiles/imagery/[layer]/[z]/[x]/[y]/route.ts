import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import {
  AQUEDUCT_SERVICE,
  S2_LANDCOVER_SERVICE,
  buildEsriExportUrl,
} from "@/lib/data/esri-living-atlas";
import {
  TILE_SIZE,
  formatBbox,
  isValidTile,
  tileToBbox3857,
  tileResponse,
  transparentTile,
} from "@/lib/data/web-mercator";

/**
 * Esri Living Atlas imagery relay.
 *
 * The two layers here are image or feature services that do **not** publish a
 * standard `/tile/{z}/{y}/{x}` pyramid, so MapLibre cannot consume them
 * directly even though CORS is wide open. The proxy converts a slippy tile into
 * an ArcGIS `/export` request and streams the PNG back, which puts them on the
 * map as ordinary raster layers.
 *
 * The bbox is recomputed from `z`/`x`/`y`; no client-supplied geometry is
 * forwarded, so this cannot be used to make the upstream render arbitrary
 * extents. Failure answers 200 with a transparent tile — a dead upstream should
 * leave the basemap intact, not scatter broken-image markers across the map.
 */

export const runtime = "nodejs";

/** Tiles are a 2021 land-cover snapshot and a 2019 model; they barely move. */
const TILE_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const BLANK_CACHE_CONTROL =
  "public, max-age=600, s-maxage=1800, stale-while-revalidate=86400";

interface ImageryLayer {
  label: string;
  /** Above this zoom the source resolution adds nothing but traffic. */
  maxzoom: number;
  minzoom: number;
  buildUrl: (bbox: string) => URL;
  attribution: string;
}

const IMAGERY_LAYERS: Record<string, ImageryLayer> = {
  "s2-landcover": {
    label: S2_LANDCOVER_SERVICE.title,
    minzoom: 6,
    maxzoom: 15,
    // Sentinel-2 is 10 m, so zooming past ~z15 (≈1 m/px at India's latitude)
    // is pure upsampling.
    buildUrl: (bbox) => buildEsriExportUrl(S2_LANDCOVER_SERVICE, { bbox }),
    attribution: S2_LANDCOVER_SERVICE.attribution,
  },
  "aqueduct-risk": {
    label: AQUEDUCT_SERVICE.title,
    minzoom: 4,
    // Aqueduct is a 30 arc-second basin model; beyond z10 the polygons are
    // enormous and rendering them is pointless.
    maxzoom: 10,
    // Must be the MapServer root plus `layers=show:1`; the layer-level
    // `/MapServer/1/export` form returns HTTP 400.
    buildUrl: (bbox) =>
      buildEsriExportUrl(AQUEDUCT_SERVICE, { bbox, layers: "show:1" }),
    attribution: AQUEDUCT_SERVICE.attribution,
  },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ layer: string; z: string; x: string; y: string }> },
): Promise<Response> {
  const params = await context.params;
  const { layer, z, x, y } = params;

  const imagery = IMAGERY_LAYERS[layer];
  if (!imagery) {
    return new Response("Unknown imagery layer.", { status: 404 });
  }

  const tile = { z: Number(z), x: Number(x), y: Number(y) };
  if (!isValidTile(tile)) {
    return new Response("Malformed tile coordinate.", { status: 400 });
  }

  const zoom = tile.z;
  if (zoom < imagery.minzoom || zoom > imagery.maxzoom) {
    return tileResponse(transparentTile(), {
      outcome: "out-of-range",
      cacheControl: BLANK_CACHE_CONTROL,
    });
  }

  // A map view asks for a few dozen tiles; this ceiling exists to stop a
  // runaway client, not to ration normal panning.
  const rate = checkEdgeRateLimit(request, `imagery-${layer}`, 600, 60_000);
  if (!rate.allowed) {
    return new Response("Too many tile requests.", {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(rate.retryAfterSeconds),
      },
    });
  }

  const bbox = formatBbox(tileToBbox3857(tile));
  const url = imagery.buildUrl(bbox);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "image/png",
        "User-Agent": "JalDrishti/0.2.1 (imagery tile proxy)",
      },
      // A land-cover snapshot and a 2019 model: cache hard at the data layer.
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.warn(`[imagery] ${layer} ${z}/${x}/${y}: ${error}`);
    return tileResponse(transparentTile(), {
      outcome: "error",
      cacheControl: "no-store",
    });
  }

  if (!response.ok) {
    // 499/400 mean a bad request shape; 404 means the service moved. Neither
    // is worth retrying per tile, so a blank is cached and the log is the signal.
    if (response.status >= 500 || response.status === 429) {
      console.warn(`[imagery] ${layer} ${z}/${x}/${y}: HTTP ${response.status}`);
    }
    return tileResponse(transparentTile(), {
      outcome: `upstream-${response.status}`,
      upstreamStatus: response.status,
      cacheControl: BLANK_CACHE_CONTROL,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return tileResponse(transparentTile(), {
      outcome: "upstream-not-image",
      upstreamStatus: response.status,
      cacheControl: BLANK_CACHE_CONTROL,
    });
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    return tileResponse(transparentTile(), {
      outcome: "empty",
      upstreamStatus: response.status,
      cacheControl: BLANK_CACHE_CONTROL,
    });
  }

  return tileResponse(bytes, {
    outcome: "ok",
    upstreamStatus: response.status,
    cacheControl: TILE_CACHE_CONTROL,
    contentType,
  });
}
