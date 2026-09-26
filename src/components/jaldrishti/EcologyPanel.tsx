"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Trees, Waves, Mountain, Anchor } from "lucide-react";

const LAYER_META = {
  esz:     { label: "ESZ (Eco-Sensitive Zone)",     icon: <Mountain className="w-4 h-4" />, color: "#8b5cf6" },
  forest:  { label: "Forest (FC Act 1980)",          icon: <Trees className="w-4 h-4" />,   color: "#3ad17f" },
  wetland: { label: "Wetland (Rules 2017)",          icon: <Waves className="w-4 h-4" />,   color: "#06b6d4" },
  crz:     { label: "CRZ (Notification 2018)",       icon: <Anchor className="w-4 h-4" />, color: "#ff8c1a" },
} as const;

export function EcologyPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const eco = analysis.ecology as Record<
    "esz" | "forest" | "wetland" | "crz",
    {
      overlap: boolean;
      nearestDistanceKm: number;
      evidenceStatus: string;
      intersectedPolygons: { name: string; category?: string }[];
      rule: { outcome: string; reasons: string[]; hardConstraint: boolean; provenance: { source: string; sourceDate: string; evidenceStatus: string } };
    }
  >;

  const layers = Object.keys(LAYER_META) as ("esz" | "forest" | "wetland" | "crz")[];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4 h-full flex flex-col"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">Ecological Constraint Engine</h3>
      </div>

      <div className="flex-1 flex flex-col justify-between space-y-2">
        {layers.map((k) => {
          const e = eco[k];
          const meta = LAYER_META[k];
          return (
            <div
              key={k}
              className="border-[2px] border-black bg-[var(--paper)]"
              style={{ borderLeft: `8px solid ${meta.color}` }}
            >
              <div className="flex items-stretch">
                <div className="flex-1 p-2">
                  <div className="flex items-center gap-2">
                    {meta.icon}
                    <div className="font-extrabold text-xs uppercase tracking-wide">{meta.label}</div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="nb-badge"
                      style={{
                        background: e.overlap ? "var(--accent-red)" : "var(--accent-green)",
                        color: e.overlap ? "#fff" : "#000",
                      }}
                    >
                      {e.overlap ? "Potential overlap" : "No overlap found"}
                    </span>
                    {!e.overlap && (
                      <span className="text-[10px] font-mono">
                        Nearest: {e.nearestDistanceKm.toFixed(2)} km
                      </span>
                    )}
                    {e.overlap && e.intersectedPolygons.length > 0 && (
                      <span className="text-[10px] font-mono">
                        → {e.intersectedPolygons.map((p) => p.name).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-black/70">
                    {e.rule.outcome}
                  </div>
                  <ul className="mt-0.5 space-y-0">
                    {e.rule.reasons.map((reason, i) => (
                      <li key={i} className="text-[10px] text-black/70 leading-snug">· {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}