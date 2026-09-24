/**
 * Spatial operations - Turf.js wrapper.
 *
 * In the full system this would be PostGIS. For the MVP (SQLite, no Docker)
 * we perform identical spatial operations in the application layer using
 * Turf.js, on GeoJSON polygons stored in the database.
 *
 * Mirrors PostGIS function names where there is a 1:1 mapping:
 *   ST_Intersects  -> turf.booleanIntersects / turf.booleanPointInPolygon
 *   ST_Within      -> turf.booleanPointInPolygon
 *   ST_Distance    -> turf.distance (great-circle, km)
 *   ST_DWithin     -> computed from ST_Distance
 *
 * CRS: All coordinates are EPSG:4326 (WGS84). Distance calculations use
 * Turf's great-circle distance (km). For site-point vs polygon work this is
 * precise enough; for legal-grade buffer work the rule layer is responsible
 * for projecting to the appropriate state CRS.
 */

import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point } from "geojson";

export interface SpatialCheckResult {
  overlap: boolean;
  nearestDistanceKm: number;
  intersectedPolygons: { id: string; name: string; category?: string }[];
}

/**
 * Check whether a point is inside any polygon of the layer, and compute the
 * nearest distance to a polygon edge (0 if inside).
 */
export function checkPointAgainstLayer(
  siteLngLat: { lng: number; lat: number },
  layer: FeatureCollection<Polygon | MultiPolygon>,
): SpatialCheckResult {
  const point: Feature<Point> = turf.point([siteLngLat.lng, siteLngLat.lat]);

  const intersected: SpatialCheckResult["intersectedPolygons"] = [];
  let nearest = Number.POSITIVE_INFINITY;

  for (const feature of layer.features) {
    const name =
      (feature.properties as { name?: string } | null)?.name ??
      (feature.properties as { id?: string } | null)?.id ??
      "Unnamed";

    const category = (feature.properties as { category?: string } | null)?.category;

    // overlap = point inside any polygon of a MultiPolygon, or inside the Polygon
    const inside = turf.booleanPointInPolygon(point, feature as Feature<Polygon | MultiPolygon>);
    if (inside) {
      intersected.push({ id: String(feature.id ?? name), name, category });
    }

    // distance to polygon boundary (km). turf.distance to feature centroid is
    // not what we want - we want the nearest edge. Use turf.pointToLineDistance
    // against the polygon's boundary line.
    const boundary = turf.polygonToLine(feature as Feature<Polygon | MultiPolygon>);
    const dist = turf.pointToLineDistance(point, boundary as Feature, { units: "kilometers" });
    if (dist < nearest) nearest = dist;
  }

  return {
    overlap: intersected.length > 0,
    nearestDistanceKm: Number.isFinite(nearest) ? nearest : 0,
    intersectedPolygons: intersected,
  };
}

/**
 * Find the groundwater block (or any administrative polygon) that contains
 * the site point. Returns the first match.
 */
export function findContainingPolygon<
  T extends Feature<Polygon | MultiPolygon>
>(
  siteLngLat: { lng: number; lat: number },
  features: T[],
): T | null {
  const point: Feature<Point> = turf.point([siteLngLat.lng, siteLngLat.lat]);
  for (const f of features) {
    if (turf.booleanPointInPolygon(point, f)) return f;
  }
  return null;
}

/**
 * Find the nearest rainfall station by great-circle distance.
 */
export function findNearestStation<
  T extends { latitude: number; longitude: number; id: string }
>(
  siteLngLat: { lng: number; lat: number },
  stations: T[],
): T & { distanceKm: number } | null {
  if (stations.length === 0) return null;
  const from = turf.point([siteLngLat.lng, siteLngLat.lat]);
  let best: (T & { distanceKm: number }) | null = null;
  for (const s of stations) {
    const to = turf.point([s.longitude, s.latitude]);
    const d = turf.distance(from, to, { units: "kilometers" });
    if (!best || d < best.distanceKm) {
      best = { ...s, distanceKm: d };
    }
  }
  return best;
}

/**
 * Compute a bounding-box buffer (km) around a point and return a polygon.
 * Useful for "find features within X km of site" map views.
 */
export function bufferPointBboxKm(
  siteLngLat: { lng: number; lat: number },
  radiusKm: number,
): Feature<Polygon> {
  const point = turf.point([siteLngLat.lng, siteLngLat.lat]);
  return turf.buffer(point, radiusKm, { units: "kilometers", steps: 32 }) as Feature<Polygon>;
}
