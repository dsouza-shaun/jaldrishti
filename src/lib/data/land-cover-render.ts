import {
  getLandCoverDataset,
  type LandCoverRasterMetadata,
} from "@/lib/data/land-cover-data";
import {
  WORLDCOVER_CLASSES,
  WORLDCOVER_NO_DATA_CODE,
} from "@/lib/data/worldcover-legend";

/**
 * Renders the bundled WorldCover rasters as a coloured RGBA overlay.
 *
 * Why this exists: `lookupLandCover` samples a 3x3 window and returns one
 * class code, which is useful as evidence but invisible on a map. The rasters
 * were on disk and were never displayed anywhere, so the 8.6 MB of bundled
 * data bought a single number. This renders each footprint properly.
 *
 * The output is an RGBA PNG in the ESA published palette, with code 0 (No data)
 * and any declared nodata value left fully transparent. That means it can be
 * dropped onto a basemap as an overlay without masking anything outside the
 * footprint, and the ragged edge of each raster simply shows the map beneath.
 */

export interface LandCoverRasterSummary {
  /** Stable identifier: the content hash, safe to use in a URL. */
  id: string;
  locations: string[];
  /** `[west, south, east, north]` in EPSG:4326, for a MapLibre image source. */
  bounds: [number, number, number, number];
  width: number;
  height: number;
  crs: string;
  nodata: number | null;
}

export interface LandCoverCatalog {
  rasters: LandCoverRasterSummary[];
  legend: typeof WORLDCOVER_CLASSES;
  attribution: string;
}

const ATTRIBUTION =
  "ESA WorldCover 10 m v200 (WorldCover consortium), CC BY 4.0. Bundled extract.";

function summarize(
  raster: LandCoverRasterMetadata,
): LandCoverRasterSummary {
  return {
    id: raster.contentSha256,
    locations: raster.locations,
    bounds: [raster.bounds.west, raster.bounds.south, raster.bounds.east, raster.bounds.north],
    width: raster.width,
    height: raster.height,
    crs: raster.crs,
    nodata: raster.nodata,
  };
}

/** Every bundled footprint, for a client to place on a map. */
export async function getLandCoverCatalog(): Promise<LandCoverCatalog> {
  const index = await getLandCoverDataset();
  return {
    rasters: index.rasters.map(summarize),
    legend: WORLDCOVER_CLASSES,
    attribution: ATTRIBUTION,
  };
}

export interface RenderedLandCover {
  png: Buffer;
  width: number;
  height: number;
}

const renderCache = new Map<string, RenderedLandCover>();

/** Byte lookup table from class code to packed RGBA, built once per process. */
let rgbaTable: Uint8Array | null = null;

function buildRgbaTable(): Uint8Array {
  if (rgbaTable) return rgbaTable;
  const table = new Uint8Array(256 * 4);
  // Everything starts fully transparent so unmapped codes never show as black.
  for (let code = 0; code < 256; code += 1) {
    const entry = WORLDCOVER_CLASSES.find((candidate) => candidate.code === code);
    const offset = code * 4;
    if (!entry || code === WORLDCOVER_NO_DATA_CODE) {
      table[offset + 3] = 0;
      continue;
    }
    table[offset] = entry.rgb[0];
    table[offset + 1] = entry.rgb[1];
    table[offset + 2] = entry.rgb[2];
    table[offset + 3] = 255;
  }
  rgbaTable = table;
  return table;
}

/**
 * Colour-maps one raster to a PNG.
 *
 * `sharp` has no colormap operation, and adding `geotiff.js` or a reprojection
 * dependency for eleven palette entries would be disproportionate, so the band
 * is read raw and mapped by hand. These rasters are small and few, and the
 * result is memoised by content hash.
 */
export async function renderLandCoverPng(
  rasterId: string,
): Promise<RenderedLandCover | null> {
  const cached = renderCache.get(rasterId);
  if (cached) return cached;

  const index = await getLandCoverDataset();
  const raster = index.rasters.find(
    (candidate) => candidate.contentSha256 === rasterId,
  );
  if (!raster) return null;

  const { default: sharp } = await import("sharp");
  const metadata = await sharp(raster.filePath).metadata();
  if (metadata.channels !== 1 || metadata.depth !== "uchar") {
    throw new Error(
      `WorldCover raster must be a single-band 8-bit image (found ${metadata.depth}, ${metadata.channels} band(s))`,
    );
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error("WorldCover raster has no dimensions");
  }

  const band = await sharp(raster.filePath, {
    limitInputPixels: 100_000_000,
    sequentialRead: true,
  })
    .raw({ depth: "uchar" })
    .toBuffer();

  const table = buildRgbaTable();
  const rgba = Buffer.allocUnsafe(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const code = band[pixel];
    const transparent =
      code === WORLDCOVER_NO_DATA_CODE ||
      (raster.nodata !== null && code === raster.nodata);
    const destination = pixel * 4;
    if (transparent) {
      rgba[destination] = 0;
      rgba[destination + 1] = 0;
      rgba[destination + 2] = 0;
      rgba[destination + 3] = 0;
      continue;
    }
    const source = code * 4;
    rgba[destination] = table[source];
    rgba[destination + 1] = table[source + 1];
    rgba[destination + 2] = table[source + 2];
    rgba[destination + 3] = table[source + 3];
  }

  // Palette-quantised PNG. libpng drops the alpha channel when every pixel is
  // opaque, so a fully classified footprint comes out RGB and one containing
  // nodata comes out RGBA. Both are correct for an overlay: there is nothing
  // to see through in the first case, and the nodata pixels are transparent in
  // the second. `ensureAlpha` is deliberately not called — it is a no-op
  // against the quantiser and would only suggest a guarantee that is not there.
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  const rendered: RenderedLandCover = { png, width, height };
  // Bound the cache: 40 rasters is small, but a hostile id sweep should not be
  // able to grow it without limit.
  if (renderCache.size >= 64) {
    const oldest = renderCache.keys().next().value as string | undefined;
    if (oldest) renderCache.delete(oldest);
  }
  renderCache.set(rasterId, rendered);
  return rendered;
}
