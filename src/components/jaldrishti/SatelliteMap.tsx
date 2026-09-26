"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion } from "framer-motion";
import { Satellite, Info } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";

/**
 * A second, separate map showing what the ground actually looks like, as
 * opposed to the regulatory-overlay view in {@link SiteMap}.
 *
 * Three raster sources are composed, bottom to top:
 *
 *   1. **Sentinel-2 10 m land use / land cover** for India (2021), relayed
 *      through `/api/map-tiles/imagery/s2-landcover`. This is the actual
 *      satellite classification, and it carries a water-body class, so it
 *      answers "is there water here" from imagery rather than from OSM tags.
 *   2. **WRI Aqueduct 4.0 water risk** polygons (`aqueduct-risk`), so the
 *      basin-scale risk model can be read spatially next to the imagery.
 *   3. **AWS Terrain Tiles** hillshade, straight from S3 â€” the bucket sends
 *      `Access-Control-Allow-Origin: *`, so it needs no proxy and costs one
 *      less hop.
 *
 * The land-cover service is an ArcGIS *image* service with no tile pyramid, and
 * Aqueduct must be requested through the MapServer root with `layers=show:1`,
 * which is why both go through the same export-based relay.
 */

const S2_SOURCE = "s2-landcover";
const AQUEDUCT_SOURCE = "aqueduct-risk";
const HILLSHADE_SOURCE = "terrain-hillshade";

const LAYER_S2 = "layer-s2-landcover";
const LAYER_AQUEDUCT = "layer-aqueduct";
const LAYER_HILLSHADE = "layer-hillshade";

type Overlay = "s2" | "bundled" | "aqueduct" | "hillshade";

const OVERLAYS: Record<Overlay, { label: string; color: string; legend: string[] }> = {
  s2: {
    label: "Land cover",
    color: "#3ad17f",
    legend: [
      "Built-up / hard surfaces",
      "Vegetation",
      "Water bodies",
      "Bare / disturbed ground",
      "Agricultural land",
    ],
  },
  bundled: {
    label: "Bundled rasters",
    color: "#f096ff",
    legend: [],
  },
  aqueduct: {
    label: "Water risk",
    color: "#ff8c1a",
    legend: [
      "Low to low-medium risk",
      "Low to medium risk",
      "Medium to high risk",
      "High risk",
      "Extremely high risk",
    ],
  },
  hillshade: {
    label: "Terrain",
    color: "#8b5cf6",
    legend: ["Shaded relief from SRTM elevation"],
  },
};

interface LandCoverRasterEntry {
  id: string;
  locations: string[];
  /** `[west, south, east, north]` in EPSG:4326. */
  bounds: [number, number, number, number];
}

/** Source id prefix for a georeferenced bundled raster. */
const BUNDLED_SOURCE_PREFIX = "bundled-landcover-";

/**
 * A bundled footprint is a single small GeoTIFF, not a tile pyramid, so it is
 * placed with a MapLibre `image` source carrying explicit corner coordinates.
 * That is why no reprojection is needed here: MapLibre does the placement.
 */
function bundledSourceId(rasterId: string): string {
  return `${BUNDLED_SOURCE_PREFIX}${rasterId.slice(0, 16)}`;
}

function bundledLayerId(rasterId: string): string {
  return `layer-bundled-${rasterId.slice(0, 16)}`;
}

/** Does a raster footprint intersect the current viewport? */
function intersectsViewport(
  bounds: [number, number, number, number],
  west: number,
  south: number,
  east: number,
  north: number,
): boolean {
  return !(bounds[2] < west || bounds[0] > east || bounds[3] < south || bounds[1] > north);
}

export function SatelliteMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState<Record<Overlay, boolean>>({
    // Land cover is the point of this map, so it leads. The risk surface is
    // useful but visually loud, so it stays off until asked for.
    s2: true,
    bundled: false,
    aqueduct: false,
    hillshade: true,
  });
  const [bundledCatalog, setBundledCatalog] = useState<{
    rasters: LandCoverRasterEntry[];
    legend: Array<{ code: number; label: string; color: string }>;
    attribution: string;
  } | null>(null);
  const { form, analysis } = useJalDrishti();
  const rawLatitude = analysis?.site.latitude ?? form.latitude;
  const rawLongitude = analysis?.site.longitude ?? form.longitude;
  const latitude = Number.isFinite(rawLatitude) ? rawLatitude : 19.0418;
  const longitude = Number.isFinite(rawLongitude) ? rawLongitude : 73.0856;
  const projectName = analysis?.projectName ?? form.projectName;
  const initialPosition = useRef({ latitude, longitude });

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    try {
      const lib = maplibregl as unknown as { setWorkerUrl?: (url: string) => void };
      lib.setWorkerUrl?.("/maplibre-gl-worker.mjs");
    } catch { /* Use the default worker if the local worker is unavailable. */ }

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          // A plain, low-key backdrop so the classified imagery reads clearly
          // rather than competing with cartographic detail.
          basemap: {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 16,
            attribution: "© Esri, HERE, Garmin, © OpenStreetMap contributors",
          },
        },
        layers: [
          { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 0.9 } },
        ],
      },
      center: [initialPosition.current.longitude, initialPosition.current.latitude],
      // The land-cover classification is a 10 m product; 14 is where a single
      // screen shows a site in its immediate surroundings rather than a state.
      zoom: 14,
      dragPan: true,
      scrollZoom: true,
      attributionControl: {},
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => setLoaded(true));
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // Map is initialised once; the site is applied after load.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;

    if (!map.getSource(HILLSHADE_SOURCE)) {
      // Sent directly from S3 with `Access-Control-Allow-Origin: *`, so this
      // one bypasses the relay entirely.
      map.addSource(HILLSHADE_SOURCE, {
        type: "raster",
        tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/normal/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 14,
        attribution: "Mapzen / Tilezen, from SRTM, GMTED and ETOPO1",
      });
      // Sits above the basemap but below the thematic overlays: relief is
      // context, land cover is the subject.
      map.addLayer(
        {
          id: LAYER_HILLSHADE,
          type: "raster",
          source: HILLSHADE_SOURCE,
          paint: { "raster-opacity": 0.45 },
        },
        "basemap",
      );
    }

    if (!map.getSource(S2_SOURCE)) {
      map.addSource(S2_SOURCE, {
        type: "raster",
        tiles: [`/api/map-tiles/imagery/s2-landcover/{z}/{x}/{y}`],
        tileSize: 256,
        minzoom: 6,
        maxzoom: 15,
        attribution: "Sentinel-2 land use and land cover, via Esri India Living Atlas",
      });
    }
    if (!map.getLayer(LAYER_S2)) {
      map.addLayer({
        id: LAYER_S2,
        type: "raster",
        source: S2_SOURCE,
        // Let the hillshade read through the classification rather than
        // flattening the terrain entirely.
        paint: { "raster-opacity": 0.85, "raster-fade-duration": 200 },
      });
    }

    if (!map.getSource(AQUEDUCT_SOURCE)) {
      map.addSource(AQUEDUCT_SOURCE, {
        type: "raster",
        tiles: [`/api/map-tiles/imagery/aqueduct-risk/{z}/{x}/{y}`],
        tileSize: 256,
        minzoom: 4,
        maxzoom: 10,
        attribution: "WRI Aqueduct 4.0, via Esri India Living Atlas",
      });
    }
    if (!map.getLayer(LAYER_AQUEDUCT)) {
      map.addLayer({
        id: LAYER_AQUEDUCT,
        type: "raster",
        source: AQUEDUCT_SOURCE,
        // The upstream ramp is opaque by design; a multiply-style overlay is
        // not available for raster, so transparency carries the blend.
        paint: { "raster-opacity": 0.6 },
      });
    }
  }, [loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const targets: Record<Overlay, string> = {
      s2: LAYER_S2,
      bundled: "",
      aqueduct: LAYER_AQUEDUCT,
      hillshade: LAYER_HILLSHADE,
    };
    for (const [overlay, layerId] of Object.entries(targets) as [Overlay, string][]) {
      if (!layerId) continue; // the bundled overlay has one layer per raster
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible[overlay] ? "visible" : "none");
      }
    }
  }, [visible, loaded]);

  /**
   * Place the bundled WorldCover footprints on the map.
   *
   * These are 40 discrete ~10 km extracts, not a mosaic, so the map shows a
   * bounded rectangle over whichever extract the viewport covers and nothing at
   * all elsewhere. That is honest: the app genuinely has no land-cover data
   * outside those footprints, and the evidence table already says so.
   *
   * Layers are added and removed on `moveend` so a long pan neither accumulates
   * every raster it passed over nor holds a source for one that has left.
   */
  useEffect(() => {
    if (!loaded || !visible.bundled) return;
    let cancelled = false;

    fetch("/api/land-cover-catalog")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBundledCatalog({
          rasters: data.rasters,
          legend: data.legend,
          attribution: data.attribution,
        });
      })
      .catch(() => { /* The overlay is optional; the map works without it. */ });

    return () => { cancelled = true; };
  }, [loaded, visible.bundled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !visible.bundled) return;

    const rasters = bundledCatalog?.rasters ?? [];
    const sync = () => {
      const bounds = map.getBounds();
      const west = bounds.getWest();
      const east = bounds.getEast();
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const wanted = new Set(
        rasters
          .filter((raster) => intersectsViewport(raster.bounds, west, south, east, north))
          .map((raster) => raster.id),
      );

      // Drop anything that has left the viewport, or that is hidden.
      for (const sourceId of Object.keys(map.getStyle().sources)) {
        if (!sourceId.startsWith(BUNDLED_SOURCE_PREFIX)) continue;
        const rasterId = rasters.find(
          (raster) => bundledSourceId(raster.id) === sourceId,
        )?.id;
        if (wanted.has(rasterId ?? "")) continue;
        const layerId = bundledLayerId(rasterId ?? sourceId.slice(BUNDLED_SOURCE_PREFIX.length));
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }

      for (const raster of rasters) {
        const sourceId = bundledSourceId(raster.id);
        if (map.getSource(sourceId) || !wanted.has(raster.id)) continue;
        const [west2, south2, east2, north2] = raster.bounds;
        map.addSource(sourceId, {
          type: "image",
          url: `/api/land-cover-catalog/${raster.id}`,
          coordinates: [
            [west2, north2],
            [east2, north2],
            [east2, south2],
            [west2, south2],
          ],
        });
        map.addLayer(
          {
            id: bundledLayerId(raster.id),
            type: "raster",
            source: sourceId,
            paint: { "raster-opacity": 0.75 },
          },
          LAYER_S2,
        );
      }
    };

    sync();
    map.on("moveend", sync);
    map.on("zoomend", sync);
    return () => {
      map.off("moveend", sync);
      map.off("zoomend", sync);
    };
  }, [loaded, visible.bundled, bundledCatalog]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: "#e64136" })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
    }
    markerRef.current.setPopup(new maplibregl.Popup().setText(projectName));
    map.easeTo({ center: [longitude, latitude], zoom: 14, duration: 500 });
  }, [loaded, latitude, longitude, projectName]);

  const order: Overlay[] = ["s2", "bundled", "aqueduct", "hillshade"];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-black bg-[var(--accent-teal)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Satellite className="h-4 w-4" />Satellite and terrain view
        </h2>
        <div className="flex flex-wrap gap-2">
          {order.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={visible[id]}
              onClick={() => setVisible((state) => ({ ...state, [id]: !state[id] }))}
              className="border-2 border-black px-2 py-1 text-xs font-semibold"
              style={{ background: visible[id] ? OVERLAYS[id].color : "var(--paper)" }}
            >
              {OVERLAYS[id].label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={container}
        aria-label="Satellite land cover, water risk and terrain map for the selected site"
        className="h-[320px] w-full sm:h-[400px]"
      />
      <div className="flex flex-wrap items-start gap-3 border-t-2 border-black px-4 py-2 text-xs text-black/70">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          {order
            .filter((id) => visible[id])
            .map((id) => (
              <div key={id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-extrabold">{OVERLAYS[id].label}:</span>
                <span className="text-black/60">
                  {id === "bundled"
                    ? (bundledCatalog?.rasters.length ?? 0) === 0
                      ? "no bundled footprints near this view"
                      : `${bundledCatalog?.rasters.length} bundled ESA WorldCover footprints, drawn where the view covers them`
                    : OVERLAYS[id].legend.join(" · ")}
                </span>
              </div>
            ))}

          {/* The bundled rasters carry the official ESA legend, so it is worth
              showing properly rather than as a prose list. */}
          {visible.bundled && (bundledCatalog?.legend.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-dashed border-black/30 pt-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-black/60">
                ESA WorldCover v200 classes
              </div>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
                {bundledCatalog?.legend.map((entry) => (
                  <li key={entry.code} className="flex items-center gap-1.5 text-[10px]">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 border border-black/40"
                      style={{ background: entry.color }}
                    />
                    <span className="truncate">{entry.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] text-black/55">{bundledCatalog?.attribution}</p>
            </div>
          )}

          <p className="text-[11px] leading-snug text-black/55">
            Land cover is a 2021 Sentinel-2 classification at 10 m and water risk
            is a 2019 basin-scale model. Neither resolves a plot boundary, and
            both are indicative. Terrain is SRTM-derived at roughly 30 m. The
            bundled rasters cover 40 discrete locations and are shown only
            inside their own footprints.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
