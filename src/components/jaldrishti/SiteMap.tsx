"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";
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
  const [visibleLayers, setVisibleLayers] = useState<Record<Layer, boolean>>({ esz: true, forest: true, wetland: true, crz: true });
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

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    for (const layer of LAYERS) {
      const visibility = visibleLayers[layer] ? "visible" : "none";
      for (const id of [`fill-${layer}`, `line-${layer}`, `label-${layer}`, `global-fill-${layer}`, `global-line-${layer}`]) {
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

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="nb-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-black bg-[var(--accent-yellow)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold"><Layers className="h-4 w-4" />Site map</h2>
        <div className="flex flex-wrap gap-2">
          {LAYERS.map((layer) => (
            <button key={layer} type="button" aria-pressed={visibleLayers[layer]} onClick={() => setVisibleLayers((state) => ({ ...state, [layer]: !state[layer] }))} className="border-2 border-black px-2 py-1 text-xs font-semibold" style={{ background: visibleLayers[layer] ? COLORS[layer].fill : "var(--paper)" }}>
              {COLORS[layer].label}
            </button>
          ))}
        </div>
      </div>
      <div ref={container} aria-label="Map showing the selected site and nearby environmental areas" className="h-[360px] w-full sm:h-[460px]" />
      <p className="border-t-2 border-black px-4 py-2 text-xs text-black/65">Global mapped forests, wetlands and protected areas use OpenStreetMap data through OpenMapTiles and OpenFreeMap. They are indicative; confirm boundaries with local authorities. Drag to move or zoom in to see more.</p>
    </motion.section>
  );
}
