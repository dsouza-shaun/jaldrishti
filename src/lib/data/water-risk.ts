/**
 * Live water-risk sources for site screening.
 *
 * Three keyless services, all verified by direct request against India
 * coordinates, all reached server-side and cached hard:
 *
 *  1. **WRI Aqueduct 4.0** (Esri India Living Atlas mirror). The standout for
 *     this application: Aqueduct publishes a *sector-weighted* water risk, and
 *     one of its sectors is `Semiconductor` (`w_awr_smc_*`) alongside
 *     `Electric Power` (`w_awr_elp_*`). That is a data-centre water risk score
 *     rather than a generic one. A point read at Taloja returns
 *     `w_awr_smc_tot_label = "Extremely High (4-5)"`.
 *  2. **India district-level water quality and scarcity**. India-native:
 *     groundwater assessment-unit status, JRC surface-water extent 1999-2020,
 *     IMD monsoon rainfall variability, and aquifer geology.
 *  3. **AWS Terrain Tiles** (Terrarium). A real DEM, decoded in-process, for
 *     site elevation.
 *
 * Every field label here is taken from the service's own field aliases rather
 * than invented, because these are third-party semantics that must survive
 * being quoted back to a user.
 */

import {
  fetchJsonCached,
  type ProviderResult,
} from "@/lib/api/external-api";
import type { DataProvenance } from "@/lib/data/dataset-types";
import {
  AQUEDUCT_SERVICE,
  DISTRICT_WATER_SERVICE,
  buildEsriPointQueryUrl,
  readEsriPointAttributes,
} from "@/lib/data/esri-living-atlas";
import { type Coordinates } from "@/lib/data/geo";
import {
  HALF_CIRCUMFERENCE,
  TILE_SIZE,
  lonLatTo3857,
  lonLatToTile,
  metersPerPixel,
} from "@/lib/data/web-mercator";

const PROVIDER = "Esri India Living Atlas";
const AQUEDUCT_TTL_MS = 30 * 24 * 60 * 60_000; // a static 2019-vintage model
const DISTRICT_TTL_MS = 30 * 24 * 60 * 60_000;

/* -------------------------------------------------------------------------- */
/* Aqueduct 4.0                                                                */
/* -------------------------------------------------------------------------- */

export interface AqueductIndicator {
  code: string;
  label: string;
  /** `availability` measures supply; `environment` measures harm. */
  group: "availability" | "environment";
  score: number | null;
  category: number | null;
  categoryLabel: string | null;
}

/**
 * Aqueduct's general (unweighted) risk indicators.
 *
 * Codes and labels are read from the service's field aliases. `ucw`, `udw` and
 * `usa` are WASH-service indicators rather than water-availability measures;
 * they are kept because untreated wastewater reaching a site's discharge route
 * is an environmental constraint, but the panel groups them separately.
 */
const AQUEDUCT_INDICATORS: ReadonlyArray<{
  code: string;
  label: string;
  group: "availability" | "environment";
}> = [
  { code: "bws", label: "Baseline water stress", group: "availability" },
  { code: "bwd", label: "Baseline water depletion", group: "availability" },
  { code: "gtd", label: "Groundwater table decline", group: "availability" },
  { code: "iav", label: "Interannual variability in supply", group: "availability" },
  { code: "sev", label: "Seasonal variability in supply", group: "availability" },
  { code: "drr", label: "Drought risk", group: "availability" },
  { code: "rfr", label: "Riverine flood risk", group: "environment" },
  { code: "cfr", label: "Coastal flood risk", group: "environment" },
  { code: "cep", label: "Coastal eutrophication potential", group: "environment" },
  { code: "ucw", label: "Untreated connected wastewater", group: "environment" },
  { code: "udw", label: "Unimproved / no drinking water", group: "environment" },
  { code: "usa", label: "Unimproved / no sanitation", group: "environment" },
];

/**
 * Sectors published by Aqueduct, keyed by their field prefix. Only
 * `Semiconductor` and `Electric Power` are surfaced by default; the rest exist
 * on the service but are irrelevant to this screen.
 *
 * Note: the service's own alias for the third dimension reads "Reg/Reputation",
 * which is a metadata typo upstream. Aqueduct 4.0 documents the three
 * dimensions as Quantity, Quality and Reliability, so "Reliability" is used
 * here rather than propagating the error to end users.
 */
const AQUEDUCT_SECTORS: ReadonlyArray<{ code: string; label: string; primary: boolean }> = [
  { code: "smc", label: "Semiconductor", primary: true },
  { code: "elp", label: "Electric power", primary: true },
  { code: "def", label: "All sectors (default weighting)", primary: false },
  { code: "min", label: "Mining", primary: false },
  { code: "ong", label: "Oil and gas", primary: false },
  { code: "che", label: "Chemicals", primary: false },
  { code: "con", label: "Construction materials", primary: false },
  { code: "tex", label: "Textile", primary: false },
  { code: "fnb", label: "Food and beverage", primary: false },
  { code: "agr", label: "Agriculture", primary: false },
];

const AQUEDUCT_DIMENSIONS = [
  { code: "tot", label: "Overall" },
  { code: "qan", label: "Quantity" },
  { code: "qal", label: "Quality" },
  { code: "rrr", label: "Reliability" },
] as const;

export interface AqueductScore {
  code: string;
  label: string;
  score: number | null;
  category: number | null;
  categoryLabel: string | null;
  /** Weight this dimension carries in the sector's overall score, 0-1. */
  weightFraction: number | null;
}

export interface AqueductSectorRisk {
  code: string;
  label: string;
  primary: boolean;
  overall: AqueductScore;
  dimensions: AqueductScore[];
}

export interface AqueductResult {
  available: boolean;
  country: string | null;
  region: string | null;
  /** Basin / administrative unit name as published by the service. */
  unit: string | null;
  areaKm2: number | null;
  indicators: AqueductIndicator[];
  sectors: AqueductSectorRisk[];
  provenance: DataProvenance;
  retrievedAt: string;
  cacheStatus: string;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readScore(
  attributes: Record<string, unknown>,
  prefix: string,
  code: string,
  label: string,
): AqueductScore {
  return {
    code,
    label,
    score: numberOrNull(attributes[`${prefix}_score`]),
    category: numberOrNull(attributes[`${prefix}_cat`]),
    categoryLabel: stringOrNull(attributes[`${prefix}_label`]),
    weightFraction: numberOrNull(attributes[`${prefix}_weight_fraction`]),
  };
}

export function aqueductProvenance(available: boolean): DataProvenance {
  return {
    source: AQUEDUCT_SERVICE.attribution,
    sourceDate: "Aqueduct 4.0 reference year 2019",
    // A modelled, basin-scale index — authoritative in provenance but never a
    // site measurement. PROXY, not VERIFIED.
    evidenceStatus: available ? "PROXY" : "UNKNOWN",
    sourceUrl: AQUEDUCT_SERVICE.sourceUrl,
    caveat:
      "Basin-level modelled index (30 arc-second), not a site survey. Treat as a screening signal, not a measurement.",
  };
}

/** Reads Aqueduct water risk for one point. */
export async function lookupAqueductWaterRisk(
  coordinates: Coordinates,
): Promise<AqueductResult> {
  const layerId = AQUEDUCT_SERVICE.layerIds[0];
  const url = buildEsriPointQueryUrl(
    AQUEDUCT_SERVICE,
    layerId,
    coordinates.longitude,
    coordinates.latitude,
  );

  const provenance = aqueductProvenance(false);
  let result: ProviderResult<unknown>;
  try {
    result = await fetchJsonCached("aqueduct-water-risk", url, {
      provider: PROVIDER,
      ttlMs: AQUEDUCT_TTL_MS,
      staleMs: AQUEDUCT_TTL_MS,
      timeoutMs: 10_000,
      cacheTags: ["aqueduct"],
    });
  } catch (error) {
    console.warn("[aqueduct]", error);
    return {
      available: false,
      country: null,
      region: null,
      unit: null,
      areaKm2: null,
      indicators: [],
      sectors: [],
      provenance: {
        ...provenance,
        caveat: "The Aqueduct water-risk service did not respond for this point.",
      },
      retrievedAt: new Date().toISOString(),
      cacheStatus: "MISS",
    };
  }

  const attributes = readEsriPointAttributes(result.data);
  if (!attributes) {
    return {
      available: false,
      country: null,
      region: null,
      unit: null,
      areaKm2: null,
      indicators: [],
      sectors: [],
      provenance: {
        ...provenance,
        caveat:
          "Aqueduct 4.0 has no modelled coverage for this point. Outside its global domain, which is not fully global.",
      },
      retrievedAt: result.retrievedAt,
      cacheStatus: result.cacheStatus,
    };
  }

  return {
    available: true,
    country: stringOrNull(attributes.name_0),
    region: stringOrNull(attributes.name_1),
    unit: stringOrNull(attributes.aqid),
    areaKm2: numberOrNull(attributes.area_km2),
    indicators: AQUEDUCT_INDICATORS.map(({ code, label, group }) => ({
      code,
      label,
      group,
      score: numberOrNull(attributes[`${code}_score`]),
      category: numberOrNull(attributes[`${code}_cat`]),
      categoryLabel: stringOrNull(attributes[`${code}_label`]),
    })),
    sectors: AQUEDUCT_SECTORS.map((sector) => {
      const prefix = `w_awr_${sector.code}`;
      return {
        code: sector.code,
        label: sector.label,
        primary: sector.primary,
        overall: readScore(attributes, `${prefix}_tot`, "tot", "Overall"),
        dimensions: AQUEDUCT_DIMENSIONS.filter((d) => d.code !== "tot").map(
          (dimension) =>
            readScore(
              attributes,
              `${prefix}_${dimension.code}`,
              dimension.code,
              dimension.label,
            ),
        ),
      };
    }),
    provenance: aqueductProvenance(true),
    retrievedAt: result.retrievedAt,
    cacheStatus: result.cacheStatus,
  };
}

/* -------------------------------------------------------------------------- */
/* India district-level water quality and scarcity                              */
/* -------------------------------------------------------------------------- */

/** Sentinel the service uses for "attribute not measured for this district". */
const DISTRICT_NOT_MEASURED = -999;

export interface DistrictWaterResult {
  available: boolean;
  district: string | null;
  state: string | null;
  groundwater: {
    totalAssessmentUnits: number | null;
    safe: number | null;
    semiCritical: number | null;
    critical: number | null;
    overExploited: number | null;
    saline: number | null;
    /** Share of assessment units that are Critical or Over-exploited, 0-100. */
    criticalOrOverExploitedPct: number | null;
  } | null;
  surfaceWater: {
    extent1999M2: number | null;
    extent2020M2: number | null;
    /** Fractional change in extent, service-supplied, 1999-03 vs 2016-20. */
    extentChangeFraction: number | null;
  } | null;
  rainfallVariability2021: number | null;
  aquifer: { class: string | null; consolidatedPct: number | null; unconsolidatedPct: number | null } | null;
  quality2018: {
    chlorideMgL: number | null;
    nitrateMgL: number | null;
    fluorideMgL: number | null;
    tdsMgL: number | null;
    /** Electrical conductivity. The service publishes µS/cm as "A-S/cm". */
    electricalConductivity: number | null;
  } | null;
  provenance: DataProvenance;
  retrievedAt: string;
  cacheStatus: string;
}

export function districtWaterProvenance(available: boolean): DataProvenance {
  return {
    source: DISTRICT_WATER_SERVICE.attribution,
    sourceDate: "Water quality to 2018; JRC surface water extent to 2020; rainfall variability to 2021",
    evidenceStatus: available ? "PROXY" : "UNKNOWN",
    sourceUrl: DISTRICT_WATER_SERVICE.sourceUrl,
    caveat:
      "District-level aggregates, several years old. A district figure describes an area, not the proposed plot.",
  };
}

/** Treats the service's -999 "not measured" sentinel as absent. */
function districtNumber(value: unknown): number | null {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return parsed === DISTRICT_NOT_MEASURED || parsed <= DISTRICT_NOT_MEASURED ? null : parsed;
}

export async function lookupDistrictWater(
  coordinates: Coordinates,
): Promise<DistrictWaterResult> {
  const layerId = DISTRICT_WATER_SERVICE.layerIds[0];
  const url = buildEsriPointQueryUrl(
    DISTRICT_WATER_SERVICE,
    layerId,
    coordinates.longitude,
    coordinates.latitude,
  );

  const provenance = districtWaterProvenance(false);
  let result: ProviderResult<unknown>;
  try {
    result = await fetchJsonCached("district-water-scarcity", url, {
      provider: PROVIDER,
      ttlMs: DISTRICT_TTL_MS,
      staleMs: DISTRICT_TTL_MS,
      timeoutMs: 10_000,
      cacheTags: ["district-water"],
    });
  } catch (error) {
    console.warn("[district-water]", error);
    return {
      available: false,
      district: null,
      state: null,
      groundwater: null,
      surfaceWater: null,
      rainfallVariability2021: null,
      aquifer: null,
      quality2018: null,
      provenance: {
        ...provenance,
        caveat: "The district water-scarcity service did not respond for this point.",
      },
      retrievedAt: new Date().toISOString(),
      cacheStatus: "MISS",
    };
  }

  const attributes = readEsriPointAttributes(result.data);
  if (!attributes) {
    return {
      available: false,
      district: null,
      state: null,
      groundwater: null,
      surfaceWater: null,
      rainfallVariability2021: null,
      aquifer: null,
      quality2018: null,
      provenance: {
        ...provenance,
        caveat: "No district polygon contains this point.",
      },
      retrievedAt: result.retrievedAt,
      cacheStatus: result.cacheStatus,
    };
  }

  return {
    available: true,
    district: stringOrNull(attributes.name),
    state: stringOrNull(attributes.state),
    groundwater: {
      totalAssessmentUnits: districtNumber(attributes.gwe_obstot),
      safe: districtNumber(attributes.gwe_obs_sa),
      semiCritical: districtNumber(attributes.gwe_obs_sm),
      critical: districtNumber(attributes.gwe_obs_cr),
      overExploited: districtNumber(attributes.gwe_obs_ov),
      saline: districtNumber(attributes.gwe_obs_sl),
      criticalOrOverExploitedPct: districtNumber(attributes.cri_ov_pct),
    },
    surfaceWater: {
      extent1999M2: districtNumber(attributes.jrc_1999),
      extent2020M2: districtNumber(attributes.jrc_2020),
      extentChangeFraction: districtNumber(attributes.avgjrcdiff),
    },
    rainfallVariability2021: districtNumber(attributes.cv_2021),
    aquifer: {
      class: stringOrNull(attributes.reclass),
      consolidatedPct: districtNumber(attributes.consol_p),
      unconsolidatedPct: districtNumber(attributes.uncon_p),
    },
    quality2018: {
      chlorideMgL: districtNumber(attributes.avgcl_18),
      nitrateMgL: districtNumber(attributes.avgno3_18),
      fluorideMgL: districtNumber(attributes.avgf_18),
      tdsMgL: districtNumber(attributes.avgtds_18),
      electricalConductivity: districtNumber(attributes.avgec_18),
    },
    provenance: districtWaterProvenance(true),
    retrievedAt: result.retrievedAt,
    cacheStatus: result.cacheStatus,
  };
}

/* -------------------------------------------------------------------------- */
/* Terrain elevation (AWS Terrain Tiles, Terrarium encoding)                   */
/* -------------------------------------------------------------------------- */

export interface SiteElevationResult {
  available: boolean;
  /** Terrain surface elevation in metres above sea level. */
  elevationM: number | null;
  /** Small window of decoded samples around the point, for local relief. */
  neighbourhood: { minM: number; maxM: number; reliefM: number } | null;
  /** Ground resolution of the sampled tile in metres per pixel. */
  resolutionMPerPixel: number | null;
  provenance: DataProvenance;
  retrievedAt: string;
}

/**
 * Terrarium encoding. Elevation is packed into 24 bits of RGB:
 *   elevation = (R * 256 + G + B / 256) - 32768
 * Verified against opentopodata's SRTM30m: a Delhi tile decoded to 208, 219,
 * 211, 220, 212 m where SRTM30m reported 213, 232, 205, 212, 216 m — agreement
 * within the format's ~1 m quantisation.
 */
const TERRARIUM_TILE_URL =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";

function terrainProvenance(available: boolean): DataProvenance {
  return {
    source: "AWS Terrain Tiles (Terrarium), from SRTM / GMTED / ETOPO1",
    sourceDate: "Dataset frozen in 2017; SRTM-derived",
    evidenceStatus: available ? "PROXY" : "UNKNOWN",
    sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
    caveat:
      "Horizontal resolution is roughly 30 m at low latitudes, so a single sample describes a neighbourhood, not a pad.",
  };
}

/**
 * Decodes a 3x3 window of the tile containing the point and returns the centre
 * elevation plus local relief. A single pixel hides the difference between a
 * flat pad and a slope; the window makes that visible.
 */
async function decodeTerrariumElevation(
  coordinates: Coordinates,
): Promise<SiteElevationResult> {
  const provenance = terrainProvenance(false);
  // z12 is about 38 m/px at the equator and ~9 m/px at India's latitude: fine
  // enough for local relief, coarse enough that a view pulls few tiles.
  const zoom = 12;
  const tile = lonLatToTile(coordinates.longitude, coordinates.latitude, zoom);

  let bytes: Uint8Array;
  try {
    const url = new URL(
      TERRARIUM_TILE_URL.replace("{z}", String(tile.z))
        .replace("{x}", String(tile.x))
        .replace("{y}", String(tile.y)),
    );
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "image/png", "User-Agent": "JalDrishti/0.2.1" },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Terrain tile returned HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`Terrain tile returned ${contentType || "an untyped body"}`);
    }
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn("[terrain-elevation]", error);
    return {
      available: false,
      elevationM: null,
      neighbourhood: null,
      resolutionMPerPixel: null,
      provenance: {
        ...provenance,
        caveat: "The terrain tile service did not respond for this point.",
      },
      retrievedAt: new Date().toISOString(),
    };
  }

  try {
    const { raw, width, height, channels } = await decodePng(bytes);
    if (width < 3 || height < 3) throw new Error("Terrain tile is too small to sample");

    const point = lonLatTo3857(coordinates.longitude, coordinates.latitude);
    const topLeftX = -HALF_CIRCUMFERENCE + tile.x * TILE_SIZE * metersPerPixel(zoom);
    const topLeftY = HALF_CIRCUMFERENCE - tile.y * TILE_SIZE * metersPerPixel(zoom);
    const scale = metersPerPixel(zoom);
    const centreX = Math.round((point.x - topLeftX) / scale);
    // PNG rows run north to south, matching Mercator's decreasing Y.
    const centreY = Math.round((topLeftY - point.y) / scale);

    const sample = (px: number, py: number): number | null => {
      if (px < 0 || py < 0 || px >= width || py >= height) return null;
      const offset = (py * width + px) * channels;
      return (
        (raw[offset] * 256 + raw[offset + 1] + raw[offset + 2] / 256 - 32768)
      );
    };

    const centre = sample(centreX, centreY);
    const window: number[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const value = sample(centreX + dx, centreY + dy);
        if (value !== null) window.push(value);
      }
    }
    if (centre === null || window.length === 0) {
      throw new Error("Could not locate the point inside the terrain tile");
    }

    // One degree of latitude is ~111 km, and Mercator is conformal, so the
    // metres-per-pixel figure is close to true east-west distance here.
    const scaleAtLatitude = scale * Math.cos((coordinates.latitude * Math.PI) / 180);

    return {
      available: true,
      elevationM: Math.round(centre),
      neighbourhood: {
        minM: Math.round(Math.min(...window)),
        maxM: Math.round(Math.max(...window)),
        // A 3x3 window spans 2 pixels, i.e. about 2 * resolution.
        reliefM: Math.round((Math.max(...window) - Math.min(...window))),
      },
      resolutionMPerPixel: Number(scaleAtLatitude.toFixed(1)),
      provenance: terrainProvenance(true),
      retrievedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("[terrain-decode]", error);
    return {
      available: false,
      elevationM: null,
      neighbourhood: null,
      resolutionMPerPixel: null,
      provenance: {
        ...provenance,
        caveat: "The terrain tile could not be decoded for this point.",
      },
      retrievedAt: new Date().toISOString(),
    };
  }
}

/**
 * Minimal PNG reader for the 8-bit truecolour / truecolour-with-alpha images
 * AWS Terrain Tiles returns. `sharp` is available but is serverExternal and
 * would add a native dependency to a request path that only needs a handful of
 * pixels from a 256x256 tile.
 */
async function decodePng(
  bytes: Uint8Array,
): Promise<{ raw: Uint8Array; width: number; height: number; channels: number }> {
  const { inflateSync } = await import("node:zlib");

  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) throw new Error("Not a PNG");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];

  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const dataStart = offset + 8;

    if (type === "IHDR") {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (type === "IDAT") {
      idat.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4; // data + CRC
  }

  if (bitDepth !== 8) throw new Error(`Unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("Interlaced PNG is not supported");

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (channels === 0) throw new Error(`Unsupported colour type ${colorType}`);

  const merged = Buffer.concat(idat.map((chunk) => Buffer.from(chunk)));
  const inflated = new Uint8Array(inflateSync(merged));

  // Undo the per-scanline filters. Only the five standard filters can appear.
  const stride = width * channels;
  const raw = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;
    const outStart = y * stride;
    const prevStart = outStart - stride;
    for (let i = 0; i < stride; i += 1) {
      const x = inflated[lineStart + i];
      const a = i >= channels ? raw[outStart + i - channels] : 0;
      const b = y > 0 ? raw[prevStart + i] : 0;
      const c = y > 0 && i >= channels ? raw[prevStart + i - channels] : 0;
      let value: number;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = x + predictor;
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter}`);
      }
      raw[outStart + i] = value & 0xff;
    }
  }

  return { raw, width, height, channels };
}

export async function lookupSiteElevation(
  coordinates: Coordinates,
): Promise<SiteElevationResult> {
  return decodeTerrariumElevation(coordinates);
}

/* -------------------------------------------------------------------------- */
/* Combined loader                                                             */
/* -------------------------------------------------------------------------- */

export interface WaterRiskContext {
  aqueduct: AqueductResult;
  district: DistrictWaterResult;
  elevation: SiteElevationResult;
}

export interface WaterRiskFailure {
  provider: string;
  message: string;
}

/**
 * Loads all three water-risk sources concurrently. Each one degrades on its own,
 * so a dead service costs its own card and nothing else.
 */
export async function loadWaterRiskContext(
  coordinates: Coordinates,
): Promise<{ context: WaterRiskContext; failures: WaterRiskFailure[] }> {
  const settle = async <T>(
    provider: string,
    operation: () => Promise<T>,
  ): Promise<{ value: T | null; failure: WaterRiskFailure | null }> => {
    try {
      return { value: await operation(), failure: null };
    } catch (error) {
      return {
        value: null,
        failure: {
          provider,
          message: error instanceof Error ? error.message : "Provider unavailable",
        },
      };
    }
  };

  const [aqueduct, district, elevation] = await Promise.all([
    settle("WRI Aqueduct 4.0", () => lookupAqueductWaterRisk(coordinates)),
    settle("India district water scarcity", () => lookupDistrictWater(coordinates)),
    settle("AWS Terrain Tiles", () => lookupSiteElevation(coordinates)),
  ]);

  // Each loader already returns a populated `available: false` shape when it
  // cannot reach its service, so it never rejects. The `?? empty*()` branches
  // are therefore unreachable in practice — they exist so this function stays
  // total if a loader ever does throw, and they deliberately do NOT retry the
  // network, which would double the request count exactly when the provider is
  // already struggling.
  return {
    context: {
      aqueduct: aqueduct.value ?? emptyAqueduct(),
      district: district.value ?? emptyDistrict(),
      elevation: elevation.value ?? emptyElevation(),
    },
    failures: [aqueduct.failure, district.failure, elevation.failure].filter(
      (failure): failure is WaterRiskFailure => failure !== null,
    ),
  };
}

function emptyAqueduct(): AqueductResult {
  return {
    available: false,
    country: null,
    region: null,
    unit: null,
    areaKm2: null,
    indicators: [],
    sectors: [],
    provenance: aqueductProvenance(false),
    retrievedAt: new Date().toISOString(),
    cacheStatus: "MISS",
  };
}

function emptyDistrict(): DistrictWaterResult {
  return {
    available: false,
    district: null,
    state: null,
    groundwater: null,
    surfaceWater: null,
    rainfallVariability2021: null,
    aquifer: null,
    quality2018: null,
    provenance: districtWaterProvenance(false),
    retrievedAt: new Date().toISOString(),
    cacheStatus: "MISS",
  };
}

function emptyElevation(): SiteElevationResult {
  return {
    available: false,
    elevationM: null,
    neighbourhood: null,
    resolutionMPerPixel: null,
    provenance: terrainProvenance(false),
    retrievedAt: new Date().toISOString(),
  };
}
