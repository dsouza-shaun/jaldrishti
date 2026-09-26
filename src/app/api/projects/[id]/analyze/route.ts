import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyze, type AnalyzeInput } from "@/lib/engines/orchestrator";
import { canAccessProject, getSessionUser } from "@/lib/auth/session";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

function unauthenticated() {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

function notFound() {
  return NextResponse.json(
    { error: "Project not found" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

// POST /api/projects/[id]/analyze - run the full analysis pipeline and persist the result.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkEdgeRateLimit(req, "analysis", 30, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const user = await getSessionUser(req);
  if (!user) return unauthenticated();

  // Screening is run by the Developer who submitted the site. An Authority
  // account reads results, it does not generate them.
  if (user.role !== "DEVELOPER") {
    return NextResponse.json(
      { error: "Only a Developer account can run a screening." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project || !canAccessProject(user, project)) return notFound();

    const input: AnalyzeInput = {
      projectId: project.id,
      projectName: project.projectName,
      latitude: project.latitude,
      longitude: project.longitude,
      itLoad: project.itLoad,
      pue: project.pue,
      wue: project.wue,
      coolingType: project.coolingType,
      builtUpArea: project.builtUpArea ?? undefined,
      landTenure: project.landTenure,
      proposedWaterSource: project.proposedWaterSource,
      alternativeWaterSource: project.alternativeWaterSource,
      notes: project.notes,
    };

    const result = await analyze(input);

    // Persist the analysis
    const saved = await db.analysis.create({
      data: {
        projectId: project.id,
        resultJson: JSON.stringify(result),
      },
    });

    return NextResponse.json({ analysisId: saved.id, result }, { status: 200 });
  } catch (error) {
    console.error("[analysis]", error);
    return NextResponse.json(
      { error: "Unable to complete the analysis." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// GET /api/projects/[id]/analyze - return the most recent analysis for this project.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkEdgeRateLimit(req, "analysis", 30, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const user = await getSessionUser(req);
  if (!user) return unauthenticated();

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project || !canAccessProject(user, project)) return notFound();

    const latest = await db.analysis.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latest) {
      return NextResponse.json(
        { error: "No analysis yet", hasAnalysis: false },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({
      analysisId: latest.id,
      result: JSON.parse(latest.resultJson),
      // The submitted inputs, which the analysis result does not carry. The
      // dashboard and the report need them to show how the demand was derived.
      project: {
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
      },
      // Returned so a deep link into /explanation can show the AI explanation
      // that was already generated, instead of silently rendering nothing.
      explanation: latest.explanation ?? null,
      generatedAt: latest.createdAt,
      hasAnalysis: true,
    });
  } catch (error) {
    console.error("[analysis]", error);
    return NextResponse.json(
      { error: "Unable to complete the analysis." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
