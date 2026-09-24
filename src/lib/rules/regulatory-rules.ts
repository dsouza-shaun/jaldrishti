/**
 * JalDrishti regulatory rule set
 * --------------------------------------------------------------
 * These rules are deliberately kept OUT of the application code so that
 * every decision is auditable and can be traced back to a written rule.
 *
 * Every rule has:
 *   - ruleCode      : stable identifier used in evidence trails
 *   - domain        : cgwa | ec | esz | forest | wetland | crz | spcb
 *   - title         : human-readable title
 *   - description   : plain-language summary
 *   - source        : cited regulation / document
 *   - sourceDate    : publication / amendment date
 *   - evidenceStatus: VERIFIED (we have the source) | PROXY (derived) | UNKNOWN
 *   - evaluate(...) : a pure function that takes a typed input and returns
 *                     { outcome, reasons, hardConstraint }
 *
 * IMPORTANT: The rule bodies encode the actual regulatory logic.
 * Numbers below come from publicly available Indian regulations:
 *   - CGWA NOC guidelines (2020 amendment) - categorise blocks and restrict
 *     extraction in Over-Exploited / Critical / Semi-Critical areas.
 *   - EIA Notification 2006 (and subsequent amendments) - Category 8(b)
 *     "Townships and Area Development projects" >= 150,000 sq.m built-up
 *     attract Environmental Clearance.
 *   - Wetlands (Conservation and Management) Rules 2017.
 *   - CRZ Notification 2018.
 *   - ESZ notifications issued under Environment (Protection) Act 1986.
 *
 * Where a buffer / threshold is not in the source, the rule reports
 * "regulatory buffer not configured" rather than inventing one.
 */

export type EvidenceStatus = "VERIFIED" | "PROXY" | "UNKNOWN";

export interface Provenance {
  source: string;
  sourceDate: string;
  fetchedAt?: string;
  evidenceStatus: EvidenceStatus;
}

export interface RuleOutcome {
  outcome: string;
  reasons: string[];
  hardConstraint: boolean;
  provenance: Provenance;
}

// ---- CGWA groundwater / NOC rule ----------------------------------------------

export interface CgwaInput {
  groundwaterCategory: "Safe" | "Semi-Critical" | "Critical" | "Over-Exploited" | "Saline" | "UNKNOWN";
  proposedWaterSource: string;
  alternativeWaterSource?: string | null;
  itLoad: number; // MW
}

export function evaluateCgwaRule(input: CgwaInput): RuleOutcome {
  const provenance: Provenance = {
    source: "CGWA NOC Guidelines for Groundwater Extraction (revised 2020)",
    sourceDate: "2020-09-24",
    evidenceStatus: "VERIFIED",
  };

  if (input.groundwaterCategory === "UNKNOWN") {
    return {
      outcome: "DATA INSUFFICIENT",
      reasons: [
        "Groundwater block category not available from CGWB.",
        "CGWA NOC eligibility cannot be determined without block classification.",
      ],
      hardConstraint: false,
      provenance,
    };
  }

  const usingGroundwater =
    input.proposedWaterSource.toLowerCase().includes("ground") ||
    input.proposedWaterSource.toLowerCase() === "borewell";

  if (input.groundwaterCategory === "Over-Exploited" && usingGroundwater) {
    if (!input.alternativeWaterSource) {
      return {
        outcome: "HIGH REGULATORY CONSTRAINT",
        reasons: [
          `Block is classified ${input.groundwaterCategory} by CGWB.`,
          "Proposed primary source is groundwater.",
          "No alternative water source has been identified.",
          "CGWA guidelines restrict new groundwater extraction in Over-Exploited blocks without a viable alternative.",
        ],
        hardConstraint: true,
        provenance,
      };
    }
    return {
      outcome: "FEASIBLE WITH CONDITIONS",
      reasons: [
        `Block is classified ${input.groundwaterCategory} by CGWB.`,
        "CGWA NOC for groundwater extraction in Over-Exploited blocks requires firm commitment to alternative source.",
        `Alternative source declared: ${input.alternativeWaterSource}.`,
      ],
      hardConstraint: false,
      provenance,
    };
  }

  if (input.groundwaterCategory === "Critical" && usingGroundwater) {
    return {
      outcome: "FEASIBLE WITH CONDITIONS",
      reasons: [
        `Block is classified ${input.groundwaterCategory}.`,
        "CGWA NOC in Critical blocks requires rainwater harvesting and artificial recharge measures.",
      ],
      hardConstraint: false,
      provenance,
    };
  }

  if (input.groundwaterCategory === "Semi-Critical" && usingGroundwater) {
    return {
      outcome: "FEASIBLE WITH CONDITIONS",
      reasons: [
        `Block is classified ${input.groundwaterCategory}.`,
        "CGWA recommends mandatory rainwater harvesting in Semi-Critical blocks.",
      ],
      hardConstraint: false,
      provenance,
    };
  }

  if (input.groundwaterCategory === "Saline" && usingGroundwater) {
    return {
      outcome: "HIGH REGULATORY CONSTRAINT",
      reasons: [
        "Block is classified Saline.",
        "Groundwater extraction likely to draw saline water; not recommended for cooling use without TDS treatment.",
      ],
      hardConstraint: true,
      provenance,
    };
  }

  return {
    outcome: "FEASIBLE",
    reasons: [
      `Block is classified ${input.groundwaterCategory}.`,
      "No CGWA NOC constraint triggered for the declared water source.",
    ],
    hardConstraint: false,
    provenance,
  };
}

// ---- Environmental Clearance applicability rule -------------------------------

export interface EcInput {
  builtUpArea?: number; // m^2
  itLoad: number;
}

export function evaluateEcRule(input: EcInput): RuleOutcome {
  const provenance: Provenance = {
    source: "EIA Notification 2006, Schedule Item 8(b) - Townships & Area Development",
    sourceDate: "2006-09-14 (last major amendment 2022)",
    evidenceStatus: "VERIFIED",
  };

  if (input.builtUpArea == null) {
    return {
      outcome: "DATA INSUFFICIENT",
      reasons: [
        "Built-up area not provided.",
        "EC threshold check under EIA 2006 Schedule 8(b) cannot be evaluated.",
      ],
      hardConstraint: false,
      provenance,
    };
  }

  // 150,000 sq.m built-up area is the documented 8(b) threshold.
  const THRESHOLD_M2 = 150_000;

  if (input.builtUpArea >= THRESHOLD_M2) {
    return {
      outcome: "EC APPLICABLE",
      reasons: [
        `Built-up area = ${input.builtUpArea.toLocaleString()} m².`,
        `Threshold under EIA 2006 Schedule 8(b) = ${THRESHOLD_M2.toLocaleString()} m².`,
        "Project requires prior Environmental Clearance from SEIAA / EAC.",
      ],
      hardConstraint: false, // EC is a process requirement, not a site prohibition
      provenance,
    };
  }

  return {
    outcome: "NOT TRIGGERED",
    reasons: [
      `Built-up area = ${input.builtUpArea.toLocaleString()} m².`,
      `Below EIA 2006 Schedule 8(b) threshold of ${THRESHOLD_M2.toLocaleString()} m².`,
      "Category B EC not triggered on built-up area basis (other Category-A triggers may still apply - confirm with SEIAA).",
    ],
    hardConstraint: false,
    provenance,
  };
}

// ---- Ecological constraint rules ----------------------------------------------

export interface EcologicalInput {
  layer: "esz" | "forest" | "wetland" | "crz";
  overlap: boolean;
  nearestDistanceKm: number; // distance to nearest polygon edge, 0 if overlapping
  polygonName?: string;
}

export function evaluateEcologicalRule(input: EcologicalInput): RuleOutcome {
  const layerMap = {
    esz: {
      source: "ESZ Notification under Environment (Protection) Act 1986",
      sourceDate: "varies by state (per sanctuary notification)",
      restriction: "Industrial activities within ESZ are restricted to a permitted list; data centres are not on the permitted list.",
    },
    forest: {
      source: "Forest (Conservation) Act 1980",
      sourceDate: "1980-10-25 (amended 2023)",
      restriction: "Diversion of forest land for non-forest use requires prior approval under FC Act.",
    },
    wetland: {
      source: "Wetlands (Conservation and Management) Rules 2017",
      sourceDate: "2017-10-08",
      restriction: "Certain activities are prohibited within notified wetlands; encroachment requires clearance.",
    },
    crz: {
      source: "Coastal Regulation Zone Notification 2018",
      sourceDate: "2018-01-18",
      restriction: "CRZ-I / CRZ-IV areas prohibit construction; CRZ-II/III are regulated.",
    },
  } as const;

  const cfg = layerMap[input.layer];
  const provenance: Provenance = {
    source: cfg.source,
    sourceDate: cfg.sourceDate,
    evidenceStatus: "VERIFIED",
  };

  if (input.overlap) {
    return {
      outcome: `${input.layer.toUpperCase()} OVERLAP DETECTED`,
      reasons: [
        `Proposed site intersects a notified ${input.layer.toUpperCase()} polygon${input.polygonName ? ` (${input.polygonName})` : ""}.`,
        cfg.restriction,
      ],
      // ESZ/forest/wetland/CRZ overlaps are treated as hard constraints
      // (project must either re-site or pursue clearance - cannot be ignored).
      hardConstraint: true,
      provenance,
    };
  }

  // No overlap - we report proximity information but DO NOT invent buffers.
  // Buffer distances must come from the specific notification; the rule does
  // not assume a default.
  return {
    outcome: "NO OVERLAP",
    reasons: [
      `No ${input.layer.toUpperCase()} polygon overlap at the proposed site.`,
      input.nearestDistanceKm > 0
        ? `Nearest ${input.layer.toUpperCase()} boundary is ${input.nearestDistanceKm.toFixed(2)} km away.`
        : `No ${input.layer.toUpperCase()} polygons found within the configured study area.`,
      "Regulatory buffer not configured - confirm applicable buffer from the site-specific notification.",
    ],
    hardConstraint: false,
    provenance,
  };
}

// ---- SPCB (state pollution control board) status ------------------------------

export function evaluateSpcbRule(input: {
  state: string;
  industryType: string;
}): RuleOutcome {
  const provenance: Provenance = {
    source: "Water (Prevention and Control of Pollution) Act 1974",
    sourceDate: "1974-03-23",
    evidenceStatus: "VERIFIED",
  };

  return {
    outcome: "CONSENT TO ESTABLISH REQUIRED",
    reasons: [
      `Data centres in ${input.state} require Consent to Establish (CTE) and Consent to Operate (CTO) from the State Pollution Control Board.`,
      "Industry type is non-hazardous / Orange category in most states (confirm with state SPCB).",
      "Application is to be filed before construction; CTO before commissioning.",
    ],
    hardConstraint: false,
    provenance,
  };
}

export const REGULATORY_RULES_CATALOG = [
  {
    ruleCode: "CGWA-2020",
    domain: "cgwa",
    title: "CGWA Groundwater NOC Eligibility",
    description:
      "Determines NOC eligibility based on block category and proposed water source. Over-Exploited + no alternative = hard constraint.",
  },
  {
    ruleCode: "EC-8B-2006",
    domain: "ec",
    title: "Environmental Clearance - Item 8(b) Township/Area Development",
    description:
      "Built-up area >= 150,000 m² triggers Category B EC under EIA Notification 2006.",
  },
  {
    ruleCode: "ESZ-EPA-1986",
    domain: "esz",
    title: "Eco-Sensitive Zone Restrictions",
    description:
      "Industrial activities within notified ESZ are restricted; data centres are not on the permitted list.",
  },
  {
    ruleCode: "FOREST-CA-1980",
    domain: "forest",
    title: "Forest (Conservation) Act 1980",
    description: "Diversion of forest land for non-forest use requires prior approval.",
  },
  {
    ruleCode: "WETLAND-2017",
    domain: "wetland",
    title: "Wetlands (Conservation and Management) Rules 2017",
    description: "Encroachment on notified wetlands is prohibited.",
  },
  {
    ruleCode: "CRZ-2018",
    domain: "crz",
    title: "Coastal Regulation Zone Notification 2018",
    description: "Construction in CRZ-I/IV prohibited; CRZ-II/III regulated.",
  },
  {
    ruleCode: "SPCB-WATER-1974",
    domain: "spcb",
    title: "Water Act - CTE / CTO requirement",
    description: "CTE and CTO from State Pollution Control Board required.",
  },
];
