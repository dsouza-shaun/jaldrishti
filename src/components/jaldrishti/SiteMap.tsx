"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion } from "framer-motion";
import { Layers, Droplets } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";

const COLORS = {
  esz: { fill: "#8b5cf6", line: "#4c1d95", label: "Protected areas" },
  forest: { fill: "#3ad17f", line: "#0f5132", label: "Forest" },
  wetland: { fill: "#06b6d4", line: "#0e7490", label: "Wetlands" },
  crz: { fill: "#ff8c1a", line: "#9a3412", label: "Coastal" },
} as const;
const LAYERS = ["crz", "wetland", "forest", "esz"] as const;
type Layer = (typeof LAYERS)[number];
const GLOBAL_VECTOR_SOURCE = "global-osm-ecology";
const GLOBAL_VECTOR_LAYERS: Record<Layer, { sourceLayer: string; filter?: maplibregl.FilterSpecification }> = {
  esz: { sourceLayer: "park", filter: ["in", ["get", "class"], ["literal", ["national_park", "nature_reserve", "wildlife_sanctuary", "bird_sanctuary", "protected_area", "biosphere_reserve"]]] },
  forest: { sourceLayer: "landcover", filter: ["==", ["get", "class"], "wood"] },
  wetland: { sourceLayer: "landcover", filter: ["==", ["get", "class"], "wetland"] },
  crz: { sourceLayer: "landcover", filter: ["in", ["get", "subclass"], ["literal", ["mangrove", "saltmarsh", "tidalflat"]]] },
};

/**
 * Live water context that needs no credentials, served by the same
 * OpenFreeMap vector tiles already used for the ecological overlays. This is
 * what carries the "where is the water near this site" question when the
 * National Water Mission layer below is dormant.
 */
const PUBLIC_WATER_SOURCE = "public-osm-water";
const PUBLIC_WATER_FILL = "public-water-fill";
const PUBLIC_WATER_LINE = "public-water-line";

/**
 * National Water Mission ground water layers, relayed through the server-side
 * proxy. Two upstream WMS deployments sit behind one toggle group because they
 * answer different questions: `state` is the availability surface, `stations`
 * is the observed monitoring network.
 */
const NWM_SOURCE_STATE = "nwm-state";
const NWM_SOURCE_STATIONS = "nwm-stations";
const NWM_LAYER_STATE = "nwm-layer-state";
const NWM_LAYER_STATIONS = "nwm-layer-stations";
const NWM_MAX_ZOOM_STATE = 8;
const NWM_MAX_ZOOM_STATIONS = 14;

type ToggleId = Layer | "water" | "nwm";

const TOGGLE_LABELS: Record<ToggleId, string> = {
  esz: "Protected areas",
  forest: "Forest",
  wetland: "Wetlands",
  crz: "Coastal",
  water: "Water bodies",
  nwm: "Ground water",
};

const TOGGLE_COLORS: Record<ToggleId, string> = {
  esz: COLORS.esz.fill,
  forest: COLORS.forest.fill,
  wetland: COLORS.wetland.fill,
  crz: COLORS.crz.fill,
  water: "#38bdf8",
  nwm: "#0ea5e9",
};

/** MapLibre layer ids that each toggle switches, in paint order. */
const TOGGLE_TARGETS: Record<ToggleId, string[]> = {
  esz: [`fill-esz`, `line-esz`, `label-esz`, `global-fill-esz`, `global-line-esz`],
  forest: [`fill-forest`, `line-forest`, `label-forest`, `global-fill-forest`, `global-line-forest`],
  wetland: [`fill-wetland`, `line-wetland`, `label-wetland`, `global-fill-wetland`, `global-line-wetland`],
  crz: [`fill-crz`, `line-crz`, `label-crz`, `global-fill-crz`, `global-line-crz`],
  water: [PUBLIC_WATER_FILL, PUBLIC_WATER_LINE],
  nwm: [NWM_LAYER_STATE, NWM_LAYER_STATIONS],
};

interface NwmStatus {
  configured: boolean;
  live: boolean;
  outcome: string;
  detail: string;
}

async function fetchLayer(layer: Layer, latitude: number, longitude: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`/api/gis?layer=${layer}&lat=${latitude}&lng=${longitude}`);
      if (!response.ok) throw new Error(`Layer request failed (${response.status})`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function SiteMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Record<ToggleId, boolean>>({
    esz: true,
    forest: true,
    wetland: true,
    crz: true,
    water: true,
    // Ground water starts on only if the proxy reports a live session.
    nwm: false,
  });
  const [nwm, setNwm] = useState<NwmStatus | null>(null);
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
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [initialPosition.current.longitude, initialPosition.current.latitude],
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
  // Map is initialized once; site coordinates are applied after load.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    let cancelled = false;
    if (!map.getSource(GLOBAL_VECTOR_SOURCE)) {
      map.addSource(GLOBAL_VECTOR_SOURCE, {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet/latest",
        attribution: "© OpenStreetMap contributors © OpenMapTiles © OpenFreeMap",
      });
      for (const layer of LAYERS) {
        const globalLayer = GLOBAL_VECTOR_LAYERS[layer];
        map.addLayer({
          id: `global-fill-${layer}`,
          type: "fill",
          source: GLOBAL_VECTOR_SOURCE,
          "source-layer": globalLayer.sourceLayer,
          ...(globalLayer.filter ? { filter: globalLayer.filter } : {}),
          paint: { "fill-color": COLORS[layer].fill, "fill-opacity": 0.38 },
        });
        map.addLayer({
          id: `global-line-${layer}`,
          type: "line",
          source: GLOBAL_VECTOR_SOURCE,
          "source-layer": globalLayer.sourceLayer,
          ...(globalLayer.filter ? { filter: globalLayer.filter } : {}),
          paint: { "line-color": COLORS[layer].line, "line-width": 1.5 },
        });
      }
      // Live surface water and drainage, from the tile set already in use.
      // The fill is pinned directly above the basemap so the ground water
      // rasters added later can sit on top of it; the waterway line is
      // appended on top of the fill so streams are not hidden beneath it.
      map.addLayer({
        id: PUBLIC_WATER_FILL,
        type: "fill",
        source: GLOBAL_VECTOR_SOURCE,
        "source-layer": "water",
        paint: { "fill-color": TOGGLE_COLORS.water, "fill-opacity": 0.55 },
      }, "osm");
      map.addLayer({
        id: PUBLIC_WATER_LINE,
        type: "line",
        source: GLOBAL_VECTOR_SOURCE,
        "source-layer": "waterway",
        paint: { "line-color": "#0369a1", "line-width": 1.4 },
      });
    }
    // Rebuild the overlays when the selected site changes so each map view
    // shows nearby features for its current coordinates.
    for (const layer of LAYERS) {
      for (const id of [`label-${layer}`, `line-${layer}`, `fill-${layer}`]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(`src-${layer}`)) map.removeSource(`src-${layer}`);
    }
    for (const layer of LAYERS) {
      const sourceId = `src-${layer}`;
      const fillId = `fill-${layer}`;
      const lineId = `line-${layer}`;
      const labelId = `label-${layer}`;
      fetchLayer(layer, latitude, longitude).then((data) => {
        if (cancelled || !map.getStyle() || map.getSource(sourceId)) return;
        const color = COLORS[layer];
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({ id: fillId, type: "fill", source: sourceId, paint: { "fill-color": color.fill, "fill-opacity": 0.3 } });
        map.addLayer({ id: lineId, type: "line", source: sourceId, paint: { "line-color": color.line, "line-width": 2 } });
        map.addLayer({ id: labelId, type: "symbol", source: sourceId, layout: { "text-field": ["get", "name"], "text-size": 11, "text-allow-overlap": false }, paint: { "text-color": "#000", "text-halo-color": "#fff", "text-halo-width": 2 } });
        map.on("click", fillId, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const name = String(feature.properties?.name ?? COLORS[layer].label);
          const popup = document.createElement("div");
          popup.textContent = name;
          new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(popup).addTo(map);
        });
        map.on("mouseenter", fillId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", fillId, () => { map.getCanvas().style.cursor = ""; });
        map.setLayoutProperty(fillId, "visibility", visibleLayers[layer] ? "visible" : "none");
        map.setLayoutProperty(lineId, "visibility", visibleLayers[layer] ? "visible" : "none");
        map.setLayoutProperty(labelId, "visibility", visibleLayers[layer] ? "visible" : "none");
      }).catch((error) => console.warn(`Could not load ${layer} map layer`, error));
    }
    return () => { cancelled = true; };
  }, [loaded, latitude, longitude]);

  /**
   * Ask the proxy whether the National Water Mission feed is actually usable.
   * The upstream is session-gated, so the answer is a deployment question, not
   * a guess: without it the toggle would either be blank or misleading.
   */
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    fetch("/api/nwic?action=status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: NwmStatus | null) => {
        if (cancelled || !data) return;
        setNwm(data);
        // A live feed is worth showing by default; a dormant one is not.
        if (data.live) {
          setVisibleLayers((state) => (state.nwm ? state : { ...state, nwm: true }));
        }
      })
      .catch(() => { /* Status is advisory; the map stays usable without it. */ });
    return () => { cancelled = true; };
  }, [loaded]);

  /**
   * Add the National Water Mission rasters on demand. Deliberately lazy: in the
   * default deployment (no session) every tile would be a cached transparent
   * PNG, so nothing is requested until someone either turns the toggle on or
   * the status probe reports a live feed.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !visibleLayers.nwm) return;
    if (!map.getSource(NWM_SOURCE_STATE)) {
      map.addSource(NWM_SOURCE_STATE, {
        type: "raster",
        tiles: [`/api/map-tiles/nwic/state/{z}/{x}/{y}`],
        tileSize: 256,
        maxzoom: NWM_MAX_ZOOM_STATE,
        attribution: "National Water Mission — Jal Shakti",
      });
      map.addLayer(
        { id: NWM_LAYER_STATE, type: "raster", source: NWM_SOURCE_STATE, paint: { "raster-opacity": 0.7 } },
        "osm",
      );
    }
    if (!map.getSource(NWM_SOURCE_STATIONS)) {
      map.addSource(NWM_SOURCE_STATIONS, {
        type: "raster",
        tiles: [`/api/map-tiles/nwic/stations/{z}/{x}/{y}`],
        tileSize: 256,
        maxzoom: NWM_MAX_ZOOM_STATIONS,
        attribution: "National Water Mission — Jal Shakti",
      });
      // Stations sit above everything else: at site-screening zoom levels the
      // monitoring symbols are the readable part, and the availability surface
      // underneath is a wash. Appending keeps them on top regardless of what
      // other overlays are added later.
      map.addLayer({
        id: NWM_LAYER_STATIONS,
        type: "raster",
        source: NWM_SOURCE_STATIONS,
        paint: { "raster-opacity": 0.95 },
      });

      // Raster tiles expose no feature attributes to MapLibre, so a click is
      // resolved by asking the server for the record under the cursor using
      // WMS GetFeatureInfo.
      map.on("click", NWM_LAYER_STATIONS, (event) => {
        const lngLat = event.lngLat;
        const zoom = Math.min(NWM_MAX_ZOOM_STATIONS, Math.max(0, Math.round(map.getZoom())));
        const body = document.createElement("div");
        body.className = "text-xs font-mono";
        body.textContent = "Loading monitoring record…";
        const popup = new maplibregl.Popup().setLngLat(lngLat).setDOMContent(body).addTo(map);
        fetch(`/api/nwic?action=info&layer=stations&lat=${lngLat.lat}&lng=${lngLat.lng}&zoom=${zoom}`)
          .then((response) => response.json())
          .then((payload: { feature: Record<string, unknown> | null; message: string | null }) => {
            body.textContent = "";
            if (!payload.feature) {
              body.textContent = payload.message ?? "No monitoring record at this point.";
              return;
            }
            const properties = (payload.feature.properties ?? {}) as Record<string, unknown>;
            const heading = document.createElement("div");
            heading.className = "font-extrabold uppercase text-xs mb-1";
            heading.textContent = "Ground water monitoring record";
            body.appendChild(heading);
            for (const [key, value] of Object.entries(properties)) {
              if (value === null || value === "" || typeof value === "object") continue;
              const row = document.createElement("div");
              row.textContent = `${key.replace(/_/g, " ")}: ${value}`;
              body.appendChild(row);
            }
          })
          .catch(() => { body.textContent = "Could not reach the ground water service."; });
      });
      map.on("mouseenter", NWM_LAYER_STATIONS, () => { map.getCanvas().style.cursor = "crosshair"; });
      map.on("mouseleave", NWM_LAYER_STATIONS, () => { map.getCanvas().style.cursor = ""; });
    }
    for (const id of TOGGLE_TARGETS.nwm) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }
  }, [loaded, visibleLayers.nwm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    for (const [toggle, ids] of Object.entries(TOGGLE_TARGETS) as [ToggleId, string[]][]) {
      const visibility = visibleLayers[toggle] ? "visible" : "none";
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
      }
    }
  }, [visibleLayers, loaded]);

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

  const toggleOrder: ToggleId[] = ["crz", "wetland", "forest", "esz", "water", "nwm"];

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="nb-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-black bg-[var(--nb-tint)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold"><Layers className="h-4 w-4" />Site map</h2>
        <div className="flex flex-wrap gap-2">
          {toggleOrder.map((id) => (
            <button key={id} type="button" aria-pressed={visibleLayers[id]} onClick={() => setVisibleLayers((state) => ({ ...state, [id]: !state[id] }))} className="border-2 border-black px-2 py-1 text-xs font-semibold" style={{ background: visibleLayers[id] ? TOGGLE_COLORS[id] : "var(--paper)" }}>
              {TOGGLE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>
      <div ref={container} aria-label="Map showing the selected site and nearby environmental areas" className="h-[360px] w-full sm:h-[460px]" />
      <div className="flex flex-wrap items-start gap-2 border-t-2 border-black px-4 py-2 text-xs text-black/65">
        <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="min-w-0 flex-1">
          {nwm?.live
            ? "Ground water is the live National Water Mission (Jal Shakti) monitoring network; click a station for its record. Water bodies are OpenStreetMap data."
            : "Water bodies come from OpenStreetMap via OpenMapTiles, OpenFreeMap and NWM (Jal Shakti). Forests, wetlands and protected areas are indicative"}
        </p>
      </div>
    </motion.section>
  );
}
