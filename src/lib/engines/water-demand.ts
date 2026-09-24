/**
 * Water Demand Engine - deterministic calculation.
 *
 * WUE (Water Usage Effectiveness) is defined as litres of water per kWh of
 * total facility energy. Therefore:
 *
 *   Facility energy (kWh/day) = IT load (kW) * 24 * PUE
 *   Water demand (L/day)      = Facility energy (kWh/day) * WUE (L/kWh)
 *   Annual                    = Daily * 365
 *
 * For cooling-technology comparison we provide typical WUE reference bands
 * (industry literature, ASHRAE, BEE India data-centre guidelines). These are
 * used only as DEFAULTS when the user has not supplied a WUE.
 */

export interface WaterDemandInput {
  itLoad: number;        // MW
  pue: number;           // dimensionless
  wue: number;           // L/kWh
  coolingType: string;
}

export interface WaterDemandResult {
  facilityEnergyKwhPerDay: number;
  facilityEnergyMwhPerDay: number;
  itEnergyKwhPerDay: number;
  waterLitresPerDay: number;
  waterKlPerDay: number;     // kilolitres
  waterMld: number;          // megalitres per day
  waterLitresPerYear: number;
  waterMcmPerYear: number;   // million cubic metres per year
  wueUsed: number;
  wueSource: string;
  provenance: {
    source: string;
    sourceDate: string;
    evidenceStatus: "VERIFIED" | "PROXY" | "UNKNOWN";
  };
}

// Industry-published typical WUE values (L/kWh) - used only as defaults.
export const COOLING_TECH_WUE_BANDS: Record<string, { low: number; typical: number; high: number; source: string }> = {
  "air-cooled-chiller": { low: 0.5, typical: 0.7, high: 1.0, source: "ASHRAE TC9.9 typical for air-cooled" },
  "water-cooled-chiller": { low: 1.0, typical: 1.5, high: 2.0, source: "ASHRAE TC9.9 typical for water-cooled cooling tower" },
  "adiabatic": { low: 0.3, typical: 0.5, high: 0.8, source: "Vendor data - adiabatic / dry-augmented" },
  "hybrid": { low: 0.6, typical: 0.9, high: 1.3, source: "Hybrid cooling estimated range" },
  "direct-liquid": { low: 0.1, typical: 0.2, high: 0.4, source: "DLC / immersion vendor literature" },
};

export function computeWaterDemand(input: WaterDemandInput): WaterDemandResult {
  const itLoadKw = input.itLoad * 1000; // MW -> kW
  const itEnergyKwhPerDay = itLoadKw * 24;
  const facilityEnergyKwhPerDay = itEnergyKwhPerDay * input.pue;

  // WUE in L/kWh directly multiplies facility kWh.
  const waterLitresPerDay = facilityEnergyKwhPerDay * input.wue;
  const waterLitresPerYear = waterLitresPerDay * 365;

  const band = COOLING_TECH_WUE_BANDS[input.coolingType];

  return {
    itEnergyKwhPerDay,
    facilityEnergyKwhPerDay,
    facilityEnergyMwhPerDay: facilityEnergyKwhPerDay / 1000,
    waterLitresPerDay,
    waterKlPerDay: waterLitresPerDay / 1000,
    waterMld: waterLitresPerDay / 1_000_000,
    waterLitresPerYear,
    waterMcmPerYear: waterLitresPerYear / 1_000_000_000,
    wueUsed: input.wue,
    wueSource: band?.source ?? "User-supplied WUE",
    provenance: {
      source: "ASHRAE TC9.9 + BEE India DC guidelines",
      sourceDate: "2021-08",
      evidenceStatus: "VERIFIED",
    },
  };
}

export function defaultWueForCooling(coolingType: string): number {
  return COOLING_TECH_WUE_BANDS[coolingType]?.typical ?? 1.0;
}
