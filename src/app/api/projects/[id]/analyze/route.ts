import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyze, type AnalyzeInput } from "@/lib/engines/orchestrator";

// POST /api/projects/[id]/analyze - run the full analysis pipeline and persist the result.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
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

    const result = analyze(input);

    // Persist the analysis
    const saved = await db.analysis.create({
      data: {
        projectId: project.id,
        resultJson: JSON.stringify(result),
      },
    });

    return NextResponse.json({ analysisId: saved.id, result }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/projects/[id]/analyze - return the most recent analysis for this project.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
