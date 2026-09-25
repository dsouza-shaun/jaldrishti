/**
 * Ecological GIS layers for the Maharashtra (Mumbai-Pune-Navi Mumbai) region.
 * --------------------------------------------------------------
 * Polygons are hand-drawn screening fixtures, not authoritative notified
 * boundaries. Real boundaries must come from MoEFCC / Bhuvan / state forest
 * department GIS portals. Every feature is therefore PROXY and must not be
 * treated as a legal overlap determination.
 *
 * Layers:
 *   esz      - Eco-Sensitive Zones around protected areas
 *   forest   - Reserved / protected forests
 *   wetland  - Notified wetlands (creeks, mangroves, lakes)
 *   crz      - Coastal Regulation Zone (nearshore land strip)
 *
 * Each feature has properties:
 *   name, category, source, sourceDate, evidenceStatus
 */

import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";

export interface EcologicalLayerDef {
  layer: "esz" | "forest" | "wetland" | "crz";
  name: string;
  category: string;
  state: string;
  // Polygon ring: array of [lng, lat]
  coordinates: number[][][];
  source: string;
  sourceDate: string;
  evidenceStatus: "PROXY" | "UNKNOWN";
}

// Helper: build a polygon ring that closes itself.
function ring(pts: number[][]): number[][] {
  if (pts.length === 0) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) pts = [...pts, first];
  return pts;
}

export const ECOLOGICAL_LAYERS: EcologicalLayerDef[] = [
  // ============================================================
  // ESZ - Eco-Sensitive Zones
  // ============================================================
  {
    layer: "esz",
    name: "Sanjay Gandhi National Park ESZ",
    category: "national-park-esz",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.78, 19.20], [72.85, 19.22], [72.92, 19.28], [72.95, 19.35],
        [72.88, 19.40], [72.78, 19.38], [72.72, 19.30], [72.78, 19.20],
      ]),
    ],
    source: "MoEFCC ESZ Notification - Sanjay Gandhi National Park",
    sourceDate: "2016-12-09",
    evidenceStatus: "PROXY",
  },
  {
    layer: "esz",
    name: "Tungareshwar Wildlife Sanctuary ESZ",
    category: "sanctuary-esz",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.92, 19.30], [73.02, 19.32], [73.10, 19.38], [73.08, 19.45],
        [72.98, 19.46], [72.90, 19.40], [72.92, 19.30],
      ]),
    ],
    source: "MoEFCC ESZ Notification - Tungareshwar WLS",
    sourceDate: "2018-05-22",
    evidenceStatus: "PROXY",
  },
  {
    layer: "esz",
    name: "Karnala Bird Sanctuary ESZ",
    category: "sanctuary-esz",
    state: "Maharashtra",
    coordinates: [
      ring([
        [73.05, 18.85], [73.14, 18.86], [73.20, 18.92], [73.16, 18.98],
        [73.08, 18.97], [73.02, 18.92], [73.05, 18.85],
      ]),
    ],
    source: "MoEFCC ESZ Notification - Karnala Bird Sanctuary",
    sourceDate: "2017-03-15",
    evidenceStatus: "PROXY",
  },
  {
    layer: "esz",
    name: "Matheran Eco-Sensitive Zone",
    category: "hill-station-esz",
    state: "Maharashtra",
    coordinates: [
      ring([
        [73.20, 18.90], [73.30, 18.92], [73.34, 18.99], [73.30, 19.05],
        [73.22, 19.04], [73.18, 18.98], [73.20, 18.90],
      ]),
    ],
    source: "MoEFCC Notification - Matheran ESZ (extended)",
    sourceDate: "2019-11-08",
    evidenceStatus: "PROXY",
  },
  // ============================================================
  // Forest
  // ============================================================
  {
    layer: "forest",
    name: "Tungareshwar Reserved Forest",
    category: "reserved-forest",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.95, 19.33], [73.05, 19.34], [73.09, 19.40], [73.05, 19.44],
        [72.97, 19.42], [72.93, 19.37], [72.95, 19.33],
      ]),
    ],
    source: "Maharashtra Forest Department GIS portal",
    sourceDate: "2022-06",
    evidenceStatus: "PROXY",
  },
  {
    layer: "forest",
    name: "Bhimgad Reserved Forest (Western Ghats)",
    category: "reserved-forest",
    state: "Maharashtra",
    coordinates: [
      ring([
        [73.60, 18.45], [73.75, 18.47], [73.82, 18.55], [73.78, 18.62],
        [73.68, 18.60], [73.58, 18.52], [73.60, 18.45],
      ]),
    ],
    source: "Maharashtra Forest Department GIS portal",
    sourceDate: "2022-06",
    evidenceStatus: "PROXY",
  },
  {
    layer: "forest",
    name: "Matheran Forest Block",
    category: "protected-forest",
    state: "Maharashtra",
    coordinates: [
      ring([
        [73.22, 18.93], [73.30, 18.94], [73.32, 18.99], [73.28, 19.03],
        [73.23, 19.02], [73.20, 18.97], [73.22, 18.93],
      ]),
    ],
    source: "Maharashtra Forest Department GIS portal",
    sourceDate: "2022-06",
    evidenceStatus: "PROXY",
  },
  // ============================================================
  // Wetland
  // ============================================================
  {
    layer: "wetland",
    name: "Thane Creek Flamingo Sanctuary",
    category: "creek-wetland",
    state: "Maharashtra",
    // Creek runs roughly north-south between Mumbai island and Navi Mumbai mainland.
    coordinates: [
      ring([
        [72.95, 19.05], [73.00, 19.08], [73.02, 19.15], [73.00, 19.22],
        [72.95, 19.20], [72.92, 19.12], [72.93, 19.06], [72.95, 19.05],
      ]),
    ],
    source: "Maharashtra State Wetland Authority / BNHS",
    sourceDate: "2021-08",
    evidenceStatus: "PROXY",
  },
  {
    layer: "wetland",
    name: "Mahim Creek Mangroves",
    category: "mangrove-wetland",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.81, 19.03], [72.85, 19.05], [72.86, 19.08], [72.83, 19.09],
        [72.79, 19.07], [72.78, 19.04], [72.81, 19.03],
      ]),
    ],
    source: "Maharashtra State Wetland Authority / MCZMA",
    sourceDate: "2020-11",
    evidenceStatus: "PROXY",
  },
  {
    layer: "wetland",
    name: "Vasai Creek Mangroves",
    category: "mangrove-wetland",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.80, 19.35], [72.86, 19.36], [72.88, 19.42], [72.84, 19.44],
        [72.79, 19.42], [72.77, 19.38], [72.80, 19.35],
      ]),
    ],
    source: "Maharashtra State Wetland Authority / MCZMA",
    sourceDate: "2020-11",
    evidenceStatus: "PROXY",
  },
  {
    layer: "wetland",
    name: "Panvel Creek Mangroves",
    category: "mangrove-wetland",
    state: "Maharashtra",
    coordinates: [
      ring([
        [73.02, 18.98], [73.08, 18.99], [73.10, 19.04], [73.07, 19.07],
        [73.01, 19.05], [72.99, 19.01], [73.02, 18.98],
      ]),
    ],
    source: "Maharashtra State Wetland Authority / MCZMA",
    sourceDate: "2020-11",
    evidenceStatus: "PROXY",
  },
  // ============================================================
  // CRZ - Coastal Regulation Zone (land strip along the coast)
  // ============================================================
  {
    layer: "crz",
    name: "Mumbai West Coast CRZ",
    category: "crz-ii",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.78, 18.92], [72.82, 18.95], [72.84, 19.05], [72.83, 19.15],
        [72.80, 19.25], [72.76, 19.20], [72.74, 19.05], [72.76, 18.95],
        [72.78, 18.92],
      ]),
    ],
    source: "MoEFCC CRZ Notification 2018 - Maharashtra Coastal Map",
    sourceDate: "2018-01-18",
    evidenceStatus: "PROXY",
  },
  {
    layer: "crz",
    name: "Navi Mumbai East Coast CRZ",
    category: "crz-iv",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.95, 18.95], [73.00, 18.97], [73.02, 19.05], [73.00, 19.12],
        [72.96, 19.10], [72.93, 19.00], [72.95, 18.95],
      ]),
    ],
    source: "MoEFCC CRZ Notification 2018 - Maharashtra Coastal Map",
    sourceDate: "2018-01-18",
    evidenceStatus: "PROXY",
  },
  {
    layer: "crz",
    name: "Uran Coast CRZ",
    category: "crz-i",
    state: "Maharashtra",
    coordinates: [
      ring([
        [72.90, 18.85], [72.95, 18.87], [72.98, 18.93], [72.96, 18.98],
        [72.91, 18.96], [72.88, 18.90], [72.90, 18.85],
      ]),
    ],
    source: "MoEFCC CRZ Notification 2018 - Maharashtra Coastal Map",
    sourceDate: "2018-01-18",
    evidenceStatus: "PROXY",
  },
];

/**
 * Convert ECOLOGICAL_LAYERS into a GeoJSON FeatureCollection for a given
 * layer type. Used both for spatial checks and for serving the /gis/* APIs.
 */
export function asFeatureCollection(
  layer: "esz" | "forest" | "wetland" | "crz",
): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: "FeatureCollection",
    features: ECOLOGICAL_LAYERS.filter((l) => l.layer === layer).map((l, i) => ({
      type: "Feature" as const,
      id: `${l.layer}-${i}`,
      geometry: { type: "Polygon" as const, coordinates: l.coordinates },
      properties: {
        layer: l.layer,
        name: l.name,
        category: l.category,
        state: l.state,
        source: l.source,
        sourceDate: l.sourceDate,
        evidenceStatus: l.evidenceStatus,
      },
    })),
  };
}

/**
 * All layers as a single FeatureCollection, useful for the map view.
 */
export function allLayersAsFeatureCollection(): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: "FeatureCollection",
    features: ECOLOGICAL_LAYERS.map((l, i) => ({
      type: "Feature" as const,
      id: `${l.layer}-${i}`,
      geometry: { type: "Polygon" as const, coordinates: l.coordinates },
      properties: {
        layer: l.layer,
        name: l.name,
        category: l.category,
        state: l.state,
        source: l.source,
        sourceDate: l.sourceDate,
        evidenceStatus: l.evidenceStatus,
      },
    })),
  };
}
