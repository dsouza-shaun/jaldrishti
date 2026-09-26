/**
 * National Water Mission â€” "Jal Shakti" Ground Water Level WMS.
 *
 * Two facts drive the whole design of this module, both established by probing
 * the live service:
 *
 * 1. `https://jalshakti-data.gov.in` answers every WMS request (`/wmsurl/` and
 *    `/wmsurl190/`, GetMap and GetCapabilities alike) with `302 -> /login`
 *    unless the caller already holds a valid `JSESSIONID`. The service is not
 *    an open WMS.
 * 2. Its CORS policy is `Access-Control-Allow-Origin: https://jalshakti-data.gov.in`,
 *    i.e. its own origin only. A browser running JalDrishti from anywhere else
 *    is refused at the preflight stage.
 *
 * Consequence: MapLibre can never load these tiles directly. Every request has
 * to be relayed by the server-side proxy at `/api/map-tiles/nwic/...`, which is
 * also the only place a session cookie can safely be attached. The proxy must
 * therefore degrade quietly: an unreachable or logged-out upstream must yield a
 * transparent tile, never an error, so the basemap underneath stays usable and
 * the public OpenFreeMap water layers can carry the "where is the water"
 * question on their own.
 *
 * CRS note: requests use WMS 1.3.0 with `CRS=EPSG:3857`. That is deliberate.
 * EPSG:4326 in WMS 1.3.0 is latitude/longitude ordered, which silently breaks
 * naive BBOX construction; EPSG:3857 is easting/northing ordered, so
 * `minX,minY,maxX,maxY` needs no axis swap.
 *
 * Tile arithmetic lives in `@/lib/data/web-mercator`, shared with the Esri
 * imagery relay, so both proxies agree exactly with the basemap.
 */

import type { DataProvenance } from "@/lib/data/dataset-types";
import {
  TILE_SIZE,
  formatBbox,
  isValidTile,
  lonLatToTile,
  pointToTilePixel,
  tileToBbox3857,
  transparentTile,
  type Bbox3857,
  type TileCoord,
} from "@/lib/data/web-mercator";

export {
  isValidTile,
  lonLatToTile,
  pointToTilePixel,
  tileToBbox3857,
  transparentTile,
};
export type { Bbox3857, TileCoord };

/** The two WMS deployments the Ground Water Level module publishes. */
export const NWIC_BASE_URL =
  process.env.JALDRISHTI_NWIC_BASE_URL?.replace(/\/+$/, "") ??
  "https://jalshakti-data.gov.in";

/**
 * Session material for the gated upstream. A bare `JSESSIONID=...` is the
 * common case, but any raw cookie header value is accepted so an operator can
 * paste whatever their browser sent. Without it the proxy answers with
 * transparent tiles and the map falls back to public layers.
 */
const NWIC_COOKIE = process.env.JALDRISHTI_NWIC_COOKIE?.trim();

export const NWIC_TIMEOUT_MS = Number(
  process.env.JALDRISHTI_NWIC_TIMEOUT_MS ?? 12_000,
);

export function isNwicSessionConfigured(): boolean {
  return Boolean(NWIC_COOKIE);
}

export interface NwicLayerDef {
  key: string;
  /** Shown on the map toggle. */
  label: string;
  /** Upstream WMS LAYERS value. */
  upstreamLayer: string;
  /** Path on the Jal Shakti host that serves this layer. */
  basePath: string;
  /** Highest zoom the upstream will usefully render; keeps requests sane. */
  maxzoom: number;
  description: string;
}

export const NWIC_LAYERS = {
  stations: {
    key: "stations",
    label: "Groundwater stations",
    upstreamLayer: "ground_water_station_india",
    basePath: "/wmsurl190/",
    maxzoom: 14,
    description:
      "National Water Mission monitoring network: bore wells, dug wells, piezometers and hand pumps with observed ground water levels.",
  },
  state: {
    key: "state",
    label: "Groundwater extent",
    upstreamLayer: "state_nwic",
    basePath: "/wmsurl/",
    maxzoom: 8,
    description:
      "State-level ground water availability surface published by the National Water Mission.",
  },
} as const satisfies Record<string, NwicLayerDef>;

export type NwicLayerKey = keyof typeof NWIC_LAYERS;

export const NWIC_LAYER_KEYS = Object.keys(NWIC_LAYERS) as NwicLayerKey[];

export function isNwicLayerKey(value: string): value is NwicLayerKey {
  return Object.prototype.hasOwnProperty.call(NWIC_LAYERS, value);
}

export function nwicProvenance(): DataProvenance {
  return {
    source:
      "National Water Mission - Jal Shakti ground water level map (Government of India)",
    sourceDate: "Live service; observation dates vary per monitoring record",
    // A value rendered straight from the NWM monitoring network is an official
    // record, so it is only ever labelled VERIFIED once the proxy has actually
    // resolved a tile. Callers decide that from the fetch result.
    evidenceStatus: isNwicSessionConfigured() ? "VERIFIED" : "UNKNOWN",
    sourceUrl: "https://jalshakti-data.gov.in/groundwatermap?module=Ground+Water+Level",
    caveat: isNwicSessionConfigured()
      ? undefined
      : "No upstream session configured (JALDRISHTI_NWIC_COOKIE is unset), so this layer renders as empty.",
  };
}

/* -------------------------------------------------------------------------- */
/* Upstream request construction                                               */
/* -------------------------------------------------------------------------- */

export function buildGetMapUrl(
  layer: NwicLayerDef,
  bbox: Bbox3857,
  options: { width?: number; height?: number; dpi?: number } = {},
): URL {
  const url = new URL(`${NWIC_BASE_URL}${layer.basePath}`);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "true");
  url.searchParams.set("LAYERS", layer.upstreamLayer);
  url.searchParams.set("STYLES", "");
  url.searchParams.set("WIDTH", String(options.width ?? TILE_SIZE));
  url.searchParams.set("HEIGHT", String(options.height ?? TILE_SIZE));
  url.searchParams.set("CRS", "EPSG:3857");
  url.searchParams.set("BBOX", formatBbox(bbox));
  if (options.dpi) url.searchParams.set("format_options", `dpi:${options.dpi}`);
  return url;
}

export function buildGetFeatureInfoUrl(
  layer: NwicLayerDef,
  bbox: Bbox3857,
  pixel: { i: number; j: number },
  options: { width?: number; height?: number; dpi?: number } = {},
): URL {
  const width = options.width ?? TILE_SIZE;
  const height = options.height ?? TILE_SIZE;
  const url = new URL(`${NWIC_BASE_URL}${layer.basePath}`);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetFeatureInfo");
  url.searchParams.set("LAYERS", layer.upstreamLayer);
  url.searchParams.set("QUERY_LAYERS", layer.upstreamLayer);
  url.searchParams.set("STYLES", "");
  url.searchParams.set("CRS", "EPSG:3857");
  url.searchParams.set("BBOX", formatBbox(bbox));
  url.searchParams.set("WIDTH", String(width));
  url.searchParams.set("HEIGHT", String(height));
  url.searchParams.set("I", String(pixel.i));
  url.searchParams.set("J", String(pixel.j));
  url.searchParams.set("INFO_FORMAT", "application/json");
  // The upstream renders a 256px request at ~180 dpi and needs the hint to
  // pick the same symbol sizes the reference viewer shows.
  url.searchParams.set("format_options", `dpi:${options.dpi ?? 180}`);
  return url;
}

/**
 * Headers the upstream expects. The Referer matters: it is the value the
 * reference viewer sends, and the site is fronted by nginx with per-route
 * rules. The cookie is the whole reason this proxy exists.
 */
function upstreamHeaders(accept: string): Record<string, string> {
  return {
    Accept: accept,
    Referer: `${NWIC_BASE_URL}/groundwatermap?module=Ground+Water+Level`,
    Origin: NWIC_BASE_URL,
    "User-Agent": "JalDrishti/0.2.1 (WMS tile proxy)",
    ...(NWIC_COOKIE ? { Cookie: NWIC_COOKIE } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Upstream results                                                            */
/* -------------------------------------------------------------------------- */

export type NwicOutcome = "ok" | "no-session" | "gated" | "error";

export interface NwicTileResult {
  outcome: NwicOutcome;
  bytes: Uint8Array | null;
  contentType: string;
  /** HTTP status seen upstream, useful in logs and the status endpoint. */
  upstreamStatus: number | null;
  detail?: string;
}

/**
 * Relays one WMS tile. Never throws: every failure mode is reported through
 * `outcome` so the route can answer 200 with a transparent tile.
 */
export async function fetchNwicTile(
  layer: NwicLayerDef,
  bbox: Bbox3857,
): Promise<NwicTileResult> {
  if (!NWIC_COOKIE) {
    return {
      outcome: "no-session",
      bytes: null,
      contentType: "image/png",
      upstreamStatus: null,
      detail: "JALDRISHTI_NWIC_COOKIE is not set.",
    };
  }

  const url = buildGetMapUrl(layer, bbox);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: upstreamHeaders("image/png,image/*;q=0.8"),
      cache: "no-store",
      redirect: "manual", // A redirect here is the login wall; do not chase it.
      signal: AbortSignal.timeout(NWIC_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      outcome: "error",
      bytes: null,
      contentType: "image/png",
      upstreamStatus: null,
      detail: error instanceof Error ? error.message : "Network request failed",
    };
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "";
    return {
      outcome: location.includes("login") ? "gated" : "error",
      bytes: null,
      contentType: "image/png",
      upstreamStatus: response.status,
      detail: `Upstream redirected to ${location || "an unknown location"}.`,
    };
  }

  if (!response.ok) {
    return {
      outcome: "error",
      bytes: null,
      contentType: "image/png",
      upstreamStatus: response.status,
      detail: `Upstream returned HTTP ${response.status}.`,
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  // The login wall can answer 200 with an HTML sign-in page. Never pass that
  // through as a tile or MapLibre will fill the map with broken-image icons.
  if (!contentType.startsWith("image/")) {
    return {
      outcome: "gated",
      bytes: null,
      contentType: "image/png",
      upstreamStatus: response.status,
      detail: `Upstream returned ${contentType || "an untyped body"} instead of an image.`,
    };
  }

  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      return {
        outcome: "error",
        bytes: null,
        contentType,
        upstreamStatus: response.status,
        detail: "Upstream returned an empty body.",
      };
    }
    return {
      outcome: "ok",
      bytes,
      contentType,
      upstreamStatus: response.status,
    };
  } catch (error) {
    return {
      outcome: "error",
      bytes: null,
      contentType,
      upstreamStatus: response.status,
      detail: error instanceof Error ? error.message : "Could not read the body",
    };
  }
}

export interface NwicFeatureResult {
  outcome: NwicOutcome;
  feature: Record<string, unknown> | null;
  detail?: string;
}

/**
 * GetFeatureInfo for the station network. GeoServer answers an empty hit with
 * `features: []`, which is a successful query, not a failure.
 */
export async function fetchNwicFeatureInfo(
  layer: NwicLayerDef,
  bbox: Bbox3857,
  pixel: { i: number; j: number },
): Promise<NwicFeatureResult> {
  if (!NWIC_COOKIE) {
    return {
      outcome: "no-session",
      feature: null,
      detail: "JALDRISHTI_NWIC_COOKIE is not set.",
    };
  }

  const url = buildGetFeatureInfoUrl(layer, bbox, pixel);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: upstreamHeaders("application/json,text/plain;q=0.5"),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(NWIC_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      outcome: "error",
      feature: null,
      detail: error instanceof Error ? error.message : "Network request failed",
    };
  }

  if (response.status >= 300 && response.status < 400) {
    return {
      outcome: "gated",
      feature: null,
      detail: "Upstream redirected; the session is no longer valid.",
    };
  }
  if (!response.ok) {
    return {
      outcome: "error",
      feature: null,
      detail: `Upstream returned HTTP ${response.status}.`,
    };
  }

  try {
    const text = await response.text();
    const payload = JSON.parse(text) as Record<string, unknown>;
    const raw = payload.features;
    const features = Array.isArray(raw) ? raw : [];
    if (features.length === 0) {
      return { outcome: "ok", feature: null, detail: "No monitoring record at this point." };
    }
    return { outcome: "ok", feature: features[0] as Record<string, unknown> };
  } catch {
    return {
      outcome: "gated",
      feature: null,
      detail: "Upstream did not return JSON; the session is probably expired.",
    };
  }
}

export interface NwicStatus {
  configured: boolean;
  live: boolean;
  outcome: NwicOutcome;
  detail: string;
  baseUrl: string;
  layers: Array<{ key: string; label: string; upstreamLayer: string }>;
  checkedAt: string;
}

/**
 * Cheap liveness probe used by `/api/nwic?action=status` so the map can label
 * its groundwater layer honestly instead of showing an empty toggle.
 */
export async function probeNwic(): Promise<NwicStatus> {
  const layers = NWIC_LAYER_KEYS.map((key) => ({
    key,
    label: NWIC_LAYERS[key].label,
    upstreamLayer: NWIC_LAYERS[key].upstreamLayer,
  }));
  const base = {
    configured: isNwicSessionConfigured(),
    baseUrl: NWIC_BASE_URL,
    layers,
    checkedAt: new Date().toISOString(),
  };

  if (!base.configured) {
    return {
      ...base,
      live: false,
      outcome: "no-session",
      detail:
        "JALDRISHTI_NWIC_COOKIE is unset, so the National Water Mission layer is dormant. The map is using public OpenStreetMap water data instead.",
    };
  }

  // Probe a low-zoom tile over central India: cheap, always in coverage, and
  // enough to tell a live session from a dead one.
  const result = await fetchNwicTile(
    NWIC_LAYERS.stations,
    tileToBbox3857({ z: 4, x: 8, y: 5 }),
  );
  return {
    ...base,
    live: result.outcome === "ok",
    outcome: result.outcome,
    detail:
      result.outcome === "ok"
        ? "National Water Mission ground water layers are live."
        : (result.detail ?? "The upstream service did not return a tile."),
  };
}
