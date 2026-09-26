"use client";

import { motion } from "framer-motion";
import {
  Droplets,
  Mountain,
  Waves,
  Gauge,
  TriangleAlert,
} from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { EvidenceBadge } from "./GroundwaterPanel";

/**
 * Live water-risk panel: WRI Aqueduct 4.0 (sector-weighted), India district
 * water quality and scarcity, and site elevation.
 *
 * Aqueduct's sector weighting is the reason this card exists. Its generic
 * "water stress" figure is averaged across every industry; its Semiconductor
 * weighting is not, and that is the number a data-centre screen should quote.
 * Both are shown, with the sector figure given visual priority, so the generic
 * number is never mistaken for the relevant one.
 */

interface AqueductScore {
  code: string;
  label: string;
  score: number | null;
  category: number | null;
  categoryLabel: string | null;
  weightFraction: number | null;
}

interface AqueductIndicator {
  code: string;
  label: string;
  group: "availability" | "environment";
  score: number | null;
  category: number | null;
  categoryLabel: string | null;
}

interface WaterRiskShape {
  aqueduct: {
    available: boolean;
    country: string | null;
    region: string | null;
    indicators: AqueductIndicator[];
    sectors: (AqueductScore & { code: string; label: string; primary: boolean; overall: AqueductScore; dimensions: AqueductScore[] })[];
    provenance: { source: string; sourceDate: string; evidenceStatus: string; caveat?: string };
  } | null;
  district: {
    available: boolean;
    district: string | null;
    state: string | null;
    groundwater: {
      totalAssessmentUnits: number | null;
      safe: number | null;
      semiCritical: number | null;
      critical: number | null;
      overExploited: number | null;
      saline: number | null;
      criticalOrOverExploitedPct: number | null;
    } | null;
    surfaceWater: {
      extent1999M2: number | null;
      extent2020M2: number | null;
      extentChangeFraction: number | null;
    } | null;
    rainfallVariability2021: number | null;
    aquifer: { class: string | null; consolidatedPct: number | null; unconsolidatedPct: number | null } | null;
    quality2018: {
      chlorideMgL: number | null;
      nitrateMgL: number | null;
      fluorideMgL: number | null;
      tdsMgL: number | null;
      electricalConductivity: number | null;
    } | null;
    provenance: { source: string; sourceDate: string; evidenceStatus: string; caveat?: string };
  } | null;
  elevation: {
    available: boolean;
    elevationM: number | null;
    neighbourhood: { minM: number; maxM: number; reliefM: number } | null;
    resolutionMPerPixel: number | null;
    provenance: { source: string; sourceDate: string; evidenceStatus: string; caveat?: string };
  } | null;
}

/** Aqueduct scores run 0-5. Map them to the app's existing risk palette. */
function riskColor(score: number | null): string {
  if (score === null) return "var(--status-unknown)";
  if (score >= 4) return "var(--accent-red)";
  if (score >= 3) return "var(--accent-orange)";
  if (score >= 2) return "var(--accent-yellow)";
  if (score >= 1) return "var(--status-conditional)";
  return "var(--status-feasible)";
}

function km2(squareMetres: number | null): string {
  if (squareMetres === null) return "—";
  return `${Math.round(squareMetres / 1_000_000).toLocaleString("en-IN")} km²`;
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-black/25 py-1 last:border-b-0">
      <span className="text-[11px] text-black/70">{label}</span>
      <span className="text-xs font-extrabold text-right" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function Section({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-[2px] border-black bg-[var(--paper)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-tight">
          {icon}
          {title}
        </div>
        {badge}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function WaterRiskPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const waterRisk = analysis.siteData.waterRisk as unknown as WaterRiskShape | null;
  if (!waterRisk) return null;

  const { aqueduct, district, elevation } = waterRisk;
  const semiconductors = aqueduct?.sectors.find((s) => s.code === "smc") ?? null;
  const electricPower = aqueduct?.sectors.find((s) => s.code === "elp") ?? null;
  const availability = aqueduct?.indicators.filter((i) => i.group === "availability") ?? [];
  const environment = aqueduct?.indicators.filter((i) => i.group === "environment") ?? [];

  if (!aqueduct?.available && !district?.available && !elevation?.available) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="nb-card p-4"
      >
        <div className="flex items-center gap-2 border-b-[2px] border-black pb-2">
          <Droplets className="h-4 w-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">Live Water Risk</h3>
        </div>
        <p className="mt-2 text-xs text-black/70">
          No live water-risk source responded for this site. Nothing is being
          inferred in their absence.
        </p>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4 h-full flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 border-b-[2px] border-black pb-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
          <Droplets className="h-4 w-4" /> Live water risk
        </h3>
        <span className="text-[10px] font-mono text-black/60">live services</span>
      </div>

      <div className="mt-3 flex-1 space-y-3">
        {/* Aqueduct sector weighting — the headline for a data-centre screen. */}
        {aqueduct?.available && (semiconductors || electricPower) && (
          <Section
            icon={<Gauge className="h-4 w-4" />}
            title="WRI Aqueduct 4.0"
            badge={<EvidenceBadge status={aqueduct.provenance.evidenceStatus} />}
          >
            <p className="mb-2 text-[10px] leading-snug text-black/60">
              Aqueduct weights water risk per industry. A data centre is scored
              under <strong>Semiconductor</strong> and <strong>Electric
              power</strong> below, not under the all-sector average.
            </p>
            {[semiconductors, electricPower].filter(Boolean).map((sector) => (
              <div
                key={sector!.code}
                className="mb-2 border-2 border-black bg-[var(--paper)] p-2 last:mb-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase">
                    {sector!.label}
                  </span>
                  <span
                    className="text-sm font-extrabold"
                    style={{ color: riskColor(sector!.overall.score) }}
                  >
                    {sector!.overall.categoryLabel ?? "—"}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] font-mono text-black/60">
                  score {sector!.overall.score?.toFixed(2) ?? "—"} of 5
                </div>
                <div className="mt-1.5 space-y-0">
                  {sector!.dimensions.map((dimension) => (
                    <Row
                      key={dimension.code}
                      label={dimension.label}
                      value={dimension.categoryLabel ?? "—"}
                      color={riskColor(dimension.score)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-1 text-[10px] font-mono text-black/55">
              {aqueduct.region ? `${aqueduct.region}, ${aqueduct.country}` : "—"}
              {" · "}
              {aqueduct.provenance.sourceDate}
            </div>
          </Section>
        )}

        {/* Aqueduct's general indicators, which are not sector-weighted. */}
        {aqueduct?.available && (
          <Section
            icon={<Waves className="h-4 w-4" />}
            title="Basin indicators"
            badge={<EvidenceBadge status={aqueduct.provenance.evidenceStatus} />}
          >
            <p className="mb-1 text-[10px] leading-snug text-black/60">
              Unweighted, all-sector measures for the surrounding basin.
            </p>
            {availability.map((indicator) => (
              <Row
                key={indicator.code}
                label={indicator.label}
                value={indicator.categoryLabel ?? "—"}
                color={riskColor(indicator.score)}
              />
            ))}
            {environment.map((indicator) => (
              <Row
                key={indicator.code}
                label={indicator.label}
                value={indicator.categoryLabel ?? "—"}
                color={riskColor(indicator.score)}
              />
            ))}
          </Section>
        )}

        {/* India-native district aggregates. */}
        {district?.available && (
          <Section
            icon={<TriangleAlert className="h-4 w-4" />}
            title={`District water context${
              district.district ? ` · ${district.district}` : ""
            }`}
            badge={<EvidenceBadge status={district.provenance.evidenceStatus} />}
          >
            {district.groundwater && (
              <>
                <Row
                  label="Assessment units Critical or Over-exploited"
                  value={
                    district.groundwater.criticalOrOverExploitedPct !== null
                      ? `${district.groundwater.criticalOrOverExploitedPct}%`
                      : "—"
                  }
                  color={riskColor(
                    district.groundwater.criticalOrOverExploitedPct === null
                      ? null
                      : district.groundwater.criticalOrOverExploitedPct > 50
                        ? 4
                        : district.groundwater.criticalOrOverExploitedPct > 20
                          ? 3
                          : 1,
                  )}
                />
                <Row
                  label="Over-exploited / total units"
                  value={`${district.groundwater.overExploited ?? "—"} / ${
                    district.groundwater.totalAssessmentUnits ?? "—"
                  }`}
                />
                <Row
                  label="Safe / semi-critical / critical / saline"
                  value={`${district.groundwater.safe ?? "—"} / ${
                    district.groundwater.semiCritical ?? "—"
                  } / ${district.groundwater.critical ?? "—"} / ${
                    district.groundwater.saline ?? "—"
                  }`}
                />
              </>
            )}
            {district.surfaceWater && (
              <>
                <Row label="Surface water extent 1999" value={km2(district.surfaceWater.extent1999M2)} />
                <Row label="Surface water extent 2020" value={km2(district.surfaceWater.extent2020M2)} />
                <Row
                  label="Change in surface water extent"
                  value={
                    district.surfaceWater.extentChangeFraction !== null
                      ? `${district.surfaceWater.extentChangeFraction > 0 ? "+" : ""}${(
                          district.surfaceWater.extentChangeFraction * 100
                        ).toFixed(1)}%`
                      : "—"
                  }
                  color={
                    district.surfaceWater.extentChangeFraction === null
                      ? undefined
                      : district.surfaceWater.extentChangeFraction < -0.1
                        ? riskColor(4)
                        : undefined
                  }
                />
              </>
            )}
            {district.aquifer && (
              <Row
                label="Aquifer formation"
                value={
                  district.aquifer.class
                    ? `${district.aquifer.class} (${Math.round(
                        district.aquifer.consolidatedPct ?? 0,
                      )}% consolidated)`
                    : "—"
                }
              />
            )}
            {district.rainfallVariability2021 !== null && (
              <Row
                label="Monsoon rainfall variability 2021"
                value={district.rainfallVariability2021.toFixed(2)}
              />
            )}
            {district.quality2018 && (
              <>
                <Row
                  label="TDS 2018"
                  value={district.quality2018.tdsMgL !== null ? `${district.quality2018.tdsMgL} mg/L` : "—"}
                />
                <Row
                  label="Chloride 2018"
                  value={
                    district.quality2018.chlorideMgL !== null
                      ? `${district.quality2018.chlorideMgL} mg/L`
                      : "—"
                  }
                />
                <Row
                  label="Fluoride 2018"
                  value={
                    district.quality2018.fluorideMgL !== null
                      ? `${district.quality2018.fluorideMgL} mg/L`
                      : "—"
                  }
                />
              </>
            )}
            <p className="mt-2 text-[10px] leading-snug text-black/55">
              {district.provenance.caveat}
            </p>
          </Section>
        )}

        {/* Terrain. */}
        {elevation?.available && elevation.elevationM !== null && (
          <Section
            icon={<Mountain className="h-4 w-4" />}
            title="Site terrain"
            badge={<EvidenceBadge status={elevation.provenance.evidenceStatus} />}
          >
            <Row label="Elevation" value={`${elevation.elevationM} m`} />
            {elevation.neighbourhood && (
              <>
                <Row
                  label="Elevation range within ~200 m"
                  value={`${elevation.neighbourhood.minM}–${elevation.neighbourhood.maxM} m`}
                />
                <Row
                  label="Local relief"
                  value={`${elevation.neighbourhood.reliefM} m`}
                  color={
                    elevation.neighbourhood.reliefM > 25
                      ? riskColor(3)
                      : undefined
                  }
                />
              </>
            )}
            {elevation.resolutionMPerPixel !== null && (
              <Row
                label="Sample resolution"
                value={`${elevation.resolutionMPerPixel} m/px`}
              />
            )}
            <p className="mt-2 text-[10px] leading-snug text-black/55">
              {elevation.provenance.caveat}
            </p>
          </Section>
        )}
      </div>
    </motion.section>
  );
}
