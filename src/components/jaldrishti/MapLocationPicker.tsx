"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";

interface MapLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}

/** A simple, draggable map pin for choosing a proposed site. */
export function MapLocationPicker({ latitude, longitude, onChange }: MapLocationPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialCoordinates = useRef({ latitude, longitude });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current || map.current) return;
    try {
      const ml = maplibregl as unknown as { setWorkerUrl?: (url: string) => void };
      ml.setWorkerUrl?.("/maplibre-gl-worker.mjs");
    } catch { /* MapLibre can use its default worker when unavailable. */ }

    const instance = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [initialCoordinates.current.longitude, initialCoordinates.current.latitude], zoom: 11,
      dragPan: true, scrollZoom: true, doubleClickZoom: true,
      attributionControl: {},
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    const pin = new maplibregl.Marker({ color: "#e64136", draggable: true })
      .setLngLat([initialCoordinates.current.longitude, initialCoordinates.current.latitude]).addTo(instance);
    marker.current = pin;
    pin.on("dragend", () => {
      const point = pin.getLngLat();
      onChangeRef.current(point.lat, point.lng);
    });
    instance.on("click", (event) => {
      pin.setLngLat(event.lngLat);
      onChangeRef.current(event.lngLat.lat, event.lngLat.lng);
    });
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  // The map is initialized once; subsequent coordinates update the marker below.
  }, []);

  useEffect(() => {
    marker.current?.setLngLat([longitude, latitude]);
    if (map.current) map.current.easeTo({ center: [longitude, latitude], duration: 250 });
  }, [latitude, longitude]);

  return (
    <div className="overflow-hidden border-[3px] border-black">
      <div ref={container} className="h-[280px] w-full sm:h-[360px]" aria-label="Map to select a site location" />
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--paper)] px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-[var(--accent-red)]" />Click the map or drag the pin to choose your site</span>
        <span className="text-xs text-black/55">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
      </div>
    </div>
  );
}
