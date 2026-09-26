/**
 * ESA WorldCover 10 m v200 class legend.
 *
 * These codes and colours are the published ESA specification, reproduced here
 * so the bundled rasters can be read as land cover rather than as bare
 * integers. Verified against the ESA WorldCover Product User Manual V2.0, the
 * Google Earth Engine dataset catalogue, Planet's public-data documentation
 * and the Sentinel Hub collection metadata, which all agree on the same eleven
 * codes and colours.
 *
 * This module previously refused to translate a class code at all, reporting
 * `legendStatus: "NOT_PROVIDED"`. That was over-cautious: the legend is public
 * and stable, so declining to apply it only produced meaningless output such as
 * "code 40" in the evidence table.
 *
 * Attribution: ESA WorldCover is licensed CC BY 4.0, which requires credit to
 * the WorldCover consortium whenever the data or its legend is shown.
 */

export interface WorldCoverClass {
  code: number;
  /** Display name, verbatim from the ESA specification. */
  label: string;
  /** `#rrggbb`. */
  color: string;
  /** Byte triplet, for building an RGBA buffer. */
  rgb: readonly [number, number, number];
}

export const WORLDCOVER_CLASSES: readonly WorldCoverClass[] = [
  { code: 10, label: "Tree cover", color: "#006400", rgb: [0, 100, 0] },
  { code: 20, label: "Shrubland", color: "#ffbb22", rgb: [255, 187, 34] },
  { code: 30, label: "Grassland", color: "#ffff4c", rgb: [255, 255, 76] },
  { code: 40, label: "Cropland", color: "#f096ff", rgb: [240, 150, 255] },
  { code: 50, label: "Built-up", color: "#fa0000", rgb: [250, 0, 0] },
  { code: 60, label: "Bare / sparse vegetation", color: "#b4b4b4", rgb: [180, 180, 180] },
  { code: 70, label: "Snow and ice", color: "#f0f0f0", rgb: [240, 240, 240] },
  { code: 80, label: "Permanent water bodies", color: "#0064c8", rgb: [0, 100, 200] },
  { code: 90, label: "Herbaceous wetland", color: "#0096a0", rgb: [0, 150, 160] },
  { code: 95, label: "Mangroves", color: "#00cf75", rgb: [0, 207, 117] },
  { code: 100, label: "Moss and lichen", color: "#fae6a0", rgb: [250, 230, 160] },
];

/** Class code used by the product for pixels outside any mapped class. */
export const WORLDCOVER_NO_DATA_CODE = 0;
export const WORLDCOVER_NO_DATA_LABEL = "No data";

const CLASS_BY_CODE = new Map<number, WorldCoverClass>(
  WORLDCOVER_CLASSES.map((entry) => [entry.code, entry]),
);

/** Resolves a class code to its ESA name, or null for unmapped / no-data. */
export function worldCoverClassLabel(code: number | null): string | null {
  if (code === null) return null;
  return CLASS_BY_CODE.get(code)?.label ?? null;
}

/** The full legend, for a map key. No-data is included so the scale is total. */
export const WORLDCOVER_LEGEND: ReadonlyArray<{
  code: number;
  label: string;
  color: string;
}> = [
  { code: WORLDCOVER_NO_DATA_CODE, label: WORLDCOVER_NO_DATA_LABEL, color: "transparent" },
  ...WORLDCOVER_CLASSES.map((entry) => ({
    code: entry.code,
    label: entry.label,
    color: entry.color,
  })),
];
