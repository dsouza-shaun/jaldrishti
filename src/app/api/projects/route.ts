import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, projectScopeFor } from "@/lib/auth/session";
import {
  projectInputSchema,
  validationMessage,
} from "@/lib/validation/schemas";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

/** The owning account is an internal routing detail, not part of the payload. */
function publicProject<T extends { developerId?: string | null }>(project: T): Omit<T, "developerId"> {
  const { developerId: _developerId, ...rest } = project;
  return rest;
}

function unauthorized() {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const rate = checkEdgeRateLimit(req, "project-create", 30, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  // Only a Developer submits project information. An Authority reviews what
  // has been submitted and does not originate screenings.
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (user.role !== "DEVELOPER") {
    return NextResponse.json(
      { error: "Only a Developer account can submit a project for screening." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const rawBody = await req.json();
    const parsed = projectInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid project input", details: validationMessage(parsed.error) },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const project = await db.project.create({
      data: {
        developerId: user.id,
        projectName: parsed.data.projectName,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        itLoad: parsed.data.itLoad,
        pue: parsed.data.pue,
        wue: parsed.data.wue,
        coolingType: parsed.data.coolingType,
        builtUpArea: parsed.data.builtUpArea ?? null,
        landTenure: parsed.data.landTenure,
        proposedWaterSource: parsed.data.proposedWaterSource,
        alternativeWaterSource: parsed.data.alternativeWaterSource ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    const response = NextResponse.json(
      { project: publicProject(project) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    return response;
  } catch (error) {
    console.error("[project-create]", error);
    return NextResponse.json(
      { error: "Unable to create the project." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    // A Developer sees only their own submissions. An Authority sees every
    // project, because the review queue spans all developers.
    const projects = await db.project.findMany({
      where: projectScopeFor(user),
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: { select: { analyses: true, reviews: true } },
      },
    });
    return NextResponse.json(
      { projects: projects.map(publicProject) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[project-list]", error);
    return NextResponse.json(
      { error: "Unable to list projects." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
