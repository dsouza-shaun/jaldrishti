/**
 * Report document model.
 *
 * The screening report is produced in one place and rendered three ways: as
 * React on the report page, as PDF and as Word. Keeping the structure here as
 * plain data means the printed and downloaded documents cannot drift from what
 * the reviewer read on screen.
 *
 * Nothing in this file decides anything. Every value is read from the
 * deterministic analysis result or from the submitted project inputs.
 */

import type { AnalysisResult } from "@/lib/engines/orchestrator";

// ---- Block vocabulary ---------------------------------------------------------

export type Block =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  /** A caveat or limitation. Rendered muted, never as a finding. */
  | { kind: "note"; text: string }
  | { kind: "metrics"; items: Metric[] }
  | { kind: "table"; caption?: string; columns: string[]; rows: string[][] }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "divider" };

export interface Metric {
  label: string;
  value: string;
  note?: string;
}

export interface ReportInput {
  project: ProjectInputs;
  analysis: AnalysisResult;
  /** Plain-language AI explanation, when one has been generated. */
  explanation?: string | null;
  /** Scenario rows, when the project has any. */
  scenarios?: ScenarioSummary[];
  /** Latest authority review, if the report has been submitted. */
  review?: ReviewSummary | null;
}

export interface ProjectInputs {
  id: string;
  projectName: string;
  latitude: number;
  longitude: number;
  itLoad: number;
  pue: number;
  wue: number;
  coolingType: string;
  builtUpArea: number | null;
  landTenure: string;
  proposedWaterSource: string;
  alternativeWaterSource: string | null;
  notes: string | null;
  createdAt?: string;
}

export interface ScenarioSummary {
  id: string;
  label: string;
  waterKlPerDay: number;
  waterMcmPerYear: number;
  waterMld: number;
  classification: string;
}

export interface ReviewSummary {
  decision: string;
  comments: string | null;
  updatedAt: string;
  reviewerName: string | null;
}

// ---- Formatting ---------------------------------------------------------------
// en-IN is pinned so a number never renders differently between the browser and
// the server, which would show as a hydration mismatch on the report page.

const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const nf3 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export function fmtInt(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? nf.format(value) : "Not available";
}

export function fmt1(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? nf1.format(value) : "Not available";
}

export function fmt3(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? nf3.format(value) : "Not available";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "Not available";
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function emDash(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "Not available" : value;
}

// ---- Shared labels ------------------------------------------------------------

export const CLASSIFICATION_MEANING: Record<string, string> = {
  Feasible: "No hard or soft constraint was triggered by the evidence available.",
  "Feasible with Conditions": "Constraints were detected. The listed conditions must be addressed and verified before development.",
  "Data Insufficient": "Required evidence was unavailable, so no conclusion can be drawn from this screening.",
  "High Constraint / Further Assessment Required": "A hard constraint was triggered. This site requires further assessment before it can be considered.",
};

export const DECISION_LABEL: Record<string, string> = {
  PENDING: "Awaiting authority review",
  APPROVED: "Recorded as approved",
  APPROVED_WITH_CONDITIONS: "Recorded as approved with conditions",
  REJECTED: "Recorded as not approved",
  MORE_INFO: "Further information required",
};

export const DECISION_MEANING: Record<string, string> = {
  PENDING: "Submitted and waiting for an authority user to record a decision.",
  APPROVED:
    "An authority user has recorded an approval decision against this submission. This is an assessment record, not a statutory approval.",
  APPROVED_WITH_CONDITIONS:
    "An authority user has recorded an approval decision with conditions. This is an assessment record, not a statutory approval.",
  REJECTED:
    "An authority user has recorded that the submission is not approved. This is an assessment record, not a statutory rejection under any statute.",
  MORE_INFO:
    "An authority user has requested further information before deciding. This is an assessment record, not a statutory notice.",
};

// ---- Derived values -----------------------------------------------------------

/**
 * Evidence discipline, stated once so the page, the PDF and the Word file all
 * describe the result the same way.
 */
export const EVIDENCE_LEGEND: Array<{ label: string; meaning: string }> = [
  { label: "Calculated", meaning: "Derived from the submitted project inputs using a published formula." },
  { label: "Sourced", meaning: "Read from a named public dataset or official record." },
  { label: "Needs verification", meaning: "Project-specific or site-specific detail that only the applicant can confirm." },
];

export interface HeadlineCondition {
  id: string;
  label: string;
  /** The engine's outcome, verbatim. Used where the exact rule text matters. */
  outcome: string;
  /** Short, proxy-free phrasing for the summary view. */
  summary: string;
  kind: "hard" | "condition" | "missing";
  /** Supporting detail, kept for the expanded view and the full report. */
  detail: string[];
}

/**
 * Condenses a rule outcome into a short phrase for display.
 *
 * The engine encodes two things in one string: the finding, and how the
 * geometry was sourced. Phrases such as "NO OVERLAP IN PROXY SCREENING
 * FIXTURE" and "WETLAND PROXY OVERLAP - VERIFICATION REQUIRED" are correct but
 * noisy when repeated as a headline. This maps the engine's fixed vocabulary to
 * the finding alone. The provenance is not lost: it is still reported per row in
 * the evidence tables, which is where it belongs.
 *
 * Anything unrecognised is passed through unchanged rather than guessed at.
 */
export function summariseOutcome(outcome: string | null | undefined): string {
  const text = (outcome ?? "").trim();
  if (!text) return "";
  const upper = text.toUpperCase();

  // Overlap outcomes are checked before the verification wording, because the
  // proxy overlap string contains both.
  if (/OVERLAP\s+(DETECTED|—|-)?\s*VERIFICATION REQUIRED/.test(upper) || /VERIFICATION REQUIRED/.test(upper)) {
    return /OVERLAP/.test(upper) ? "Overlap, verification required" : "Verification required";
  }
  if (/OVERLAP DETECTED/.test(upper)) return "Overlap detected";
  if (/^NO OVERLAP/.test(upper)) return "No overlap detected";
  if (/DATA INSUFFICIENT/.test(upper)) return "Data insufficient";
  if (/HIGH REGULATORY CONSTRAINT/.test(upper)) return "Regulatory constraint";
  if (/FEASIBLE WITH CONDITIONS/.test(upper)) return "Conditions apply";
  if (/CONSENT TO ESTABLISH REQUIRED/.test(upper)) return "Consent required";
  if (/EC APPLICABLE/.test(upper)) return "Applicable";
  if (/STATE RULE UNKNOWN/.test(upper)) return "State rule unknown";
  if (/^FEASIBLE$/.test(upper)) return "No constraint";
  if (/NOT TRIGGERED/.test(upper)) return "Not triggered";
  return text;
}

/**
 * Reduces the classification to the few conditions that carry the result.
 *
 * `ClassificationResult.reasons` is a flat list that expands every constraint
 * into its outcome plus each of its sub-reasons, so three constraints can
 * produce twenty lines, several restating each other. Reporting that list
 * verbatim buries the finding.
 *
 * This selects at the level of the constraint: one line per constraint, ordered
 * by weight, capped at `max`. Nothing is invented, and the raw outcome and full
 * reasons are retained on each item so the report can still show everything.
 */
export function selectHeadlineConditions(
  classification: {
    classification: string;
    hardConstraints?: Array<{ key: string; label: string; outcome: string; reasons: string[] }>;
    softConstraints?: Array<{ key: string; label: string; outcome: string; reasons: string[] }>;
    evidenceGaps?: Array<{ key: string; label: string; whyCritical: string }>;
    reasons?: string[];
  },
  max = 3,
): { shown: HeadlineCondition[]; rest: HeadlineCondition[]; total: number } {
  const hard = classification.hardConstraints ?? [];
  const soft = classification.softConstraints ?? [];
  const gaps = classification.evidenceGaps ?? [];

  const fromConstraints = (
    items: Array<{ key: string; label: string; outcome: string; reasons: string[] }>,
    kind: HeadlineCondition["kind"],
  ): HeadlineCondition[] =>
    items.map((item) => ({
      id: item.key,
      label: item.label,
      outcome: item.outcome,
      summary: summariseOutcome(item.outcome),
      kind,
      detail: item.reasons ?? [],
    }));

  // Pick the bucket that actually drove this classification, so a
  // "Data Insufficient" result explains itself with its evidence gaps rather
  // than with an unrelated constraint.
  let candidates: HeadlineCondition[];
  if (classification.classification.includes("High Constraint")) {
    candidates = hard.length
      ? [...fromConstraints(hard, "hard"), ...fromConstraints(soft, "condition")]
      : fromConstraints(soft, "condition");
  } else if (classification.classification.includes("Data Insufficient")) {
    candidates = gaps.length
      ? gaps.map((gap) => ({
          id: gap.key,
          label: gap.label,
          outcome: gap.whyCritical,
          summary: "Verification required",
          kind: "missing" as const,
          detail: [],
        }))
      : fromConstraints(soft, "condition");
  } else if (classification.classification.includes("Conditions")) {
    candidates = fromConstraints(soft, "condition");
  } else {
    // Feasible. The engine returns three positive statements rather than
    // constraints, and there is nothing to trim.
    const statements = (classification.reasons ?? []).map((text, index) => ({
      id: `clear-${index}`,
      label: text,
      outcome: "",
      summary: text,
      kind: "condition" as const,
      detail: [],
    }));
    return {
      shown: statements.slice(0, max),
      rest: statements.slice(max),
      total: statements.length,
    };
  }

  // Two constraints can share a label when the same rule fires for more than
  // one feature, so collapse them rather than printing the label twice.
  const seen = new Set<string>();
  const distinct = candidates.filter((item) => {
    const fingerprint = item.label.trim().toLowerCase();
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });

  return {
    shown: distinct.slice(0, max),
    rest: distinct.slice(max),
    total: distinct.length,
  };
}

/**
 * Pre-development recommendations.
 *
 * Every line is triggered by a finding the rule engine actually produced, and
 * each is phrased as an action to take. Nothing here asserts a legal
 * requirement, a threshold or an entitlement that is not already in the result.
 */
export function buildRecommendations(
  analysis: AnalysisResult,
  project: ProjectInputs,
): string[] {
  const items: string[] = [];
  const seen = new Set<string>();
  const add = (line: string) => {
    if (!seen.has(line)) {
      seen.add(line);
      items.push(line);
    }
  };

  // Verification gaps, straight from the engine.
  for (const gap of analysis.evidenceGaps ?? []) {
    add(`Confirm ${gap.label.toLowerCase()}. ${gap.whyCritical}`);
  }

  // Groundwater.
  const gw = analysis.groundwater;
  if (gw) {
    if (!gw.assessmentUnitVerified) {
      add("Confirm the groundwater assessment unit for the site. The current value is district level and is not block verified.");
    }
    if (gw.category === "UNKNOWN") {
      add("Obtain the CGWB groundwater block classification for the district. Eligibility for extraction cannot be assessed without it.");
    }
    if (gw.provenance?.evidenceStatus === "PROXY") {
      add("Assess site-specific groundwater availability. The current figure is modelled from regional data.");
    }
    if (usesGroundwater(project.proposedWaterSource)) {
      add("Confirm the project-specific water allocation and entitlement with the relevant state water authority.");
    }
  }

  // Regulatory outcomes that are not a pass.
  const reg = analysis.regulatory;
  if (reg) {
    if (reg.cgwa?.outcome && !/^(PASS|ELIGIBLE|NO\s)/i.test(reg.cgwa.outcome)) {
      add(`Assess the groundwater extraction position. The screening returned: ${reg.cgwa.outcome}.`);
    }
    if (reg.ec?.outcome) {
      add(`Obtain the environmental clearance pathway position for the project. The screening returned: ${reg.ec.outcome}.`);
    }
    if (reg.spcb?.outcome) {
      add(`Confirm consent status with the state pollution control board. The screening returned: ${reg.spcb.outcome}.`);
    }
  }

  // Ecological overlaps.
  for (const layer of ["esz", "forest", "wetland", "crz"] as const) {
    const entry = analysis.ecology?.[layer];
    if (entry?.overlap) {
      add(`Further assessment required for ${layer.toUpperCase()}. The screening detected a possible overlap.`);
    }
  }

  // Water source, when the alternative has not been assessed.
  if (project.alternativeWaterSource && project.alternativeWaterSource === project.proposedWaterSource) {
    add("Assess an alternative water source. The proposed and alternative sources are currently identical.");
  }

  if (items.length === 0) {
    add("Retain the evidence pack for this screening. Re-run the assessment if the project parameters change.");
  }

  return items;
}

function usesGroundwater(source: string): boolean {
  const normalized = source.toLowerCase();
  return normalized.includes("ground") || normalized === "borewell";
}

/** Aggregate the evidence rows the report presents as its sources table. */
export function buildEvidenceRows(
  analysis: AnalysisResult,
): Array<{ field: string; value: string; status: string; source: string; date: string }> {
  const rows: Array<{ field: string; value: string; status: string; source: string; date: string }> = [];
  const push = (
    field: string,
    value: string,
    status: string | undefined,
    source: string | undefined,
    date: string | undefined,
  ) => {
    if (!value || value === "Not available") return;
    rows.push({
      field,
      value,
      status: status ?? "UNKNOWN",
      source: source ?? "Not recorded",
      date: date ?? "",
    });
  };

  const gw = analysis.groundwater;
  if (gw) {
    push("Groundwater screening category", gw.category ?? "", gw.provenance?.evidenceStatus, gw.provenance?.source, gw.provenance?.sourceDate);
  }
  const rf = analysis.rainfall;
  if (rf) {
    push("Rainfall normal", rf.annualNormal != null ? `${fmtInt(rf.annualNormal)} mm` : "", rf.provenance?.evidenceStatus, rf.provenance?.source, rf.provenance?.sourceDate);
  }
  const risk = analysis.siteData?.waterRisk as
    | { aqueduct?: { region?: string; country?: string; provenance?: { source?: string; sourceDate?: string; evidenceStatus?: string } } }
    | null
    | undefined;
  if (risk?.aqueduct?.region) {
    push("Water risk basin", risk.aqueduct.region, risk.aqueduct.provenance?.evidenceStatus, risk.aqueduct.provenance?.source, risk.aqueduct.provenance?.sourceDate);
  }
  const location = analysis.siteData?.location as { data?: { provenance?: { source?: string; sourceDate?: string; evidenceStatus?: string }; displayName?: string } } | null | undefined;
  if (location?.data) {
    push("Resolved location", location.data.displayName ?? "", location.data.provenance?.evidenceStatus, location.data.provenance?.source, location.data.provenance?.sourceDate);
  }
  const power = analysis.power;
  if (power?.provenance) {
    push("Power plant inventory", `${analysis.power.nearbyPowerPlants?.length ?? 0} nearby records`, power.provenance.evidenceStatus, power.provenance.source, power.provenance.sourceDate);
  }

  // Provider failures are reported, never hidden.
  for (const failure of analysis.siteData?.failures ?? []) {
    rows.push({
      field: failure.provider,
      value: "Data provider did not respond",
      status: "UNKNOWN",
      source: "Provider failure",
      date: "",
    });
  }

  return rows;
}

export const EVIDENCE_STATUS_LABEL: Record<string, string> = {
  VERIFIED: "Sourced",
  PROXY: "Sourced (modelled)",
  UNKNOWN: "Needs verification",
};
