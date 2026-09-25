"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Droplets, Zap, Calendar } from "lucide-react";

export function WaterDemandPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const w = analysis.waterDemand as unknown as {
    waterKlPerDay: number;
    waterMcmPerYear: number;
    facilityEnergyMwhPerDay: number;
    waterMld: number;
    wueUsed: number;
    wueSource: string;
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  };

  const stats = [
    { label: "Daily water demand", value: fmt(w.waterKlPerDay), unit: "kL/day", icon: <Droplets className="w-4 h-4" />, color: "var(--accent-red)" },
    { label: "Annual water demand", value: fmt(w.waterMcmPerYear), unit: "MCM/year", icon: <Calendar className="w-4 h-4" />, color: "var(--accent-orange)" },
    { label: "Facility energy", value: fmt(w.facilityEnergyMwhPerDay), unit: "MWh/day", icon: <Zap className="w-4 h-4" />, color: "var(--accent-yellow)" },
    { label: "Water (MLD)", value: fmt(w.waterMld), unit: "MLD", icon: <Droplets className="w-4 h-4" />, color: "var(--accent-purple)" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">Water Demand Engine</h3>
        <span className="nb-badge" style={{ background: "var(--accent-green)" }}>Calculated</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i }}
            className="border-[2px] border-black p-2"
            style={{ background: "var(--paper)" }}
          >
            <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
              {s.icon}
              {s.label}
            </div>
            <div className="font-extrabold text-lg leading-tight" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[10px] font-mono text-black/60">{s.unit}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
        <strong>WUE used:</strong> {String(w.wueUsed)} L/kWh · {String(w.wueSource)}<br />
        <strong>Source:</strong> {w.provenance.source} · {w.provenance.evidenceStatus}
      </div>
    </motion.section>
  );
}

function fmt(v: unknown): string {
  if (typeof v !== "number") return "—";
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toFixed(3);
}
