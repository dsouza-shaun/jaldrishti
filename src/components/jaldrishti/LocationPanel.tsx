"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { DataTable } from "@/components/jaldrishti/Document";

interface LocationResult {
  provider: string;
  retrievedAt: string;
  cacheStatus: "MISS" | "HIT" | "STALE";
  data: {
    displayName: string;
    village: string | null;
    town: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pincode: string | null;
    attribution: { label: string; licenseUrl: string; usagePolicyUrl: string };
  };
}

/**
 * Resolved location. Deliberately low weight: the coordinates and the
 * attribution string are provenance, not a finding, so they sit in a quiet
 * table at the end of the site section rather than in their own card.
 */
export function LocationPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const location = analysis.siteData.location as unknown as LocationResult | null;

  if (!location) {
    return (
      <p className="text-sm text-[var(--nb-muted)]">
        Reverse geocoding was unavailable. District dataset matching was skipped and only
        explicitly labelled fallback data may be present.
      </p>
    );
  }

  const rows = [
    { field: "Locality", value: location.data.village ?? location.data.town ?? location.data.city ?? location.data.displayName },
    { field: "District", value: location.data.district ?? "Not available" },
    { field: "State", value: location.data.state ?? "Not available" },
    { field: "Pincode", value: location.data.pincode ?? "Not supplied" },
  ];

  return (
    <div className="space-y-2">
      <DataTable
        columns={[
          { key: "field", header: "Field", render: (row) => <span className="text-sm font-semibold">{row.field}</span> },
          { key: "value", header: "Value", render: (row) => <span className="text-sm">{row.value}</span> },
        ]}
        rows={rows}
      />
      <p className="text-xs text-[var(--nb-muted)]">
        {location.data.attribution.label}, resolved{" "}
        {new Date(location.retrievedAt).toLocaleString("en-IN")}.
      </p>
    </div>
  );
}
