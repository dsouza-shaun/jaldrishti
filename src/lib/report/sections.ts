/**
 * Builds the ordered report sections.
 *
 * This is the single definition of what a JalDrishti screening report contains.
 * The page, the PDF and the Word document all walk this structure, so none of
 * them can show something the others do not.
 */

import {
  buildEvidenceRows,
  buildRecommendations,
  CLASSIFICATION_MEANING,
  DECISION_LABEL,
  DECISION_MEANING,
  EVIDENCE_LEGEND,
  EVIDENCE_STATUS_LABEL,
  emDash,
  fmt1,
  fmt3,
  fmtDate,
  fmtInt,
  selectHeadlineConditions,
  titleCase,
  type Block,
  type ReportInput,
} from "@/lib/report/document";

export interface ReportSection {
  id: string;
  title: string;
  blocks: Block[];
}

const ECOLOGY_LABELS: Record<string, string> = {
  esz: "Eco-Sensitive Zone",
  forest: "Forest",
  wetland: "Wetland",
  crz: "Coastal Regulation Zone",
};

const ECOLOGY_AUTHORITY: Record<string, string> = {
  esz: "Wildlife (Protection) Act",
  forest: "Forest (Conservation) Act",
  wetland: "Wetland (Rules) 2017",
  crz: "CRZ Notification 2018",
};

export function buildReportSections(input: ReportInput): ReportSection[] {
  const { project, analysis, explanation, scenarios, review } = input;
  const water = analysis.waterDemand;
  const gw = analysis.groundwater;
  const rf = analysis.rainfall;
  const classification = analysis.classification.classification;

  const sections: ReportSection[] = [];

  // ---- Project and site ----------------------------------------------------
  sections.push({
    id: "site",
    title: "Project and Site Information",
    blocks: [
      {
        kind: "table",
        columns: ["Field", "Value"],
        rows: [
          ["Project name", emDash(project.projectName)],
          ["Site latitude", fmt3(project.latitude)],
          ["Site longitude", fmt3(project.longitude)],
          [
            "Resolved location",
            emDash(
              (analysis.siteData?.location as { data?: { displayName?: string; district?: string; state?: string } } | null)
                ?.data?.displayName,
            ),
          ],
          [
            "District / State",
            [
              (analysis.siteData?.location as { data?: { district?: string } } | null)?.data?.district,
              (analysis.siteData?.location as { data?: { state?: string } } | null)?.data?.state,
            ]
              .filter(Boolean)
              .join(", ") || "Not available",
          ],
          ["Proposed water source", titleCase(project.proposedWaterSource)],
          ["Alternative water source", titleCase(project.alternativeWaterSource)],
          ["Land tenure", titleCase(project.landTenure)],
          ["Built-up area", project.builtUpArea != null ? `${fmtInt(project.builtUpArea)} m2` : "Not supplied"],
          ["Applicant notes", emDash(project.notes)],
        ],
      },
    ],
  });

  // ---- Executive result ----------------------------------------------------
  sections.push({
    id: "result",
    title: "Executive Screening Result",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "Screening result", value: classification },
          {
            label: "Estimated water requirement",
            value: `${fmtInt(water.waterKlPerDay)} kL/day`,
            note: `${fmt3(water.waterMcmPerYear)} MCM/year`,
          },
        ],
      },
      { kind: "paragraph", text: CLASSIFICATION_MEANING[classification] ?? "" },
      {
        kind: "note",
        text: "This is a preliminary screening produced by deterministic rules over public and bundled data. It is not an approval, and JalDrishti is not the authority.",
      },
    ],
  });

  // ---- Water demand --------------------------------------------------------
  sections.push({
    id: "water-demand",
    title: "Water Demand Assessment",
    blocks: [
      {
        kind: "table",
        caption: "Submitted parameters",
        columns: ["Parameter", "Value"],
        rows: [
          ["IT load", `${fmt1(project.itLoad)} MW`],
          ["PUE", fmt3(project.pue)],
          ["WUE", `${fmt3(water.wueUsed)} L/kWh`],
          ["Cooling technology", titleCase(project.coolingType)],
        ],
      },
      {
        kind: "table",
        caption: "Calculated demand",
        columns: ["Measure", "Value"],
        rows: [
          ["Daily water demand", `${fmtInt(water.waterKlPerDay)} kL/day`],
          ["Annual water demand", `${fmt3(water.waterMcmPerYear)} MCM/year`],
          ["Daily water demand", `${fmt3(water.waterMld)} MLD`],
          ["Facility energy", `${fmt1(water.facilityEnergyMwhPerDay)} MWh/day`],
          ["IT energy", `${fmtInt(water.itEnergyKwhPerDay)} kWh/day`],
        ],
      },
      {
        kind: "note",
        text: `Calculated as facility energy (IT load x 24 x PUE) multiplied by WUE. WUE reference: ${emDash(water.wueSource)}. Source: ${emDash(water.provenance?.source)}, ${emDash(water.provenance?.sourceDate)}.`,
      },
    ],
  });

  // ---- Water source and groundwater ---------------------------------------
  sections.push({
    id: "water-source",
    title: "Water Source and Groundwater Evidence",
    blocks: [
      {
        kind: "table",
        columns: ["Field", "Finding"],
        rows: [
          ["Proposed source", titleCase(project.proposedWaterSource)],
          ["Alternative source", titleCase(project.alternativeWaterSource)],
          [
            "Groundwater category",
            gw ? titleCase(gw.category) : "Not available",
          ],
          ["District / State", [gw?.district, gw?.state].filter(Boolean).join(", ") || "Not available"],
          ["Block or assessment unit", emDash(gw?.block)],
          [
            "Extraction stage",
            typeof gw?.stage === "number" ? `${fmt1(gw.stage)}%` : "Not available",
          ],
          ["Total dissolved solids", typeof gw?.tds === "number" ? `${fmt1(gw.tds)} mg/L` : "Not supplied"],
          [
            "Water table depth",
            gw?.preMonsoon != null || gw?.postMonsoon != null
              ? `${emDash(String(gw?.preMonsoon ?? null))} / ${emDash(String(gw?.postMonsoon ?? null))} mbgl`
              : "Not supplied",
          ],
          [
            "Assessment unit verified",
            gw?.assessmentUnitVerified ? "Yes" : "No, district level only",
          ],
          [
            "Evidence status",
            gw?.provenance?.evidenceStatus
              ? EVIDENCE_STATUS_LABEL[gw.provenance.evidenceStatus] ?? gw.provenance.evidenceStatus
              : "Needs verification",
          ],
        ],
      },
      {
        kind: "note",
        text: `Regional groundwater context. Source: ${emDash(gw?.provenance?.source)}, ${emDash(gw?.provenance?.sourceDate)}. ${gw?.provenance?.caveat ?? ""}`.trim(),
      },
    ],
  });

  // ---- Environmental -------------------------------------------------------
  const ecologyRows = (["esz", "forest", "wetland", "crz"] as const).map((layer) => {
    const entry = analysis.ecology?.[layer];
    return [
      ECOLOGY_LABELS[layer],
      entry?.overlap ? "Potential overlap" : "No overlap found",
      entry?.overlap
        ? entry.intersectedPolygons?.map((polygon) => polygon.name).join(", ") || "Overlap detected"
        : `Nearest ${fmt1(entry?.nearestDistanceKm)} km`,
      ECOLOGY_AUTHORITY[layer],
    ];
  });

  sections.push({
    id: "environment",
    title: "Environmental and Ecological Assessment",
    blocks: [
      {
        kind: "table",
        columns: ["Constraint", "Status", "Finding", "Reference"],
        rows: ecologyRows,
      },
      {
        kind: "note",
        text: "Constraints are tested against available boundary layers. Absence of a detected overlap is not a clearance.",
      },
    ],
  });

  // ---- Regulatory ----------------------------------------------------------
  sections.push({
    id: "regulatory",
    title: "Regulatory Assessment",
    blocks: [
      {
        kind: "table",
        columns: ["Check", "Outcome", "Constraint", "Reference"],
        rows: [
          [
            "Groundwater extraction (CGWA NOC)",
            emDash(analysis.regulatory?.cgwa?.outcome),
            analysis.regulatory?.cgwa?.hardConstraint ? "Hard" : "Soft",
            `${emDash(analysis.regulatory?.cgwa?.provenance?.source)}, ${emDash(analysis.regulatory?.cgwa?.provenance?.sourceDate)}`,
          ],
          [
            "Environmental clearance",
            emDash(analysis.regulatory?.ec?.outcome),
            analysis.regulatory?.ec?.hardConstraint ? "Hard" : "Soft",
            `${emDash(analysis.regulatory?.ec?.provenance?.source)}, ${emDash(analysis.regulatory?.ec?.provenance?.sourceDate)}`,
          ],
          [
            "Consent to establish and operate (SPCB)",
            emDash(analysis.regulatory?.spcb?.outcome),
            analysis.regulatory?.spcb?.hardConstraint ? "Hard" : "Soft",
            `${emDash(analysis.regulatory?.spcb?.provenance?.source)}, ${emDash(analysis.regulatory?.spcb?.provenance?.sourceDate)}`,
          ],
        ],
      },
      {
        kind: "list",
        items: [
          ...(analysis.regulatory?.cgwa?.reasons ?? []),
          ...(analysis.regulatory?.ec?.reasons ?? []),
          ...(analysis.regulatory?.spcb?.reasons ?? []),
        ],
      },
    ],
  });

  // ---- Climate -------------------------------------------------------------
  sections.push({
    id: "climate",
    title: "Climate and Water Context",
    blocks: [
      {
        kind: "table",
        columns: ["Measure", "Value"],
        rows: [
          ["Rainfall station or district", emDash(rf?.station ?? rf?.district)],
          ["Annual rainfall", rf?.annualRainfallMm != null ? `${fmtInt(rf.annualRainfallMm)} mm` : "Not available"],
          ["Monsoon rainfall", rf?.monsoonRainfallMm != null ? `${fmtInt(rf.monsoonRainfallMm)} mm` : "Not available"],
          ["Dataset period", emDash(rf?.period)],
          [
            "Evidence status",
            rf?.provenance?.evidenceStatus
              ? EVIDENCE_STATUS_LABEL[rf.provenance.evidenceStatus] ?? rf.provenance.evidenceStatus
              : "Needs verification",
          ],
          ["Nearby power plants", `${analysis.power?.nearbyPowerPlants?.length ?? 0} records`],
        ],
      },
      {
        kind: "note",
        text: "Climate and power figures are regional or modelled values. They are not measurements taken at the site.",
      },
    ],
  });

  // ---- Evidence ------------------------------------------------------------
  sections.push({
    id: "evidence",
    title: "Evidence and Sources",
    blocks: [
      { kind: "table", columns: ["Legend", "Meaning"], rows: EVIDENCE_LEGEND.map((item) => [item.label, item.meaning]) },
      {
        kind: "table",
        columns: ["Field", "Value", "Status", "Source", "Date"],
        rows: buildEvidenceRows(analysis).map((row) => [
          row.field,
          row.value,
          EVIDENCE_STATUS_LABEL[row.status] ?? row.status,
          row.source,
          row.date,
        ]),
      },
    ],
  });

  // ---- Constraints and conditions -----------------------------------------
  const hard = analysis.classification.hardConstraints ?? [];
  const soft = analysis.classification.softConstraints ?? [];
  // Three conditions carry the result. The report keeps the complete record in
  // the tables below, one row per constraint with its reasons attached, so
  // nothing is lost by summarising the summary.
  const headline = selectHeadlineConditions(analysis.classification, 3);
  sections.push({
    id: "constraints",
    title: "Constraints and Conditions",
    blocks: [
      {
        kind: "list",
        ordered: true,
        items: headline.shown.map(
          (condition) =>
            `${condition.label}${condition.summary ? `: ${condition.summary}` : ""}`,
        ),
      },
      {
        kind: "note",
        text:
          headline.total > headline.shown.length
            ? (() => {
                const withheld = headline.total - headline.shown.length;
                return `${headline.total} condition${headline.total === 1 ? " was" : "s were"} assessed. The remaining ${withheld} ${withheld === 1 ? "is" : "are"} recorded in full in the table${withheld === 1 ? "" : "s"} below.`;
              })()
            : "Every condition raised by the screening is listed above.",
      },
      {
        kind: "table",
        caption: "Hard constraints",
        columns: ["Constraint", "Outcome", "Finding", "Reference"],
        rows: hard.map((item) => [
          item.label,
          item.outcome,
          (item.reasons ?? []).join(" "),
          `${emDash(item.provenance?.source)}, ${emDash(item.provenance?.sourceDate)}`,
        ]),
      },
      {
        kind: "table",
        caption: "Conditions",
        columns: ["Condition", "Outcome", "Finding", "Reference"],
        rows: soft.map((item) => [
          item.label,
          item.outcome,
          (item.reasons ?? []).join(" "),
          `${emDash(item.provenance?.source)}, ${emDash(item.provenance?.sourceDate)}`,
        ]),
      },
    ],
  });

  // ---- Verification required ----------------------------------------------
  sections.push({
    id: "verification",
    title: "Verification Required",
    blocks: [
      {
        kind: "table",
        columns: ["Item", "Why it matters"],
        rows: (analysis.evidenceGaps ?? []).map((gap) => [gap.label, gap.whyCritical]),
      },
      {
        kind: "note",
        text: "Items above are unavailable or unverified in this screening. They must be confirmed by the applicant or the authority before a decision is taken.",
      },
    ],
  });

  // ---- Scenarios -----------------------------------------------------------
  if (scenarios && scenarios.length > 0) {
    const baseline = water.waterKlPerDay;
    sections.push({
      id: "scenarios",
      title: "Scenario and Mitigation Summary",
      blocks: [
        {
          kind: "table",
          columns: ["Scenario", "Water demand (kL/day)", "Change", "Annual (MCM/yr)", "Screening result"],
          rows: [
            [
              "Baseline",
              fmtInt(baseline),
              "-",
              fmt3(water.waterMcmPerYear),
              classification,
            ],
            ...scenarios.map((scenario) => {
              const delta = scenario.waterKlPerDay - baseline;
              const percent = baseline > 0 ? (delta / baseline) * 100 : 0;
              return [
                scenario.label,
                fmtInt(scenario.waterKlPerDay),
                `${delta >= 0 ? "+" : ""}${fmt1(percent)}%`,
                fmt3(scenario.waterMcmPerYear),
                scenario.classification,
              ];
            }),
          ],
        },
        {
          kind: "note",
          text: "Total water demand is compared. The screening does not split demand into freshwater and reclaimed components, so no such split is reported.",
        },
      ],
    });
  }

  // ---- Recommendations -----------------------------------------------------
  sections.push({
    id: "recommendations",
    title: "Pre-Development Recommendations",
    blocks: [
      {
        kind: "list",
        ordered: true,
        items: buildRecommendations(analysis, project),
      },
      {
        kind: "note",
        text: "These are suggested next steps derived from this screening's findings. They are not legal requirements and do not establish compliance.",
      },
    ],
  });

  // ---- AI-assisted explanation -------------------------------------------
  if (explanation) {
    sections.push({
      id: "explanation",
      title: "AI-Assisted Explanation",
      blocks: [
        {
          kind: "note",
          text: "Generated text only. The screening result above was produced by deterministic rules and is unaffected by this explanation.",
        },
        { kind: "paragraph", text: explanation },
      ],
    });
  }

  // ---- Review --------------------------------------------------------------
  if (review) {
    sections.push({
      id: "review",
      title: "Authority Review",
      blocks: [
        {
          kind: "table",
          columns: ["Field", "Value"],
          rows: [
            ["Status", DECISION_LABEL[review.decision] ?? review.decision],
            ["Recorded by", emDash(review.reviewerName)],
            ["Recorded on", fmtDate(review.updatedAt)],
            ["Comments", emDash(review.comments)],
          ],
        },
        { kind: "note", text: DECISION_MEANING[review.decision] ?? "" },
      ],
    });
  }

  return sections;
}

export function reportTitle(projectName: string): string {
  return `${projectName} - Screening Report`;
}
