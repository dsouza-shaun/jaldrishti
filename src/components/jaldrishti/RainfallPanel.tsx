"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { CloudRain, MapPin, Thermometer, Sun, Droplets } from "lucide-react";
import { EvidenceBadge } from "./GroundwaterPanel";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface RainfallResult {
  datasetType: "DISTRICT_CSV" | "MOCK_STATION_FALLBACK" | "UNKNOWN";
  station: string | null;
  district: string | null;
  annualRainfallMm: number | null;
  monsoonRainfallMm: number | null;
  distanceKm: number | null;
  timeseries: { year: number; annual: number }[];
  period: string;
  provenance: {
    source: string;
    sourceDate: string;
    evidenceStatus: string;
    caveat?: string;
  };
}

interface ClimateResult {
  provider: string;
  retrievedAt: string;
  cacheStatus: "MISS" | "HIT" | "STALE";
  data: {
    current: {
      temperatureC: number | null;
      relativeHumidityPercent: number | null;
      precipitationMm: number | null;
      referenceEt0Mm: number | null;
      soilMoistureM3M3: { depth3To9cm: number | null };
      weatherDescription: string | null;
    } | null;
    daily: Array<{
      date: string;
      precipitationMm: number | null;
      et0Mm: number | null;
      temperatureMaxC: number | null;
      temperatureMinC: number | null;
    }>;
    sevenDayWaterBalanceMm: {
      precipitation: number;
      referenceEt0: number;
      precipitationMinusEt0: number;
    };
    attribution: { label: string; sourceUrl: string; licenseUrl: string };
    modelCaveat: string;
  };
}

export function RainfallPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const rainfall = analysis.rainfall as unknown as RainfallResult;
  const climate = analysis.siteData.climate as unknown as ClimateResult | null;
  const reusedAt = analysis.siteData.reusedAt;
  const isDistrict = rainfall.datasetType === "DISTRICT_CSV";
  const locationLine =
    rainfall.distanceKm !== null
      ? `${rainfall.distanceKm.toFixed(2)} km from fallback centroid`
      : isDistrict
        ? "State + district matched"
        : "No spatial match";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-tight">
          Rainfall / Climate
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
            <MapPin className="w-3 h-3" />
            {isDistrict ? "District aggregate" : "Fallback station"}
          </div>
          <div className="font-bold text-sm">{rainfall.station ?? "UNKNOWN"}</div>
          <div className="text-[10px] font-mono text-black/60">{locationLine}</div>
        </div>
        <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
            <CloudRain className="w-3 h-3" />
            {isDistrict ? "Annual aggregate" : "Fallback annual seed"}
          </div>
          <div
            className="font-extrabold text-lg"
            style={{ color: "var(--accent-purple)" }}
          >
            {rainfall.annualRainfallMm != null
              ? `${rainfall.annualRainfallMm} mm`
              : "—"}
          </div>
          <div className="text-[10px] font-mono text-black/60">
            Monsoon: {rainfall.monsoonRainfallMm ?? "—"} mm
          </div>
        </div>
      </div>

      {climate?.data.current && (
        <div className="border-[2px] border-black p-2 bg-[var(--paper)] mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60">
              Modelled conditions now
            </div>
            <span className="text-[9px] font-mono border border-black px-1">
              {climate.cacheStatus}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              <strong>{climate.data.current.temperatureC ?? "—"}°C</strong>
              <span className="text-[10px] text-black/60">
                {climate.data.current.weatherDescription}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              <strong>{climate.data.current.relativeHumidityPercent ?? "—"}%</strong> RH
            </div>
            <div>
              Precipitation: {climate.data.current.precipitationMm ?? "—"} mm
            </div>
            <div>ET₀: {climate.data.current.referenceEt0Mm ?? "—"} mm</div>
            <div className="col-span-2">
              Soil moisture (3–9 cm):{" "}
              {climate.data.current.soilMoistureM3M3.depth3To9cm ?? "—"} m³/m³
            </div>
          </div>
        </div>
      )}

      {climate && (
        <div className="border-[2px] border-black p-2 bg-[var(--paper)] mb-3">
          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60 mb-2">
            <Sun className="w-3 h-3" /> Seven-day forecast
          </div>
          <div className="grid grid-cols-4 gap-1 text-center">
            {climate.data.daily.slice(0, 4).map((day) => (
              <div key={day.date} className="border border-black p-1">
                <div className="text-[8px] font-mono">{day.date.slice(5)}</div>
                <div className="font-extrabold text-xs">
                  {day.temperatureMinC ?? "—"}–{day.temperatureMaxC ?? "—"}°
                </div>
                <div className="text-[9px]">{day.precipitationMm ?? "—"} mm</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] font-mono">
            7-day P−ET₀:{" "}
            <strong>
              {climate.data.sevenDayWaterBalanceMm.precipitationMinusEt0} mm
            </strong>
          </div>
        </div>
      )}

      {rainfall.timeseries.length > 0 && (
        <div className="border-[2px] border-black p-2 bg-[var(--paper)]">
          <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60 mb-1">
            Representative fallback series (mm)
          </div>
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <LineChart
                data={rainfall.timeseries}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
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
                {rainfall.annualRainfallMm !== null && (
                  <ReferenceLine
                    y={rainfall.annualRainfallMm}
                    stroke="#ff3b3b"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="annual"
                  stroke="#000"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--accent-purple)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
        <strong>Dataset:</strong> {rainfall.provenance.source}
        {climate && (
          <>
            <br />
            <strong>Live model:</strong> {climate.data.attribution.label} · fetched{" "}
            {new Date(climate.retrievedAt).toLocaleString()}
            {reusedAt && <> · reused for scenario {new Date(reusedAt).toLocaleString()}</>}
          </>
        )}
      </div>
    </motion.section>
  );
}
