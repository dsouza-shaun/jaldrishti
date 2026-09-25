import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyze, type AnalyzeInput } from "@/lib/engines/orchestrator";
import { getOwnerId } from "@/lib/auth/owner";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

// POST /api/projects/[id]/analyze - run the full analysis pipeline and persist the result.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkEdgeRateLimit(req, "analysis", 30, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const ownerId = getOwnerId(req);
  if (!ownerId) {
    return NextResponse.json(
      { error: "Project ownership cookie is missing." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const project = await db.project.findFirst({ where: { id, ownerId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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

  const ownerId = getOwnerId(req);
  if (!ownerId) {
    return NextResponse.json(
      { error: "Project ownership cookie is missing." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const project = await db.project.findFirst({ where: { id, ownerId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const latest = await db.analysis.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latest) {
      return NextResponse.json({ error: "No analysis yet", hasAnalysis: false }, { status: 404 });
    }

    return NextResponse.json({
      analysisId: latest.id,
      result: JSON.parse(latest.resultJson),
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
