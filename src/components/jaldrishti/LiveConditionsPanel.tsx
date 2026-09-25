"use client";

import { useEffect, useState } from "react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Cloud, Droplets, Wind } from "lucide-react";

interface LiveSnapshot {
  climate?: { data?: { current?: { temperatureC?: number | null; weatherDescription?: string | null } | null } } | null;
  airQuality?: { data?: { current?: { usAqi?: number | null; usAqiLabel?: string | null } | null } } | null;
  flood?: { data?: { latest?: { dischargeCubicMetresPerSecond?: number | null } | null } } | null;
}

function reading(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? "Unavailable" : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
}

export function LiveConditionsPanel() {
  const { analysis } = useJalDrishti();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!analysis) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ lat: String(analysis.site.latitude), lng: String(analysis.site.longitude) });
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
  const fallbackClimate = analysis.siteData.climate as { data?: { current?: { temperatureC?: number | null; weatherDescription?: string | null } | null } } | null;
  const current = snapshot?.climate?.data?.current ?? fallbackClimate?.data?.current;
  const aqi = snapshot?.airQuality?.data?.current;
  const river = snapshot?.flood?.data?.latest?.dischargeCubicMetresPerSecond;
  const annualRain = (analysis.rainfall as { annualRainfallMm?: number | null }).annualRainfallMm;

  return (
    <section className="nb-card p-4" aria-labelledby="conditions-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="conditions-title" className="text-base font-extrabold">Local conditions</h2>
        <span className="text-xs text-black/60">{loading ? "Updating…" : "Latest available"}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Condition icon={<Cloud className="h-4 w-4" />} label="Weather" value={current?.temperatureC == null ? "Unavailable" : `${reading(current.temperatureC, "°C")} · ${current.weatherDescription ?? ""}`} />
        <Condition icon={<Wind className="h-4 w-4" />} label="Air quality" value={aqi?.usAqi == null ? "Unavailable" : `${aqi.usAqiLabel ?? "Air quality index"} (${aqi.usAqi})`} />
        <Condition icon={<Droplets className="h-4 w-4" />} label={river == null ? "Annual rainfall baseline" : "Nearby river flow"} value={river == null ? reading(annualRain, " mm/year") : reading(river, " m³/s")} />
      </div>
      <p className="mt-3 text-xs text-black/60">Weather, air and river-flow values are regional model estimates, not readings from sensors at the site.</p>
    </section>
  );
}

function Condition({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-2 border-black bg-[var(--paper)] p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-black/65">{label}</div>
        <div className="text-base font-bold leading-snug">{value}</div>
      </div>
    </div>
  );
}
