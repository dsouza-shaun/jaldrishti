"use client";

import { useEffect, useState } from "react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable } from "@/components/jaldrishti/Document";

interface LiveSnapshot {
  climate?: { data?: { current?: { temperatureC?: number | null; weatherDescription?: string | null } | null } } | null;
  airQuality?: { data?: { current?: { usAqi?: number | null; usAqiLabel?: string | null } | null } } | null;
  flood?: { data?: { latest?: { dischargeCubicMetresPerSecond?: number | null } | null } } | null;
}

function reading(value: number | null | undefined, unit: string) {
  return value === null || value === undefined
    ? "Unavailable"
    : `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}${unit}`;
}

/**
 * Local conditions as three rows of a table.
 *
 * These are supporting context, not findings, so they are deliberately quiet:
 * no cards, no colour, and a note that states plainly that none of this is
 * measured at the site.
 */
export function LiveConditionsPanel() {
  const { analysis } = useJalDrishti();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!analysis) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(analysis.site.latitude),
      lng: String(analysis.site.longitude),
    });
    fetch(`/api/environment?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Conditions unavailable");
        return response.json() as Promise<LiveSnapshot>;
      })
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [analysis]);

  if (!analysis) return null;

  const fallbackClimate = analysis.siteData.climate as {
    data?: { current?: { temperatureC?: number | null; weatherDescription?: string | null } | null };
  } | null;
  const current = snapshot?.climate?.data?.current ?? fallbackClimate?.data?.current;
  const aqi = snapshot?.airQuality?.data?.current;
  const river = snapshot?.flood?.data?.latest?.dischargeCubicMetresPerSecond;
  const annualRain = (analysis.rainfall as { annualRainfallMm?: number | null }).annualRainfallMm;

  const rows = [
    {
      measure: "Weather",
      value:
        current?.temperatureC == null
          ? "Unavailable"
          : `${reading(current.temperatureC, " degC")}${current.weatherDescription ? `, ${current.weatherDescription}` : ""}`,
    },
    {
      measure: "Air quality",
      value: aqi?.usAqi == null ? "Unavailable" : `${aqi.usAqiLabel ?? "US AQI"} (${aqi.usAqi})`,
    },
    {
      measure: river == null ? "Annual rainfall baseline" : "Nearby river flow",
      value: river == null ? reading(annualRain, " mm/year") : reading(river, " m3/s"),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Local conditions</h3>
        <span className="text-xs text-[var(--nb-muted)]">
          {loading ? "Updating" : "Latest available"}
        </span>
      </div>
      <DataTable
        columns={[
          { key: "measure", header: "Measure", render: (row) => <span className="text-sm">{row.measure}</span> },
          { key: "value", header: "Reading", render: (row) => <span className="text-sm font-semibold">{row.value}</span> },
        ]}
        rows={rows}
      />
      <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
        Weather, air and river-flow values are regional model estimates, not readings
        from instruments at the site.
      </p>
    </div>
  );
}
