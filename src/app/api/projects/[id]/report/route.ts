import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessProject, getSessionUser } from "@/lib/auth/session";
import type { AnalysisResult } from "@/lib/engines/orchestrator";
import { buildReportSections } from "@/lib/report/sections";
import { renderReportPdf } from "@/lib/report/pdf";
import { renderReportDocx } from "@/lib/report/docx";
import type { ProjectInputs, ReviewSummary, ScenarioSummary } from "@/lib/report/document";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/projects/[id]/report?format=json|pdf|docx
 *
 * Builds the report once and serialises it three ways. The `json` form is what
 * the report page renders, so the page a reviewer reads and the file they
 * download are the same document by construction rather than by convention.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rate = checkEdgeRateLimit(req, "report", 40, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  if (!["json", "pdf", "docx"].includes(format)) {
    return NextResponse.json(
      { error: "Unsupported format. Use json, pdf or docx." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project || !canAccessProject(user, project)) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const analysis = await db.analysis.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    if (!analysis) {
      return NextResponse.json(
        { error: "No screening result is available for this project yet." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = JSON.parse(analysis.resultJson) as AnalysisResult;

    const scenarioRows = await db.scenario.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const scenarios: ScenarioSummary[] = scenarioRows.map((row) => {
      const parsed = JSON.parse(row.resultJson) as AnalysisResult;
      return {
        id: row.id,
        label: row.label,
        waterKlPerDay: Number(parsed.waterDemand?.waterKlPerDay ?? 0),
        waterMcmPerYear: Number(parsed.waterDemand?.waterMcmPerYear ?? 0),
        waterMld: Number(parsed.waterDemand?.waterMld ?? 0),
        classification: parsed.classification?.classification ?? "Unknown",
      };
    });

    const latestReview = await db.review.findFirst({
      where: { projectId: id },
      orderBy: { updatedAt: "desc" },
      include: { reviewer: { select: { displayName: true } } },
    });
    const review: ReviewSummary | null = latestReview
      ? {
          decision: latestReview.decision,
          comments: latestReview.comments,
          updatedAt: latestReview.updatedAt.toISOString(),
          reviewerName: latestReview.reviewer?.displayName ?? null,
        }
      : null;

    const projectInputs: ProjectInputs = {
      id: project.id,
      projectName: project.projectName,
      latitude: project.latitude,
      longitude: project.longitude,
      itLoad: project.itLoad,
      pue: project.pue,
      wue: project.wue,
      coolingType: project.coolingType,
      builtUpArea: project.builtUpArea,
      landTenure: project.landTenure,
      proposedWaterSource: project.proposedWaterSource,
      alternativeWaterSource: project.alternativeWaterSource,
      notes: project.notes,
      createdAt: project.createdAt.toISOString(),
    };

    const sections = buildReportSections({
      project: projectInputs,
      analysis: result,
      explanation: analysis.explanation ?? null,
      scenarios,
      review,
    });

    const generatedOn = new Date(analysis.createdAt);
    const title = `${project.projectName} - Screening Report`;
    const subtitle = `Preliminary site screening generated on ${generatedOn.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
    const footer =
      "Preliminary decision support. Not a statutory approval. JalDrishti is not the authority.";

    if (format === "json") {
      return NextResponse.json(
        {
          project: projectInputs,
          title,
          subtitle,
          footer,
          generatedAt: analysis.createdAt,
          analysisId: analysis.id,
          sections,
          review,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const safeName = project.projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "screening-report";
    const dateStamp = generatedOn.toISOString().slice(0, 10);

    if (format === "pdf") {
      const buffer = await renderReportPdf(sections, { title, subtitle, footer });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}-report-${dateStamp}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const buffer = await renderReportDocx(sections, { title, subtitle, footer });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}-report-${dateStamp}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[report]", error);
    return NextResponse.json(
      { error: "Unable to build the report." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
