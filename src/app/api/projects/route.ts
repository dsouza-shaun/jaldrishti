import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createOwnerId,
  getOwnerId,
  setOwnerCookie,
} from "@/lib/auth/owner";
import {
  projectInputSchema,
  validationMessage,
} from "@/lib/validation/schemas";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

function withoutOwner<T extends { ownerId?: string | null }>(project: T): Omit<T, "ownerId"> {
  const { ownerId: _ownerId, ...publicProject } = project;
  return publicProject;
}

export async function POST(req: NextRequest) {
  const rate = checkEdgeRateLimit(req, "project-create", 30, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const rawBody = await req.json();
    const parsed = projectInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid project input", details: validationMessage(parsed.error) },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const ownerId = getOwnerId(req) ?? createOwnerId();
    const project = await db.project.create({
      data: {
        ownerId,
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
      { project: withoutOwner(project) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    setOwnerCookie(response, ownerId);
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
  const ownerId = getOwnerId(req);
  if (!ownerId) {
    return NextResponse.json(
      { error: "Project ownership cookie is missing." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const projects = await db.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(
      { projects: projects.map(withoutOwner) },
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
