"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable, StatusChip, evidenceTone } from "@/components/jaldrishti/Document";

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

/**
 * Nearby power generation, as context for the site rather than as a screening
 * finding. A nearby plant does not demonstrate grid capacity or connection
 * feasibility, and the note says so.
 */
export function PowerPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const power = analysis.power as {
    timeline: string;
    substation: string | null;
    nearbyPowerPlants: NearbyPlant[];
    provenance: { source: string; sourceDate: string; evidenceStatus: string; caveat?: string };
  };

  return (
    <div className="space-y-2">
      <DataTable
        columns={[
          { key: "name", header: "Plant", render: (plant) => <span className="text-sm font-semibold break-words">{plant.name}</span> },
          {
            key: "capacity",
            header: "Capacity",
            align: "right",
            render: (plant) => (
              <span className="text-sm font-mono">
                {plant.capacityMw != null ? `${plant.capacityMw.toLocaleString("en-IN")} MW` : "Not available"}
              </span>
            ),
          },
          {
            key: "fuel",
            header: "Primary fuel",
            render: (plant) => <span className="text-sm">{plant.primaryFuel ?? "Not recorded"}</span>,
          },
          {
            key: "year",
            header: "Data year",
            align: "right",
            render: (plant) => <span className="text-sm font-mono">{plant.capacityDataYear ?? "-"}</span>,
          },
          {
            key: "distance",
            header: "Distance",
            align: "right",
            render: (plant) => <span className="text-sm font-mono">{plant.distanceKm.toFixed(1)} km</span>,
          },
        ]}
        rows={power.nearbyPowerPlants}
        rowKey={(plant) => plant.id}
        empty="No coordinate-bearing plant record is available for this site."
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--nb-muted)]">
        <StatusChip tone={evidenceTone(power.provenance.evidenceStatus)}>
          {power.provenance.evidenceStatus === "VERIFIED"
            ? "Sourced"
            : power.provenance.evidenceStatus === "PROXY"
              ? "Modelled"
              : "Limited"}
        </StatusChip>
        <span>
          {power.provenance.source}, {power.provenance.sourceDate}. Nearby plants do not
          demonstrate grid capacity or connection feasibility.
        </span>
      </div>
    </div>
  );
}
