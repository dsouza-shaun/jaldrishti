"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { CloudRain, MapPin } from "lucide-react";
import { EvidenceBadge } from "./GroundwaterPanel";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

export function RainfallPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const r = analysis.rainfall as {
    station: string | null;
    annualNormal: number | null;
    monsoonNormal: number | null;
    distanceKm: number;
    timeseries: { year: number; annual: number }[];
    provenance: { source: string; sourceDate: string; evidenceStatus: string };
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">Rainfall / Climate (IMD)</h3>
        <EvidenceBadge status={r.provenance.evidenceStatus} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
            <MapPin className="w-3 h-3" /> Nearest station
          </div>
          <div className="font-bold text-sm">{r.station ?? "UNKNOWN"}</div>
          <div className="text-[10px] font-mono text-black/60">{r.distanceKm.toFixed(2)} km away</div>
        </div>
        <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
            <CloudRain className="w-3 h-3" /> Annual normal
          </div>
          <div className="font-extrabold text-lg" style={{ color: "var(--accent-purple)" }}>
            {r.annualNormal != null ? `${r.annualNormal} mm` : "—"}
          </div>
          <div className="text-[10px] font-mono text-black/60">
            Monsoon: {r.monsoonNormal ?? "—"} mm
          </div>
        </div>
      </div>

      {/* Time-series chart */}
      {r.timeseries.length > 0 && (
        <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
          <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60 mb-1">
            10-year annual rainfall (mm)
          </div>
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <LineChart data={r.timeseries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#000" />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#000" width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--paper)",
                    border: "2px solid #000",
                    borderRadius: 0,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine y={r.annualNormal ?? 0} stroke="#ff3b3b" strokeWidth={2} strokeDasharray="4 2"
                  label={{ value: "Normal", position: "insideTopRight", fontSize: 9, fontWeight: 700, fill: "#ff3b3b" }} />
                <Line type="monotone" dataKey="annual" stroke="#000" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent-purple)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
        <strong>Source:</strong> {r.provenance.source}<br />
        <strong>Source date:</strong> {r.provenance.sourceDate}
      </div>
    </motion.section>
  );
}
