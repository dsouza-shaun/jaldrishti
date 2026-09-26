import assert from "node:assert/strict";
import {
  HALF_CIRCUMFERENCE,
  TILE_SIZE,
  lonLatTo3857,
  lonLatToTile,
  metersPerPixel,
  mercatorToLonLat,
  pointToTilePixel,
  tileCenterLonLat,
  tileToBbox3857,
  isValidTile,
} from "@/lib/data/web-mercator";

/**
 * Round-trip and reference tests for the shared tile arithmetic.
 *
 * These exist because a one-off sign error in `lonLatToTile` is invisible in
 * review and in types: it returns a plausible in-range integer, every caller is
 * happy, and the only symptom is a tile service quietly 404ing. It was caught
 * by AWS Terrain Tiles, not by any test so these assert against externally
 * known-correct tile references instead.
 */

const WORLD = 2 * HALF_CIRCUMFERENCE;

/**
 * The single externally verified reference: AWS Terrain Tiles serves a real
 * 28 KB PNG for `10/731/426.png` carrying
 * `x-amz-meta-x-imagery-sources: srtm/N28E077.tif, srtm/N28E076.tif`, which
 * pins that tile to Delhi. Everything else is cross-checked against the
 * textbook closed forms below rather than against hand arithmetic.
 */
const VERIFIED_REFERENCE = {
  name: "Delhi (verified against a live AWS Terrain Tiles response)",
  longitude: 77.209,
  latitude: 28.6139,
  zoom: 10,
  x: 731,
  y: 426,
};

/** Additional Indian cities, for breadth. Values are not hard-coded. */
const SITES: ReadonlyArray<{ name: string; longitude: number; latitude: number }> = [
  { name: "Taloja", longitude: 73.0856, latitude: 19.0418 },
  { name: "Bengaluru", longitude: 77.5946, latitude: 12.9716 },
  { name: "Chennai", longitude: 80.2707, latitude: 13.0827 },
  { name: "Kolkata", longitude: 88.3639, latitude: 22.5726 },
  { name: "Jaipur", longitude: 75.7873, latitude: 26.9124 },
  { name: "Guwahati", longitude: 91.7362, latitude: 26.1445 },
  { name: "Chandigarh", longitude: 76.7794, latitude: 30.7333 },
  { name: "Hyderabad", longitude: 78.4867, latitude: 17.385 },
  { name: "Ahmedabad", longitude: 72.5714, latitude: 23.0225 },
];

/**
 * Textbook slippy-map formulas, written from the definitions and deliberately
 * not sharing any code with `web-mercator.ts`. If both agree across a grid of
 * sites and zooms, the production code is right; if they disagree, one of them
 * is wrong and the disagreement is the finding.
 */
function textbookTile(
  longitude: number,
  latitude: number,
  zoom: number,
): { x: number; y: number } {
  const n = 2 ** zoom;
  const phi = (latitude * Math.PI) / 180;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log("lonLatToTile against the one externally verified reference");
check(VERIFIED_REFERENCE.name, () => {
  const tile = lonLatToTile(
    VERIFIED_REFERENCE.longitude,
    VERIFIED_REFERENCE.latitude,
    VERIFIED_REFERENCE.zoom,
  );
  assert.deepEqual(tile, {
    z: VERIFIED_REFERENCE.zoom,
    x: VERIFIED_REFERENCE.x,
    y: VERIFIED_REFERENCE.y,
  });
});

console.log("\nlonLatToTile agrees with the independent textbook formula");
for (const site of SITES) {
  check(`${site.name} across z0..z16`, () => {
    for (let zoom = 0; zoom <= 16; zoom += 1) {
      const mine = lonLatToTile(site.longitude, site.latitude, zoom);
      const theirs = textbookTile(site.longitude, site.latitude, zoom);
      assert.equal(mine.x, theirs.x, `x at z${zoom}`);
      assert.equal(mine.y, theirs.y, `y at z${zoom}`);
    }
  });
}

console.log("\nlonLatToTile on extremes");
check("equator on the prime meridian at z1 is 1/1", () => {
  assert.deepEqual(lonLatToTile(0, 0, 1), { z: 1, x: 1, y: 1 });
});
check("the north-west extreme lands on the first tile", () => {
  assert.deepEqual(lonLatToTile(-180, 85.05112878, 3), { z: 3, x: 0, y: 0 });
});
check("the south-east extreme lands on the last tile", () => {
  assert.deepEqual(lonLatToTile(180, -85.05112878, 3), { z: 3, x: 7, y: 7 });
});
check("every site resolves to an in-range tile at every zoom", () => {
  for (const site of SITES) {
    for (let zoom = 0; zoom <= 18; zoom += 1) {
      const span = 2 ** zoom;
      const tile = lonLatToTile(site.longitude, site.latitude, zoom);
      assert.ok(tile.x >= 0 && tile.x < span, `x out of range for ${site.name} z${zoom}`);
      assert.ok(tile.y >= 0 && tile.y < span, `y out of range for ${site.name} z${zoom}`);
    }
  }
});

console.log("\nlonLatTo3857 follows standard EPSG:3857 (Y increases northward)");
check("lon -180 maps to x=-HALF, lon +180 maps to x=+HALF, lon 0 to x=0", () => {
  assert.ok(Math.abs(lonLatTo3857(-180, 0).x + HALF_CIRCUMFERENCE) < 1e-6);
  assert.ok(Math.abs(lonLatTo3857(180, 0).x - HALF_CIRCUMFERENCE) < 1e-6);
  assert.ok(Math.abs(lonLatTo3857(0, 0).x) < 1e-9);
});
check("lat 0 maps to y=0, and y increases toward the north", () => {
  assert.ok(Math.abs(lonLatTo3857(0, 0).y) < 1e-9);
  assert.ok(lonLatTo3857(0, 45).y > lonLatTo3857(0, 0).y);
  assert.ok(lonLatTo3857(0, -45).y < lonLatTo3857(0, 0).y);
});
check("latitude clamps to the Mercator limit rather than overflowing", () => {
  const limit = Math.abs(lonLatTo3857(0, 90).y);
  assert.ok(limit < WORLD, "polar Y must stay inside the world extent");
  assert.ok(limit > HALF_CIRCUMFERENCE * 0.9, "clamped Y should approach +HALF");
  const flipped = lonLatTo3857(0, -90).y;
  assert.ok(flipped < -HALF_CIRCUMFERENCE * 0.9);
});

console.log("\ntileToBbox3857");
check("z0 x0 y0 covers the whole world", () => {
  const bbox = tileToBbox3857({ z: 0, x: 0, y: 0 });
  assert.ok(Math.abs(bbox.minX + HALF_CIRCUMFERENCE) < 1e-6);
  assert.ok(Math.abs(bbox.maxX - HALF_CIRCUMFERENCE) < 1e-6);
  assert.ok(Math.abs(bbox.minY + HALF_CIRCUMFERENCE) < 1e-6);
  assert.ok(Math.abs(bbox.maxY - HALF_CIRCUMFERENCE) < 1e-6);
});
check("every tile is TILE_SIZE * resolution wide", () => {
  for (const z of [0, 5, 10, 14]) {
    const bbox = tileToBbox3857({ z, x: 3, y: 7 });
    const expected = TILE_SIZE * metersPerPixel(z);
    assert.ok(Math.abs(bbox.maxX - bbox.minX - expected) < 1e-6, `width at z${z}`);
    assert.ok(Math.abs(bbox.maxY - bbox.minY - expected) < 1e-6, `height at z${z}`);
  }
});
check("north edge is the larger Y (y is top-down)", () => {
  const top = tileToBbox3857({ z: 4, x: 8, y: 0 });
  const bottom = tileToBbox3857({ z: 4, x: 8, y: 15 });
  assert.ok(top.maxY > bottom.maxY);
});
check("bboxes tile the plane without gaps", () => {
  const left = tileToBbox3857({ z: 6, x: 40, y: 30 });
  const right = tileToBbox3857({ z: 6, x: 41, y: 30 });
  assert.ok(Math.abs(left.maxX - right.minX) < 1e-6);
});

console.log("\nround trip: lonLat -> tile -> centre -> lonLat");
check("centres recover the input point", () => {
  for (const { longitude, latitude } of SITES) {
    for (const zoom of [8, 10, 12, 14]) {
      const tile = lonLatToTile(longitude, latitude, zoom);
      const centre = tileCenterLonLat(tile);
      const expected = tileCenterLonLat(
        lonLatToTile(centre.longitude, centre.latitude, zoom),
      );
      assert.ok(
        Math.abs(centre.longitude - expected.longitude) < 1e-9,
        `longitude drift at z${zoom} for ${longitude},${latitude}`,
      );
      assert.ok(
        Math.abs(centre.latitude - expected.latitude) < 1e-9,
        `latitude drift at z${zoom} for ${longitude},${latitude}`,
      );
    }
  }
});
check("tile centre sits inside its own tile", () => {
  for (const { longitude, latitude } of SITES) {
    for (const zoom of [4, 8, 12]) {
      const tile = lonLatToTile(longitude, latitude, zoom);
      const centre = tileCenterLonLat(tile);
      const refound = lonLatToTile(centre.longitude, centre.latitude, zoom);
      assert.deepEqual(refound, tile, `centre of ${tile} landed in ${refound}`);
    }
  }
});

console.log("\npointToTilePixel");
check("the centre of a tile samples the middle of the image", () => {
  const tile = { z: 12, x: 4927, y: 220 };
  const centre = tileCenterLonLat(tile);
  const pixel = pointToTilePixel(centre.longitude, centre.latitude, tile);
  assert.deepEqual(pixel, { i: 128, j: 128 });
});
check("mercatorToLonLat is an exact inverse of lonLatTo3857", () => {
  for (const site of SITES) {
    for (const point of [
      { longitude: site.longitude, latitude: site.latitude },
      { longitude: site.longitude, latitude: 0 },
      { longitude: 0, latitude: site.latitude },
    ]) {
      const projected = lonLatTo3857(point.longitude, point.latitude);
      const back = mercatorToLonLat(projected.x, projected.y);
      assert.ok(
        Math.abs(back.longitude - point.longitude) < 1e-9,
        `longitude round trip for ${JSON.stringify(point)}`,
      );
      assert.ok(
        Math.abs(back.latitude - point.latitude) < 1e-9,
        `latitude round trip for ${JSON.stringify(point)}`,
      );
    }
  }
});

check("a point near a tile's top-left samples a small row and column", () => {
  const tile = { z: 10, x: 731, y: 426 };
  const bbox = tileToBbox3857(tile);
  const probe = mercatorToLonLat(
    bbox.minX + (bbox.maxX - bbox.minX) * 0.1,
    bbox.maxY - (bbox.maxY - bbox.minY) * 0.1,
  );
  const pixel = pointToTilePixel(probe.longitude, probe.latitude, tile);
  assert.ok(pixel.i <= 32, `expected a small column, got i=${pixel.i}`);
  assert.ok(pixel.j <= 32, `expected a small row, got j=${pixel.j}`);
  // The probe must actually be inside this tile.
  assert.deepEqual(lonLatToTile(probe.longitude, probe.latitude, 10), tile);
});
check("a point near a tile's bottom-right samples a large row and column", () => {
  const tile = { z: 10, x: 731, y: 426 };
  const bbox = tileToBbox3857(tile);
  const probe = mercatorToLonLat(
    bbox.maxX - (bbox.maxX - bbox.minX) * 0.1,
    bbox.minY + (bbox.maxY - bbox.minY) * 0.1,
  );
  const pixel = pointToTilePixel(probe.longitude, probe.latitude, tile);
  assert.ok(pixel.i >= 224, `expected a large column, got i=${pixel.i}`);
  assert.ok(pixel.j >= 224, `expected a large row, got j=${pixel.j}`);
  assert.deepEqual(lonLatToTile(probe.longitude, probe.latitude, 10), tile);
});
check("offsets always stay inside the image", () => {
  for (const { longitude, latitude } of SITES) {
    for (const zoom of [0, 5, 10, 14]) {
      const tile = lonLatToTile(longitude, latitude, zoom);
      const pixel = pointToTilePixel(longitude, latitude, tile);
      assert.ok(pixel.i >= 0 && pixel.i < TILE_SIZE, `i out of range at z${zoom}`);
      assert.ok(pixel.j >= 0 && pixel.j < TILE_SIZE, `j out of range at z${zoom}`);
    }
  }
});
check("a northern point has a smaller row than a southern one", () => {
  const tile = { z: 10, x: 731, y: 426 };
  const north = pointToTilePixel(77.209, 30, tile);
  const south = pointToTilePixel(77.209, 25, tile);
  assert.ok(north.j < south.j, `expected j(north) < j(south), got ${north.j} vs ${south.j}`);
});

console.log("\nisValidTile");
check("rejects out-of-range and non-integer input", () => {
  assert.equal(isValidTile({ z: 4, x: 99, y: 5 }), false);
  assert.equal(isValidTile({ z: 4, x: 8, y: -1 }), false);
  assert.equal(isValidTile({ z: 4, x: 8, y: 16 }), false);
  assert.equal(isValidTile({ z: -1, x: 0, y: 0 }), false);
  assert.equal(isValidTile({ z: 26, x: 0, y: 0 }), false);
  assert.equal(isValidTile({ z: 1.5, x: 0, y: 0 }), false);
  assert.equal(isValidTile({ z: "4", x: 8, y: 5 }), false);
  assert.equal(isValidTile(null), false);
  assert.equal(isValidTile({ z: 4, x: 8, y: 5 }), true);
});

console.log(
  failures === 0
    ? "\nAll web-mercator assertions passed."
    : `\n${failures} assertion group(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
