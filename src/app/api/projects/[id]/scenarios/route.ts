import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  analyzeScenario,
  type AnalysisResult,
  type AnalyzeInput,
} from "@/lib/engines/orchestrator";
import type { SiteDataContext } from "@/lib/data/site-data";
import { getOwnerId } from "@/lib/auth/owner";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import {
  scenarioInputSchema,
  validationMessage,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

// POST /api/projects/[id]/scenarios - run a what-if scenario
//
// Body:
//   { label, itLoad?, pue?, wue?, coolingType?, proposedWaterSource? }
//
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkEdgeRateLimit(req, "scenarios", 60, 60 * 60_000);
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

    const rawBody = await req.json();
    const parsedBody = scenarioInputSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Invalid scenario input",
          details: validationMessage(parsedBody.error),
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const body = parsedBody.data;
    const label: string = body.label ?? `Scenario ${new Date().toISOString()}`;

    const base: AnalyzeInput = {
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

    const latestAnalysis = await db.analysis.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    });
    const siteData = latestAnalysis
      ? (JSON.parse(latestAnalysis.resultJson) as AnalysisResult).siteData
      : undefined;

    const result = await analyzeScenario(
      base,
      {
        itLoad: body.itLoad,
        pue: body.pue,
        wue: body.wue,
        coolingType: body.coolingType,
        proposedWaterSource: body.proposedWaterSource,
      },
      siteData,
    );

    const saved = await db.scenario.create({
      data: {
        projectId: project.id,
        label,
        itLoad: body.itLoad ?? project.itLoad,
        pue: body.pue ?? project.pue,
        wue: body.wue ?? project.wue,
        coolingType: body.coolingType ?? project.coolingType,
        proposedWaterSource: body.proposedWaterSource ?? project.proposedWaterSource,
        resultJson: JSON.stringify(result),
      },
    });

    return NextResponse.json({ scenarioId: saved.id, result }, { status: 200 });
  } catch (error) {
    console.error("[scenario]", error);
    return NextResponse.json(
      { error: "Unable to process the scenario request." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// GET /api/projects/[id]/scenarios - list all scenarios for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkEdgeRateLimit(req, "scenarios", 60, 60 * 60_000);
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
    const project = await db.project.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    const scenarios = await db.scenario.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      scenarios: scenarios.map((s) => ({
        id: s.id,
        label: s.label,
        createdAt: s.createdAt,
        result: JSON.parse(s.resultJson),
      })),
    });
  } catch (error) {
    console.error("[scenario]", error);
    return NextResponse.json(
      { error: "Unable to process the scenario request." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
