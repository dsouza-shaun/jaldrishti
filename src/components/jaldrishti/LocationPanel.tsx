"use client";

import { motion } from "framer-motion";
import { MapPin, Hash, Building2 } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { EvidenceBadge } from "./GroundwaterPanel";

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

export function LocationPanel() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;
  const location = analysis.siteData.location as unknown as LocationResult | null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">
            Resolved Location
          </h3>
        </div>
        <EvidenceBadge status={location ? "PROXY" : "UNKNOWN"} />
      </div>

      {location ? (
        <>
          <div className="border-[2px] border-black p-2 bg-[var(--paper)] mb-2">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-black/60">
              Locality
            </div>
            <div className="font-bold text-sm break-words">
              {location.data.village ??
                location.data.town ??
                location.data.city ??
                location.data.displayName}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Info
              icon={<Building2 className="w-3 h-3" />}
              label="District"
              value={location.data.district ?? "UNKNOWN"}
            />
            <Info
              icon={<MapPin className="w-3 h-3" />}
              label="State"
              value={location.data.state ?? "UNKNOWN"}
            />
            <Info
              icon={<Hash className="w-3 h-3" />}
              label="Locality pincode"
              value={location.data.pincode ?? "Not supplied"}
            />
            <Info
              icon={<MapPin className="w-3 h-3" />}
              label="Cache"
              value={location.cacheStatus}
            />
          </div>
          <div className="mt-2 text-[10px] font-mono text-black/70 border-t-[2px] border-dashed border-black pt-2">
            {location.data.attribution.label} · fetched{" "}
            {new Date(location.retrievedAt).toLocaleString()}
          </div>
        </>
      ) : (
        <div className="border-[2px] border-black p-3 text-xs font-mono">
          Reverse geocoding was unavailable. District CSV matching was skipped
          and only explicitly labelled fallback data may be present.
        </div>
      )}
    </motion.section>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-[2px] border-black p-2 bg-[var(--paper)] min-w-0">
      <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-black/60">
        {icon}
        {label}
      </div>
      <div className="font-bold text-xs sm:text-sm break-words">{value}</div>
    </div>
  );
}
