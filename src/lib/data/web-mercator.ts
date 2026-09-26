/**
 * Web Mercator (EPSG:3857 / "slippy map") arithmetic shared by every tile
 * proxy in this app.
 *
 * Two independent proxies need this — the National Water Mission WMS relay and
 * the Esri image-service relay — and they must agree exactly, or tiles will
 * disagree with the basemap they are drawn over. Keeping one implementation
 * removes that whole class of bug.
 *
 * Conventions: `x` runs west to east, `y` runs north to south (XYZ, not TMS).
 * MapLibre speaks XYZ, so nothing here flips.
 */

export const TILE_SIZE = 256;

/** Web Mercator half-circumference: pi * 6378137. */
export const HALF_CIRCUMFERENCE = 20037508.342789244;

/** Latitude where the Mercator projection is truncated. */
const MAX_MERCATOR_LATITUDE = 85.05112878;

export interface Bbox3857 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/**
 * Bounds check for a slippy-map tile coordinate. Mirrors the guard inside
 * MapLibre's own TileID (0 <= z <= 25, 0 <= x,y < 2^z) so a hostile request
 * cannot steer a proxy at a nonsensical tile.
 */
export function isValidTile(coord: unknown): coord is TileCoord {
  if (typeof coord !== "object" || coord === null) return false;
  const { z, x, y } = coord as Record<string, unknown>;
  if (![z, x, y].every((v) => Number.isInteger(v))) return false;
  const zoom = z as number;
  const span = 2 ** zoom;
  return (
    zoom >= 0 &&
    zoom <= 25 &&
    (x as number) >= 0 &&
    (x as number) < span &&
    (y as number) >= 0 &&
    (y as number) < span
  );
}

/** Ground resolution in metres per pixel at a given zoom. */
export function metersPerPixel(z: number): number {
  return (2 * HALF_CIRCUMFERENCE) / (TILE_SIZE * 2 ** z);
}

/**
 * EPSG:3857 bounds of an XYZ slippy tile.
 *
 * MapLibre can expand `{bbox-epsg-3857}` in a raster tile template itself, but
 * every proxy here recomputes the bbox from `z`/`x`/`y` instead, so that no
 * client-supplied value ever reaches an upstream URL.
 */
export function tileToBbox3857({ z, x, y }: TileCoord): Bbox3857 {
  const scale = metersPerPixel(z);
  const minX = -HALF_CIRCUMFERENCE + x * TILE_SIZE * scale;
  const maxX = -HALF_CIRCUMFERENCE + (x + 1) * TILE_SIZE * scale;
  // Tile rows run north to south, so a row's top edge is the larger Y.
  const maxY = HALF_CIRCUMFERENCE - y * TILE_SIZE * scale;
  const minY = HALF_CIRCUMFERENCE - (y + 1) * TILE_SIZE * scale;
  return { minX, minY, maxX, maxY };
}

/**
 * EPSG:3856 / Web Mercator sphere radius. `HALF_CIRCUMFERENCE` is pi * R, so
 * R is the inverse. Keeping the radius explicit makes the forward and inverse
 * projections read the way the EPSG definition does.
 */
const EARTH_RADIUS = HALF_CIRCUMFERENCE / Math.PI;

/** Full world extent in EPSG:3857 metres: -HALF..HALF on both axes. */
const WORLD_WIDTH = 2 * HALF_CIRCUMFERENCE;

/**
 * EPSG:4326 centre of a tile, for logging and reverse lookups.
 *
 * This is the exact inverse of `lonLatTo3857` over standard EPSG:3857 metres,
 * where Y increases northward across -HALF..HALF. Any drift between the two
 * shows up immediately as a centre that re-resolves to a different tile.
 */
export function tileCenterLonLat({ z, x, y }: TileCoord): {
  longitude: number;
  latitude: number;
} {
  const { minX, minY, maxX, maxY } = tileToBbox3857({ z, x, y });
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    longitude: (centerX / EARTH_RADIUS) * (180 / Math.PI),
    latitude:
      (Math.atan(Math.sinh(centerY / EARTH_RADIUS)) * 180) / Math.PI,
  };
}

/**
 * Exact inverse of `lonLatTo3857`. Handy for turning a tile extent back into
 * coordinates and for test probes, and it keeps the two halves of the
 * projection in one place so they cannot drift apart.
 */
export function mercatorToLonLat(
  x: number,
  y: number,
): { longitude: number; latitude: number } {
  return {
    longitude: (x / EARTH_RADIUS) * (180 / Math.PI),
    latitude: (Math.atan(Math.sinh(y / EARTH_RADIUS)) * 180) / Math.PI,
  };
}

/** Clamps a latitude into the range the Mercator projection supports. */
export function clampMercatorLatitude(latitude: number): number {
  return Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude));
}

/**
 * Projects WGS84 to standard EPSG:3857 metres.
 *
 * Y increases NORTHWARD across -HALF_CIRCUMFERENCE..HALF_CIRCUMFERENCE, which
 * is what `tileToBbox3857` also assumes. The equivalent closed form
 * `R * ln(tan(pi/4 + phi/2))` is used, which is the standard EPSG definition
 * and numerically better behaved than the sec/tan form near the poles.
 */
export function lonLatTo3857(
  longitude: number,
  latitude: number,
): { x: number; y: number } {
  const phi = (clampMercatorLatitude(latitude) * Math.PI) / 180;
  return {
    x: EARTH_RADIUS * ((longitude * Math.PI) / 180),
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  };
}

/**
 * Which tile contains this WGS84 point, at the given integer zoom.
 *
 * `lonLatTo3857` returns standard EPSG:3857 metres spanning -HALF..HALF, so X
 * is measured eastward from -HALF while Y is measured southward from +HALF.
 * Getting that second half wrong inverts latitude: the returned tile is still a
 * valid in-range integer, so no type or bounds check objects, and the only
 * symptom is an upstream tile service returning 404 for every request.
 */
export function lonLatToTile(
  longitude: number,
  latitude: number,
  zoom: number,
): TileCoord {
  const span = 2 ** zoom;
  const point = lonLatTo3857(longitude, latitude);
  const x = Math.floor(((point.x + HALF_CIRCUMFERENCE) / WORLD_WIDTH) * span);
  // Tile rows run north to south, so measure down from the northern edge.
  const y = Math.floor(((HALF_CIRCUMFERENCE - point.y) / WORLD_WIDTH) * span);
  return {
    z: zoom,
    x: Math.max(0, Math.min(span - 1, x)),
    y: Math.max(0, Math.min(span - 1, y)),
  };
}

/** Pixel offset of a WGS84 point inside its own tile, for WMS I/J. */
export function pointToTilePixel(
  longitude: number,
  latitude: number,
  tile: TileCoord,
): { i: number; j: number } {
  const { minX, minY, maxX, maxY } = tileToBbox3857(tile);
  const point = lonLatTo3857(longitude, latitude);
  const i = Math.round(((point.x - minX) / (maxX - minX)) * TILE_SIZE);
  const j = Math.round(((maxY - point.y) / (maxY - minY)) * TILE_SIZE);
  return {
    i: Math.max(0, Math.min(TILE_SIZE - 1, i)),
    j: Math.max(0, Math.min(TILE_SIZE - 1, j)),
  };
}

/**
 * Formats a bbox for an upstream request. Fixed precision keeps cache keys
 * stable and prevents absurdly long floats reaching a service we do not own.
 */
export function formatBbox(bbox: Bbox3857, precision = 3): string {
  return [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY]
    .map((value) => value.toFixed(precision))
    .join(",");
}

/**
 * A 256x256 fully transparent PNG, served whenever a proxied tile cannot be
 * produced. Returning a real 200 image instead of an error keeps the basemap
 * underneath intact and lets the CDN cache the miss rather than re-asking for
 * the same dead tile on every pan.
 */
const TRANSPARENT_TILE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABFUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB2ClDBAAAAABJRU5ErkJggg==";

let transparentTileBytes: Uint8Array | null = null;

export function transparentTile(): Uint8Array {
  if (!transparentTileBytes) {
    transparentTileBytes = new Uint8Array(
      Buffer.from(TRANSPARENT_TILE_PNG, "base64"),
    );
  }
  return transparentTileBytes;
}

/**
 * Serves a proxied tile. Mirrors the header contract used by every imagery
 * relay here so a client can tell a real tile from a blank one without
 * inspecting the pixels.
 */
export function tileResponse(
  bytes: Uint8Array,
  options: {
    outcome: string;
    upstreamStatus?: number | null;
    cacheControl: string;
    contentType?: string;
  },
): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": options.contentType ?? "image/png",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": options.cacheControl,
      // Neutral name: both the National Water Mission relay and the Esri
      // imagery relay emit this, and a client should not have to know which
      // provider it is talking to.
      "X-Tile-Outcome": options.outcome,
      ...(options.upstreamStatus
        ? { "X-Tile-Upstream-Status": String(options.upstreamStatus) }
        : {}),
    },
  });
}
