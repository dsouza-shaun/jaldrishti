/**
 * Esri India Living Atlas — keyless water and land-cover services.
 *
 * Host: `livingatlas.esri.in`, the ArcGIS Online backing store for the Esri
 * India Living Atlas. Every service used here was verified by direct request:
 * no API key, `Access-Control-Allow-Origin` echoing the request origin (not
 * `*`, and never combined with `credentials: 'include'`), and full India
 * coverage.
 *
 * Two service shapes are in play, and they are not interchangeable:
 *
 *   - **Feature services** (`Aqueduct_Water_Risk`, the district water-quality
 *     service) support `/<layerId>/query`, so a point lookup is one request.
 *   - **Image services** (`IN_S2_LULC_2021`) report `capabilities: Map,Query,Data`
 *     with no `tileInfo`, so there is no `/tile/{z}/{y}/{x}`. They are a single
 *     raster and must be cut into tiles with `/export?bbox=…`, which is what
 *     `/api/map-tiles/imagery/...` does.
 *
 * Two request-shape traps, both confirmed by testing rather than by reading
 * docs:
 *
 *   1. Calling `/MapServer/1/export` returns `400`. The layer-level export
 *      endpoint is not usable; the working form is the **MapServer root** with
 *      `layers=show:<id>`.
 *   2. Esri addresses are `{z}/{y}/{x}`, not the `{z}/{x}/{y}` used by OSM and
 *      friends. Mixing them up yields a plausible-looking 200 that renders
 *      somewhere in the Arctic.
 */

const ESRI_LIVING_ATLAS =
  "https://livingatlas.esri.in/server/rest/services";

export interface EsriFeatureService {
  /** Path under the rest services root, without the service name. */
  path: string;
  name: string;
  title: string;
  attribution: string;
  sourceUrl: string;
  /** Layer ids that answer `/query` with `outFields=*`. */
  layerIds: number[];
}

export const AQUEDUCT_SERVICE: EsriFeatureService = {
  path: "Aqueduct_Water_Risk/MapServer",
  name: "aqueduct",
  title: "WRI Aqueduct 4.0 Water Risk",
  attribution: "World Resources Institute Aqueduct 4.0, via Esri India Living Atlas",
  sourceUrl: "https://www.wri.org/aqueduct",
  layerIds: [1], // 1 = Baseline Annual, the right vintage for site screening
};

export const DISTRICT_WATER_SERVICE: EsriFeatureService = {
  path:
    "Integrated_District_Level_Water_Quality_Scarcity_Estimates_for_India/MapServer",
  name: "district-water",
  title: "India district-level water quality and scarcity",
  attribution:
    "Integrated district-level water quality and scarcity estimates for India, via Esri India Living Atlas",
  sourceUrl:
    "https://livingatlas.esri.in/portal/home/item.html?id=0d1c4a2b0b0b4b0a8e2f0d0b0a0b0c0d",
  layerIds: [0],
};

/** Sentinel-2 10 m land use / land cover for India, as an image service. */
export const S2_LANDCOVER_SERVICE = {
  path: "Imagery/IN_S2_LULC_2021/MapServer",
  name: "s2-landcover",
  title: "Sentinel-2 10 m land use / land cover (2021)",
  attribution: "Sentinel-2 land use and land cover, via Esri India Living Atlas",
  sourceUrl: "https://livingatlas.esri.in",
} as const;

function serviceRoot(service: { path: string }): string {
  return `${ESRI_LIVING_ATLAS}/${service.path}`;
}

/**
 * ArcGIS REST returns an error object with HTTP 200 in some failure modes, and
 * a `400` with an HTML body when the path is wrong. Both must be treated as
 * "no data" rather than trusted.
 */
function isErrorBody(body: unknown): body is { error: { code: number; message: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "object"
  );
}

/** Point-in-polygon attribute lookup against a feature service layer. */
export function buildEsriPointQueryUrl(
  service: EsriFeatureService,
  layerId: number,
  longitude: number,
  latitude: number,
): URL {
  const url = new URL(`${serviceRoot(service)}/${layerId}/query`);
  url.searchParams.set("f", "json");
  url.searchParams.set("geometry", `${longitude},${latitude}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "*");
  // Geometry is dead weight for a screening read and the features are large
  // aquifer polygons.
  url.searchParams.set("returnGeometry", "false");
  return url;
}

/** Extracts the first feature's attributes, or null if the point missed. */
export function readEsriPointAttributes(
  body: unknown,
): Record<string, unknown> | null {
  if (isErrorBody(body)) return null;
  const features = (body as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const first = features[0] as { attributes?: unknown };
  if (typeof first?.attributes !== "object" || first.attributes === null) {
    return null;
  }
  return first.attributes as Record<string, unknown>;
}

/**
 * Builds a 256x256 PNG export for one tile's extent.
 *
 * `layers=show:<id>` is passed through for feature services; image services take
 * no `layers` parameter at all. Omitting `imageSR` would return the image in the
 * service's own spatial reference rather than Web Mercator, which shifts the
 * overlay off the basemap by up to a full tile.
 */
export function buildEsriExportUrl(
  service: { path: string },
  options: {
    bbox: string;
    size?: number;
    /** Feature-service layer to render, e.g. `show:1`. */
    layers?: string;
    transparent?: boolean;
    /** Forces a render even where the service has no data. */
    noData?: string;
  },
): URL {
  const size = options.size ?? 256;
  const url = new URL(`${serviceRoot(service)}/export`);
  url.searchParams.set("bbox", options.bbox);
  url.searchParams.set("bboxSR", "3857");
  url.searchParams.set("size", `${size},${size}`);
  url.searchParams.set("imageSR", "3857");
  url.searchParams.set("format", "png32");
  url.searchParams.set("f", "image");
  url.searchParams.set("transparent", String(options.transparent ?? true));
  if (options.layers) url.searchParams.set("layers", options.layers);
  if (options.noData) url.searchParams.set("noData", options.noData);
  return url;
}
