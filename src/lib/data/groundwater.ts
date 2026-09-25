import { haversineDistanceKm } from "@/lib/data/geo";

/**
 * CGWB Groundwater Block dataset - Maharashtra region
 * --------------------------------------------------------------
 * Retained as fallback-only reference seeds based on CGWB year-book ranges.
 * The block names are useful screening labels, but precise values are
 * representative and must be treated as PROXY rather than verified records.
 *
 * Where a value is genuinely unknown it is left null (not invented).
 *
 * evidenceStatus:
 *   PROXY    = representative fallback selected by nearest centroid
 *   UNKNOWN  = no nearby fallback record
 *
 * The nearest-centroid lookup never emits VERIFIED because it does not perform
 * a block-polygon containment test and no source documents are bundled.
 */

export interface GroundwaterBlockSeed {
  state: string;
  district: string;
  blockName: string;
  stage: number | null;           // % stage of groundwater development
  category: "Safe" | "Semi-Critical" | "Critical" | "Over-Exploited" | "Saline";
  preMonsoon: number | null;      // mbgl
  postMonsoon: number | null;     // mbgl
  recharge: number | null;        // ham/year
  extraction: number | null;      // ham/year
  units: number | null;           // assessment units
  tds: number | null;             // mg/L
  source: string;
  sourceDate: string;
  evidenceStatus: "PROXY" | "UNKNOWN";
}

export const GROUNDWATER_BLOCKS: GroundwaterBlockSeed[] = [
  // ---- Raigad district (Navi Mumbai / Taloja / Panvel belt) ----
  {
    state: "Maharashtra",
    district: "Raigad",
    blockName: "Panvel",
    stage: 85.4,
    category: "Semi-Critical",
    preMonsoon: 5.2,
    postMonsoon: 4.1,
    recharge: 4128,
    extraction: 3525,
    units: 23,
    tds: 620,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Raigad",
    blockName: "Taloja",
    stage: 112.6,
    category: "Critical",
    preMonsoon: 8.9,
    postMonsoon: 6.4,
    recharge: 2845,
    extraction: 3203,
    units: 18,
    tds: 1180,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Raigad",
    blockName: "Uran",
    stage: 108.2,
    category: "Critical",
    preMonsoon: 7.8,
    postMonsoon: 5.6,
    recharge: 2105,
    extraction: 2278,
    units: 12,
    tds: 1450,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Raigad",
    blockName: "Karjat",
    stage: 78.1,
    category: "Semi-Critical",
    preMonsoon: 6.4,
    postMonsoon: 4.8,
    recharge: 3560,
    extraction: 2778,
    units: 20,
    tds: 540,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Raigad",
    blockName: "Khalapur",
    stage: 92.3,
    category: "Semi-Critical",
    preMonsoon: 7.1,
    postMonsoon: 5.2,
    recharge: 3012,
    extraction: 2780,
    units: 16,
    tds: 690,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Raigad",
    blockName: "Pen",
    stage: 64.5,
    category: "Safe",
    preMonsoon: 4.8,
    postMonsoon: 3.5,
    recharge: 3890,
    extraction: 2510,
    units: 21,
    tds: 480,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Mumbai Suburban ----
  {
    state: "Maharashtra",
    district: "Mumbai Suburban",
    blockName: "Andheri-Borivali",
    stage: 142.8,
    category: "Over-Exploited",
    preMonsoon: 12.4,
    postMonsoon: 9.1,
    recharge: 1820,
    extraction: 2598,
    units: 14,
    tds: 920,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Pune district ----
  {
    state: "Maharashtra",
    district: "Pune",
    blockName: "Haveli",
    stage: 88.6,
    category: "Semi-Critical",
    preMonsoon: 7.8,
    postMonsoon: 5.6,
    recharge: 6890,
    extraction: 6105,
    units: 35,
    tds: 710,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Pune",
    blockName: "Maval",
    stage: 118.4,
    category: "Critical",
    preMonsoon: 10.2,
    postMonsoon: 7.4,
    recharge: 4520,
    extraction: 5347,
    units: 24,
    tds: 830,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Pune",
    blockName: "Khed",
    stage: 72.5,
    category: "Semi-Critical",
    preMonsoon: 6.8,
    postMonsoon: 4.9,
    recharge: 5240,
    extraction: 3799,
    units: 28,
    tds: 590,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  {
    state: "Maharashtra",
    district: "Pune",
    blockName: "Mulshi",
    stage: 58.4,
    category: "Safe",
    preMonsoon: 5.4,
    postMonsoon: 3.8,
    recharge: 4610,
    extraction: 2693,
    units: 22,
    tds: 460,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Nashik ----
  {
    state: "Maharashtra",
    district: "Nashik",
    blockName: "Nashik-City",
    stage: 95.7,
    category: "Semi-Critical",
    preMonsoon: 8.4,
    postMonsoon: 5.9,
    recharge: 5210,
    extraction: 4986,
    units: 26,
    tds: 670,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Nagpur ----
  {
    state: "Maharashtra",
    district: "Nagpur",
    blockName: "Nagpur-Urban",
    stage: 135.2,
    category: "Over-Exploited",
    preMonsoon: 13.6,
    postMonsoon: 9.8,
    recharge: 3120,
    extraction: 4218,
    units: 18,
    tds: 880,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Thane ----
  {
    state: "Maharashtra",
    district: "Thane",
    blockName: "Bhiwandi",
    stage: 98.3,
    category: "Semi-Critical",
    preMonsoon: 7.9,
    postMonsoon: 5.4,
    recharge: 4080,
    extraction: 4010,
    units: 22,
    tds: 760,
    source: "CGWB Ground Water Year Book Maharashtra 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Telangana (Hyderabad) - included for cross-state comparison ----
  {
    state: "Telangana",
    district: "Hyderabad",
    blockName: "Hyderabad-Urban",
    stage: 165.4,
    category: "Over-Exploited",
    preMonsoon: 16.2,
    postMonsoon: 11.4,
    recharge: 1845,
    extraction: 3050,
    units: 12,
    tds: 1240,
    source: "CGWB Ground Water Year Book Telangana 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
  // ---- Tamil Nadu (Chennai) ----
  {
    state: "Tamil Nadu",
    district: "Chennai",
    blockName: "Chennai-City",
    stage: 178.9,
    category: "Over-Exploited",
    preMonsoon: 14.8,
    postMonsoon: 10.2,
    recharge: 980,
    extraction: 1752,
    units: 8,
    tds: 1620,
    source: "CGWB Ground Water Year Book Tamil Nadu 2022-23",
    sourceDate: "2023-04",
    evidenceStatus: "PROXY",
  },
];

/**
 * Lookup by approximate lat/lng. Returns the most likely block based on a
 * simple bounding-box match against known block centroids.
 *
 * In the full system this would be a PostGIS `ST_Within` against block
 * boundary polygons. Here we use a nearest-centroid proxy and explicitly
 * mark the result as PROXY.
 */
export function lookupGroundwaterBlock(lat: number, lng: number): {
  block: GroundwaterBlockSeed;
  distanceKm: number;
  evidenceStatus: "PROXY" | "UNKNOWN";
} | null {
  // Simple centroid table for the seeded blocks (lat, lng).
  const CENTROIDS: Record<string, [number, number]> = {
    "Raigad::Panvel": [19.0, 73.05],
    "Raigad::Taloja": [19.04, 73.08],
    "Raigad::Uran": [18.95, 72.94],
    "Raigad::Karjat": [18.91, 73.33],
    "Raigad::Khalapur": [18.98, 73.25],
    "Raigad::Pen": [18.74, 73.08],
    "Mumbai Suburban::Andheri-Borivali": [19.13, 72.85],
    "Pune::Haveli": [18.62, 73.74],
    "Pune::Maval": [18.74, 73.66],
    "Pune::Khed": [18.84, 73.78],
    "Pune::Mulshi": [18.49, 73.62],
    "Nashik::Nashik-City": [19.99, 73.79],
    "Nagpur::Nagpur-Urban": [21.15, 79.09],
    "Thane::Bhiwandi": [19.30, 73.05],
    "Hyderabad::Hyderabad-Urban": [17.39, 78.49],
    "Chennai::Chennai-City": [13.08, 80.27],
  };

  let best: { block: GroundwaterBlockSeed; distanceKm: number } | null = null;
  for (const block of GROUNDWATER_BLOCKS) {
    const key = `${block.district}::${block.blockName}`;
    const centroid = CENTROIDS[key];
    if (!centroid) continue;
    const distanceKm = haversineDistanceKm(
      { latitude: lat, longitude: lng },
      { latitude: centroid[0], longitude: centroid[1] },
    );
    if (!best || distanceKm < best.distanceKm) {
      best = { block, distanceKm };
    }
  }

  if (!best || best.distanceKm > 50) return null;

  // A centroid match is not a block-polygon containment test, and the bundled
  // values are fallback seeds. Even a very close match remains a proxy.
  return {
    block: best.block,
    distanceKm: Number(best.distanceKm.toFixed(2)),
    evidenceStatus: "PROXY",
  };
}
