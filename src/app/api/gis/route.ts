import { NextResponse } from "next/server";
import { asFeatureCollection, allLayersAsFeatureCollection } from "@/lib/data/ecological-zones";

// GET /api/gis              -> all layers
// GET /api/gis?layer=esz    -> only ESZ
export async function GET(req: Request) {
  const url = new URL(req.url);
  const layer = url.searchParams.get("layer");
  const supported = ["esz", "forest", "wetland", "crz"] as const;
  if (!layer || !supported.includes(layer as (typeof supported)[number])) {
    return NextResponse.json(allLayersAsFeatureCollection());
  }
  const key = layer as (typeof supported)[number];
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const isMaharashtraFixtureArea = lat >= 15.5 && lat <= 20.8 && lng >= 72 && lng <= 75.6;
  const localFeatures = isMaharashtraFixtureArea ? asFeatureCollection(key).features : [];
  const fallback = { type: "FeatureCollection" as const, features: localFeatures };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json(fallback);
  }

  // Site-centered OSM queries expand coverage beyond the bundled Maharashtra
  // fixtures. These mapped boundaries are indicative, not regulatory evidence.
  const selectors: Record<typeof key, string[]> = {
    esz: ['[boundary=protected_area]', '[leisure=nature_reserve]'],
    forest: ['[landuse=forest]', '[natural=wood]'],
    wetland: ['[natural=wetland]', '[water~"lake|pond"]'],
    crz: ['[natural=wetland][wetland~"mangrove|tidalflat|saltmarsh"]'],
  };
  try {
    // A small box is faster and less prone to public-server timeouts than a
    // large radius query; choose its longitude width for the site's latitude.
    const latDelta = 0.18;
    const lngDelta = 0.18 / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
    const bbox = `(${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta})`;
    const searches = selectors[key].flatMap((selector) => [
      `way${bbox}${selector};`,
      `relation${bbox}${selector};`,
    ]);
    const query = `[out:json][timeout:15];(${searches.join("")});out tags geom;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "JalDrishti/0.3.1" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 86_400 },
    });
    if (response.ok) {
      const payload = await response.json();
      type OSMPoint = { lat: number; lon: number };
      type OSMMember = { role?: string; geometry?: OSMPoint[] };
      type OSMElement = { type: string; id: number; tags?: Record<string, string>; geometry?: OSMPoint[]; members?: OSMMember[] };
      type Position = [number, number];
      const same = (a: Position, b: Position) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
      const closed = (ring: Position[]) => ring.length >= 4 && same(ring[0], ring[ring.length - 1]);
      const coords = (points: OSMPoint[]): Position[] => points.map((point) => [point.lon, point.lat]);
      const stitch = (segments: Position[][]): Position[][] => {
        const pending = segments.filter((segment) => segment.length >= 2).map((segment) => [...segment]);
        const rings: Position[][] = [];
        while (pending.length) {
          const chain = pending.shift()!;
          let joined = true;
          while (joined && !closed(chain)) {
            joined = false;
            const end = chain[chain.length - 1];
            const start = chain[0];
            const matchAtEnd = pending.findIndex((part) => same(end, part[0]) || same(end, part[part.length - 1]));
            if (matchAtEnd >= 0) {
              let part = pending.splice(matchAtEnd, 1)[0];
              if (same(end, part[part.length - 1])) part = part.reverse();
              chain.push(...part.slice(1));
              joined = true;
              continue;
            }
            const matchAtStart = pending.findIndex((part) => same(start, part[0]) || same(start, part[part.length - 1]));
            if (matchAtStart >= 0) {
              let part = pending.splice(matchAtStart, 1)[0];
              if (same(start, part[0])) part = part.reverse();
              chain.unshift(...part.slice(0, -1));
              joined = true;
            }
          }
          if (closed(chain)) rings.push(chain);
        }
        return rings;
      };
      const contains = (ring: Position[], point: Position) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
      const elements: OSMElement[] = payload.elements ?? [];
      const mapped = elements.flatMap((element) => {
        if (element.type !== "way" && element.type !== "relation") return [];
        const wayRing = element.type === "way" ? coords(element.geometry ?? []) : [];
        let rings = closed(wayRing) ? [wayRing] : [];
        let innerRings: Position[][] = [];
        if (element.type === "relation") {
          const members = element.members ?? [];
          rings = stitch(members.filter((member) => member.role === "outer").map((member) => coords(member.geometry ?? [])));
          innerRings = stitch(members.filter((member) => member.role === "inner").map((member) => coords(member.geometry ?? [])));
        }
        if (!rings.length) return [];
        const polygons = rings.map((outer) => [outer, ...innerRings.filter((inner) => contains(outer, inner[0]))]);
        const geometry = polygons.length === 1
          ? { type: "Polygon", coordinates: polygons[0] }
          : { type: "MultiPolygon", coordinates: polygons };
        return [{
          type: "Feature",
          id: `osm-${key}-${element.type}-${element.id}`,
          geometry,
          properties: { layer: key, name: element.tags?.name ?? element.tags?.["name:en"] ?? "Mapped area", category: key, source: "OpenStreetMap contributors via Overpass API", sourceDate: new Date().toISOString().slice(0, 10), evidenceStatus: "PROXY" },
        }];
      });
      if (mapped.length) return NextResponse.json({ ...fallback, features: [...fallback.features, ...mapped.slice(0, 120)] });
    }
  } catch {
    // Keep the screen usable if the public data service is unavailable.
  }
  return NextResponse.json(fallback);
}
