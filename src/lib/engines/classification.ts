/**
 * Four-way Classification Engine.
 *
 * The classification is a deterministic function of:
 *   - hard constraints (any true => HIGH CONSTRAINT)
 *   - missing evidence (any critical unknown => DATA INSUFFICIENT)
 *   - soft constraints (any true but no hard / no missing => FEASIBLE WITH CONDITIONS)
 *   - otherwise => FEASIBLE
 *
 * Order of precedence:
 *   1. HIGH CONSTRAINT  (hard constraint present)
 *   2. DATA INSUFFICIENT (a critical evidence field is UNKNOWN)
 *   3. FEASIBLE WITH CONDITIONS (soft constraint present)
 *   4. FEASIBLE
 *
 * Critical evidence fields (those whose absence blocks a confident decision):
 *   - groundwater category (drives CGWA rule)
 *   - site coordinates (drives every spatial check)
 *
 * Non-critical but useful:
 *   - rainfall, TDS, power timeline  -> flagged UNKNOWN but do not block decision
 */

export type Classification =
  | "Feasible"
  | "Feasible with Conditions"
  | "Data Insufficient"
  | "High Constraint / Further Assessment Required";

export interface ConstraintItem {
  key: string;
  label: string;
  kind: "hard" | "soft" | "info";
  outcome: string;
  reasons: string[];
  provenance: {
    source: string;
    sourceDate: string;
    evidenceStatus: "VERIFIED" | "PROXY" | "UNKNOWN";
  };
}

export interface EvidenceGap {
  key: string;
  label: string;
  whyCritical: string;
}

export interface ClassificationResult {
  classification: Classification;
  reasons: string[];
  hardConstraints: ConstraintItem[];
  softConstraints: ConstraintItem[];
  evidenceGaps: EvidenceGap[];
  trace: { step: string; result: string }[];
}

export function classify(
  constraints: ConstraintItem[],
  evidenceGaps: EvidenceGap[],
): ClassificationResult {
  const trace: { step: string; result: string }[] = [];

  const hardConstraints = constraints.filter((c) => c.kind === "hard");
  const softConstraints = constraints.filter((c) => c.kind === "soft");

  trace.push({
    step: "1. Hard constraint scan",
    result: `${hardConstraints.length} hard constraint(s) found`,
  });

  if (hardConstraints.length > 0) {
    const reasons = hardConstraints.flatMap((c) =>
      [`${c.label}: ${c.outcome}`, ...c.reasons].map((r) => `[HARD] ${r}`),
    );
    trace.push({ step: "2. Decision", result: "HIGH CONSTRAINT" });
    return {
      classification: "High Constraint / Further Assessment Required",
      reasons,
      hardConstraints,
      softConstraints,
      evidenceGaps,
      trace,
    };
  }

  trace.push({
    step: "2. Critical evidence scan",
    result: `${evidenceGaps.length} critical gap(s) found`,
  });

  if (evidenceGaps.length > 0) {
    const reasons = evidenceGaps.map(
      (g) => `[MISSING] ${g.label}: ${g.whyCritical}`,
    );
    trace.push({ step: "3. Decision", result: "DATA INSUFFICIENT" });
    return {
      classification: "Data Insufficient",
      reasons,
      hardConstraints,
      softConstraints,
      evidenceGaps,
      trace,
    };
  }

  trace.push({
    step: "3. Soft constraint scan",
    result: `${softConstraints.length} soft constraint(s) found`,
  });

  if (softConstraints.length > 0) {
    const reasons = softConstraints.flatMap((c) =>
      [`${c.label}: ${c.outcome}`, ...c.reasons].map((r) => `[CONDITION] ${r}`),
    );
    trace.push({ step: "4. Decision", result: "FEASIBLE WITH CONDITIONS" });
    return {
      classification: "Feasible with Conditions",
      reasons,
      hardConstraints,
      softConstraints,
      evidenceGaps,
      trace,
    };
  }

  trace.push({ step: "4. Decision", result: "FEASIBLE" });
  return {
    classification: "Feasible",
    reasons: ["No hard constraints detected.", "No critical evidence gaps.", "No soft constraints triggered."],
    hardConstraints,
    softConstraints,
    evidenceGaps,
    trace,
  };
}
