"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Factory, MapPin } from "lucide-react";

interface NearbyPlant {
  id: string;
  name: string;
  distanceKm: number;
  capacityMw: number | null;
  primaryFuel: string | null;
  capacityDataYear: number | null;
  latestGeneration: {
    year: number | null;
    generationGwh: number;
    estimated: boolean;
  } | null;
}

export function PowerPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const power = analysis.power as {
    timeline: string;
    substation: string | null;
    nearbyPowerPlants: NearbyPlant[];
    provenance: {
      source: string;
      sourceDate: string;
      evidenceStatus: string;
      caveat?: string;
    };
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">
          Nearest Power Plants
        </h3>
      </div>
      {power.nearbyPowerPlants.length === 0 ? (
        <div className="border-[2px] border-black p-3 text-xs font-mono">
          No coordinate-bearing plant record available.
        </div>
      ) : (
        <div className="space-y-2">
          {power.nearbyPowerPlants.map((plant) => (
            <div
              key={plant.id}
              className="border-[2px] border-black p-2 bg-[var(--paper)]"
            >
              <div className="flex items-start gap-2">
                <Factory className="w-3 h-3 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-xs break-words">
                    {plant.name}
                  </div>
                  <div className="text-[10px] font-mono text-black/70">
                    {plant.capacityMw != null
                      ? `${plant.capacityMw.toLocaleString()} MW`
                      : "Capacity unknown"}
                    {plant.primaryFuel ? ` · ${plant.primaryFuel}` : ""}
                    {plant.capacityDataYear ? ` · ${plant.capacityDataYear}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono whitespace-nowrap">
                  <MapPin className="w-3 h-3" /> {plant.distanceKm.toFixed(1)} km
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
