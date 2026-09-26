import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { DataProvenance } from "@/lib/data/dataset-types";
import {
  getDatasetRoot,
  toPortableDatasetPath,
} from "@/lib/data/dataset-loader";
import {
  boundsContainPoint,
  rasterCoordinateForPoint,
  readGeoTiffInfo,
  type GeoTiffInfo,
} from "@/lib/data/geo-tiff";
import {
  haversineDistanceKm,
  roundCoordinate,
  type Coordinates,
} from "@/lib/data/geo";
import {
  WORLDCOVER_NO_DATA_CODE,
  worldCoverClassLabel,
} from "@/lib/data/worldcover-legend";

export {
  WORLDCOVER_CLASSES,
  WORLDCOVER_LEGEND,
  WORLDCOVER_NO_DATA_LABEL,
  worldCoverClassLabel,
} from "@/lib/data/worldcover-legend";

export type LandCoverSeason = "monsoon" | "summer" | "winter";

export interface LandCoverRasterMetadata {
  relativePath: string;
  contentSha256: string;
  locations: string[];
  season: null;
  duplicateSourceSeasons: LandCoverSeason[];
  crs: string;
  width: number;
  height: number;
  bounds: GeoTiffInfo["bounds"];
  nodata: number | null;
}

export interface LandCoverClassSample {
  dominantClassCode: number | null;
  /** ESA WorldCover class name for `dominantClassCode`, or null if unmapped. */
  dominantClassLabel: string | null;
  histogram: Array<{ classCode: number; classLabel: string | null; pixelCount: number }>;
  sampledPixelCount: number;
  windowSidePixels: number;
  classMeaning: string | null;
  legendStatus: "OFFICIAL_ESA_LEGEND";
}

export interface LandCoverLookup {
  available: boolean;
  reason: "SAMPLED_RASTER" | "OUTSIDE_ALL_RASTER_FOOTPRINTS";
  location: string | null;
  season: LandCoverSeason | null;
  selectedByRequestedSeason: boolean;
  raster: LandCoverRasterMetadata | null;
  sample: LandCoverClassSample | null;
  nearestDatasetDistanceKm: number | null;
  acquisitionDate: string | null;
  provenance: DataProvenance;
}

export interface LandCoverDatasetSummary {
  sourceWorldcoverFiles: number;
  validSourceWorldcoverFiles: number;
  validUniqueRasters: number;
  locations: number;
  skippedFiles: Array<{ file: string; reason: string }>;
}

interface InternalRaster extends LandCoverRasterMetadata {
  filePath: string;
  geo: GeoTiffInfo;
}

interface LandCoverIndex {
  rasters: InternalRaster[];
  summary: LandCoverDatasetSummary;
}

interface SampleCache {
  values: Map<string, LandCoverClassSample>;
}

const globalWithSampleCache = globalThis as typeof globalThis & {
  __jaldrishtiLandCoverSamplesV1?: SampleCache;
};

const sampleCache =
  globalWithSampleCache.__jaldrishtiLandCoverSamplesV1 ??
  (globalWithSampleCache.__jaldrishtiLandCoverSamplesV1 = {
    values: new Map<string, LandCoverClassSample>(),
  });

const SEASONS: readonly LandCoverSeason[] = [
  "winter",
  "summer",
  "monsoon",
];

let indexPromise: Promise<LandCoverIndex> | null = null;

function isLandCoverSeason(value: string): value is LandCoverSeason {
  return SEASONS.includes(value as LandCoverSeason);
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(/*turbopackIgnore: true*/ filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

async function buildIndex(): Promise<LandCoverIndex> {
  const root = getDatasetRoot();
  const landCoverRoot = path.join(root, "India_Land_Cover");
  const entries = (await readdir(/*turbopackIgnore: true*/ landCoverRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const skippedFiles: Array<{ file: string; reason: string }> = [];

  const sourceRasters = await Promise.all(
    entries.map(async (entry) => {
      const match = /^(.+)_(monsoon|summer|winter)$/u.exec(entry.name);
      if (!match || !isLandCoverSeason(match[2])) {
        return {
          skipped: {
            file: entry.name,
            reason: "Directory name does not match <location>_<season>",
          } as const,
        };
      }

      const filePath = path.join(landCoverRoot, entry.name, "worldcover.tif");
      try {
        const [geo, contentSha256] = await Promise.all([
          readGeoTiffInfo(filePath),
          sha256File(filePath),
        ]);
        if (geo.epsg !== 4326) {
          throw new Error(
            `Expected EPSG:4326, found EPSG:${geo.epsg ?? "unknown"}`,
          );
        }
        return {
          skipped: null,
          raster: {
            filePath,
            relativePath: toPortableDatasetPath(path.relative(root, filePath)),
            contentSha256,
            location: match[1],
            season: match[2],
            geo,
          },
        };
      } catch (error) {
        return {
          skipped: {
            file: toPortableDatasetPath(path.relative(root, filePath)),
            reason: error instanceof Error ? error.message : "Unknown raster error",
          } as const,
        };
      }
    }),
  );

  const validSourceRasters = sourceRasters.flatMap((entry) =>
    entry.raster ? [entry.raster] : [],
  );
  for (const entry of sourceRasters) {
    if (entry.skipped) skippedFiles.push(entry.skipped);
  }

  const byHash = new Map<string, InternalRaster>();
  for (const source of validSourceRasters) {
    const existing = byHash.get(source.contentSha256);
    if (existing) {
      if (!existing.locations.includes(source.location)) {
        existing.locations.push(source.location);
        existing.locations.sort();
      }
      if (!existing.duplicateSourceSeasons.includes(source.season)) {
        existing.duplicateSourceSeasons.push(source.season);
        existing.duplicateSourceSeasons.sort();
      }
      continue;
    }

    byHash.set(source.contentSha256, {
      filePath: source.filePath,
      relativePath: source.relativePath,
      contentSha256: source.contentSha256,
      locations: [source.location],
      season: null,
      duplicateSourceSeasons: [source.season],
      crs: "EPSG:4326",
      width: source.geo.width,
      height: source.geo.height,
      bounds: source.geo.bounds,
      nodata: source.geo.noData,
      geo: source.geo,
    });
  }

  const rasters = [...byHash.values()].sort((left, right) =>
    (left.locations[0] ?? "").localeCompare(right.locations[0] ?? ""),
  );
  const locations = new Set(validSourceRasters.map((raster) => raster.location));
  return {
    rasters,
    summary: {
      sourceWorldcoverFiles: entries.length,
      validSourceWorldcoverFiles: validSourceRasters.length,
      validUniqueRasters: rasters.length,
      locations: locations.size,
      skippedFiles,
    },
  };
}

export function getLandCoverDataset(): Promise<LandCoverIndex> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

function distanceToBoundsKm(
  coordinates: Coordinates,
  bounds: GeoTiffInfo["bounds"],
): number {
  const longitude = Math.min(
    bounds.east,
    Math.max(bounds.west, coordinates.longitude),
  );
  const latitude = Math.min(
    bounds.north,
    Math.max(bounds.south, coordinates.latitude),
  );
  return haversineDistanceKm(coordinates, { latitude, longitude });
}

async function sampleClassCode(
  raster: InternalRaster,
  coordinates: Coordinates,
): Promise<LandCoverClassSample> {
  const cacheKey = `${raster.relativePath}:${roundCoordinate(coordinates.longitude, 5)},${roundCoordinate(coordinates.latitude, 5)}`;
  const cached = sampleCache.values.get(cacheKey);
  if (cached) return cached;

  const rasterCoordinate = rasterCoordinateForPoint(
    raster.geo,
    coordinates.longitude,
    coordinates.latitude,
  );
  if (!rasterCoordinate) {
    throw new Error("Point unexpectedly fell outside the selected raster");
  }

  const centerColumn = Math.floor(rasterCoordinate.column);
  const centerRow = Math.floor(rasterCoordinate.row);
  const windowSize = 3;
  const halfWindow = Math.floor(windowSize / 2);
  const left = Math.max(0, Math.min(raster.width - windowSize, centerColumn - halfWindow));
  const top = Math.max(0, Math.min(raster.height - windowSize, centerRow - halfWindow));

  const { default: sharp } = await import("sharp");
  const metadata = await sharp(raster.filePath).metadata();
  if (metadata.channels !== 1 || metadata.depth !== "uchar") {
    throw new Error(
      `WorldCover sample must be a single-band 8-bit raster (found ${metadata.depth}, ${metadata.channels} band(s))`,
    );
  }
  const data = await sharp(raster.filePath, {
    limitInputPixels: 100_000_000,
    sequentialRead: true,
  })
    .extract({ left, top, width: windowSize, height: windowSize })
    .raw({ depth: "uchar" })
    .toBuffer();

  const counts = new Map<number, number>();
  for (const value of data) {
    if (raster.nodata !== null && value === raster.nodata) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const histogram = [...counts.entries()]
    .map(([classCode, pixelCount]) => ({
      classCode,
      classLabel: worldCoverClassLabel(classCode),
      pixelCount,
    }))
    .sort((left, right) => right.pixelCount - left.pixelCount || left.classCode - right.classCode);
  const dominantClassCode = histogram[0]?.classCode ?? null;
  const sample: LandCoverClassSample = {
    dominantClassCode,
    dominantClassLabel: worldCoverClassLabel(dominantClassCode),
    histogram,
    sampledPixelCount: data.length,
    windowSidePixels: windowSize,
    classMeaning: worldCoverClassLabel(dominantClassCode),
    legendStatus: "OFFICIAL_ESA_LEGEND",
  };

  if (sampleCache.values.size >= 1_000) {
    const oldestKey = sampleCache.values.keys().next().value as string | undefined;
    if (oldestKey) sampleCache.values.delete(oldestKey);
  }
  sampleCache.values.set(cacheKey, sample);
  return sample;
}

function publicRaster(raster: InternalRaster): LandCoverRasterMetadata {
  const { filePath: _filePath, geo: _geo, ...metadata } = raster;
  return metadata;
}

export async function lookupLandCover(
  coordinates: Coordinates,
): Promise<LandCoverLookup> {
  const index = await getLandCoverDataset();
  const containing = index.rasters.filter((raster) =>
    boundsContainPoint(raster.bounds, coordinates.longitude, coordinates.latitude),
  );
  containing.sort((left, right) => {
    const leftArea =
      (left.bounds.east - left.bounds.west) *
      (left.bounds.north - left.bounds.south);
    const rightArea =
      (right.bounds.east - right.bounds.west) *
      (right.bounds.north - right.bounds.south);
    return leftArea - rightArea;
  });
  const selected = containing[0] ?? null;
  const nearestDistance = index.rasters.reduce(
    (minimum, raster) =>
      Math.min(
        minimum,
        distanceToBoundsKm(coordinates, raster.bounds),
      ),
    Number.POSITIVE_INFINITY,
  );

  const provenance: DataProvenance = {
    source: "ESA WorldCover 10 m land cover (bundled GeoTIFF rasters)",
    sourceDate: "Acquisition date not supplied with the bundled files",
    evidenceStatus: "VERIFIED",
    datasetFile: "datasets/India_Land_Cover/*/worldcover.tif",
    caveat:
      "The three season-named files for each location are byte-identical and are deduplicated, so no season is inferred and no acquisition date can be quoted. Coverage is limited to 40 bundled locations. Class codes are read against the published ESA WorldCover v200 legend; a code is only sampled inside the raster footprint.",
  };

  if (!selected) {
    return {
      available: false,
      reason: "OUTSIDE_ALL_RASTER_FOOTPRINTS",
      location: null,
      season: null,
      selectedByRequestedSeason: false,
      raster: null,
      sample: null,
      nearestDatasetDistanceKm: Number.isFinite(nearestDistance)
        ? Number(nearestDistance.toFixed(2))
        : null,
      acquisitionDate: null,
      provenance,
    };
  }

  return {
    available: true,
    reason: "SAMPLED_RASTER",
    location: selected.locations.join(", "),
    season: null,
    selectedByRequestedSeason: false,
    raster: publicRaster(selected),
    sample: await sampleClassCode(selected, coordinates),
    nearestDatasetDistanceKm: 0,
    acquisitionDate: null,
    provenance,
  };
}
