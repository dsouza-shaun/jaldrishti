"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { motion } from "framer-motion";
import { Layers, MapPin } from "lucide-react";

// Layer colour scheme - each ecological layer gets a distinct, hard-edged colour
const LAYER_COLORS: Record<string, { fill: string; line: string; label: string }> = {
  esz:     { fill: "#8b5cf6", line: "#4c1d95", label: "ESZ" },
  forest:  { fill: "#3ad17f", line: "#0f5132", label: "Forest" },
  wetland: { fill: "#06b6d4", line: "#0e7490", label: "Wetland" },
  crz:     { fill: "#ff8c1a", line: "#9a3412", label: "CRZ" },
};

const LAYER_ORDER: ("esz" | "forest" | "wetland" | "crz")[] = ["crz", "wetland", "forest", "esz"];

interface LayerToggle {
  esz: boolean;
  forest: boolean;
  wetland: boolean;
  crz: boolean;
}

export function SiteMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [toggles, setToggles] = useState<LayerToggle>({ esz: true, forest: true, wetland: true, crz: true });
  const { form, analysis, selectedPolygon, setSelectedPolygon } = useJalDrishti();
  const mapLatitude = analysis?.site.latitude ?? form.latitude;
  const mapLongitude = analysis?.site.longitude ?? form.longitude;
  const mapProjectName = analysis?.projectName ?? form.projectName;

  // ---- init map once ----
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Keep the worker versioned with the installed MapLibre package. The
    // public copy avoids a runtime third-party dependency and CDN drift.
    try {
      const workerUrl = "/maplibre-gl-worker.mjs";
      const ml = maplibregl as unknown as { setWorkerUrl?: (url: string) => void };
      if (typeof ml.setWorkerUrl === "function") {
        ml.setWorkerUrl(workerUrl);
      }
    } catch (e) {
      console.warn("Failed to set maplibre worker URL", e);
    }

    // OSM raster tiles - free, no API key
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            paint: { "raster-opacity": 0.85 },
          },
        ],
      },
      center: [mapLongitude, mapLatitude],
      zoom: 11,
      attributionControl: {},
      hash: false,
    });

    mapRef.current = map;
    map.on("load", () => setLoaded(true));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- load ecological layers ----
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;

    LAYER_ORDER.forEach((layerKey) => {
      const color = LAYER_COLORS[layerKey];
      const sourceId = `src-${layerKey}`;
      const fillId = `fill-${layerKey}`;
      const lineId = `line-${layerKey}`;
      const labelId = `label-${layerKey}`;

      // Remove existing layer/source if any
      [fillId, lineId, labelId].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      fetch(`/api/gis?layer=${layerKey}`)
        .then((r) => r.json())
        .then((fc) => {
          map.addSource(sourceId, { type: "geojson", data: fc });
          map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": color.fill,
              "fill-opacity": 0.35,
            },
            filter: ["==", "$type", "Polygon"],
          });
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": color.line,
              "line-width": 2,
            },
          });
          // Labels - symbol layer using name property
          map.addLayer({
            id: labelId,
            type: "symbol",
            source: sourceId,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-anchor": "center",
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": "#000",
              "text-halo-color": "#fff",
              "text-halo-width": 2,
            },
          });

          // Click handler
          map.on("click", fillId, (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const props = f.properties as {
              name: string;
              layer: string;
              category?: string;
              source?: string;
              sourceDate?: string;
              evidenceStatus?: string;
            };
            setSelectedPolygon(props);
            const coords = (f.geometry as { coordinates: number[][][] }).coordinates[0][0];
            const popupContent = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = props.name;
            const details = document.createElement("div");
            details.style.fontSize = "11px";
            details.textContent = `${props.layer.toUpperCase()} · ${props.category ?? ""}`;
            const source = document.createElement("div");
            source.style.fontSize = "10px";
            source.textContent = `Source: ${props.source ?? ""}`;
            const updated = document.createElement("div");
            updated.style.fontSize = "10px";
            updated.textContent = `Updated: ${props.sourceDate ?? ""}`;
            const evidence = document.createElement("div");
            evidence.style.fontSize = "10px";
            evidence.textContent = `Evidence: ${props.evidenceStatus ?? ""}`;
            popupContent.append(title, details, source, updated, evidence);
            new maplibregl.Popup()
              .setLngLat(coords as [number, number])
              .setDOMContent(popupContent)
              .addTo(map);
          });

          // Cursor
          map.on("mouseenter", fillId, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", fillId, () => (map.getCanvas().style.cursor = ""));
        });
    });
  }, [loaded, setSelectedPolygon]);

  // ---- update site marker + fly when form coords change ----
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;

    // Remove existing site marker
    const existing = document.getElementById("site-marker");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "site-marker";
    el.style.cssText = `
      width: 24px; height: 24px;
      background: var(--accent-red);
      border: 3px solid #000;
      border-radius: 50%;
      box-shadow: 3px 3px 0 0 #000;
      cursor: pointer;
    `;
    const popupContent = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Proposed Site";
    const coordinates = document.createElement("div");
    coordinates.style.fontSize = "11px";
    coordinates.style.fontFamily = "monospace";
    coordinates.textContent = `${mapLatitude.toFixed(4)}, ${mapLongitude.toFixed(4)}`;
    const project = document.createElement("div");
    project.style.fontSize = "10px";
    project.textContent = mapProjectName;
    popupContent.append(title, coordinates, project);

    new maplibregl.Marker({ element: el })
      .setLngLat([mapLongitude, mapLatitude])
      .setPopup(new maplibregl.Popup().setDOMContent(popupContent))
      .addTo(map);

    map.flyTo({ center: [mapLongitude, mapLatitude], zoom: 12, duration: 1200 });
  }, [loaded, mapLatitude, mapLongitude, mapProjectName]);

  // ---- apply layer toggles ----
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    LAYER_ORDER.forEach((layerKey) => {
      const fillId = `fill-${layerKey}`;
      const lineId = `line-${layerKey}`;
      const labelId = `label-${layerKey}`;
      const visible = toggles[layerKey] ? "visible" : "none";
      [fillId, lineId, labelId].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible);
      });
    });
  }, [toggles, loaded]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card overflow-hidden"
    >
      <div className="flex items-center justify-between border-b-[3px] border-black px-4 py-2.5 bg-[var(--accent-yellow)]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <h2 className="text-base font-extrabold uppercase tracking-tight">Site map</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {LAYER_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setToggles((t) => ({ ...t, [k]: !t[k] }))}
              className="text-[10px] font-bold uppercase border-[2px] border-black px-1.5 py-0.5"
              style={{
                background: toggles[k] ? LAYER_COLORS[k].fill : "var(--paper)",
                color: toggles[k] ? "#fff" : "#000",
                opacity: toggles[k] ? 1 : 0.55,
              }}
            >
              {LAYER_COLORS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div ref={mapContainer} className="w-full h-[320px] sm:h-[400px] md:h-[460px] border-b-[3px] border-black" />

        {/* Coordinate readout */}
        <div className="absolute bottom-2 left-2 bg-[var(--paper)] border-[3px] border-black px-2 py-1 text-[10px] font-mono font-bold shadow-[3px_3px_0_0_#000]">
          <MapPin className="w-3 h-3 inline" /> {mapLatitude.toFixed(4)}, {mapLongitude.toFixed(4)}
        </div>

        {/* Selected polygon info */}
        {selectedPolygon && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-2 right-2 bg-[var(--paper)] border-[3px] border-black px-3 py-2 text-xs shadow-[3px_3px_0_0_#000] max-w-[260px]"
          >
            <div className="font-extrabold uppercase text-[10px] mb-0.5">Selected Polygon</div>
            <div className="font-bold">{selectedPolygon.name}</div>
            <div className="text-[10px] text-black/70 mt-0.5">
              {selectedPolygon.layer.toUpperCase()} · {selectedPolygon.category}
            </div>
            <div className="text-[10px] text-black/60 mt-1">
              {selectedPolygon.source}<br />
              Updated: {selectedPolygon.sourceDate}<br />
              Evidence: <span className="font-bold">{selectedPolygon.evidenceStatus}</span>
            </div>
          </motion.div>
        )}

        {/* Legend */}
        <div className="absolute top-2 left-2 bg-[var(--paper)] border-[3px] border-black px-2 py-1.5 text-[10px] font-bold shadow-[3px_3px_0_0_#000]">
          <div className="uppercase text-[9px] mb-1">Legend</div>
          {LAYER_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-1.5 mb-0.5">
              <span className="w-3 h-3 border border-black" style={{ background: LAYER_COLORS[k].fill }} />
              {LAYER_COLORS[k].label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "var(--accent-red)", border: "2px solid #000" }} />
            Site
          </div>
        </div>
      </div>

      {/* Overlap banner from backend analysis */}
      {analysis && (
        <div className="px-4 py-2 bg-[var(--paper)] text-xs">
          <div className="font-extrabold uppercase text-[10px] mb-1">Spatial check results</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {LAYER_ORDER.map((k) => {
              const e = (analysis.ecology as Record<string, { overlap: boolean; nearestDistanceKm: number }>)[k];
              return (
                <div
                  key={k}
                  className="border-[2px] border-black px-2 py-1 font-mono"
                  style={{ background: e?.overlap ? "var(--accent-red)" : "var(--accent-green)", color: "#000" }}
                >
                  <div className="font-extrabold uppercase">{LAYER_COLORS[k].label}</div>
                  <div className="text-[10px]">
                    {e?.overlap ? "OVERLAP" : "CLEAR"} · {e?.nearestDistanceKm?.toFixed(2) ?? "0"} km
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.section>
  );
}
