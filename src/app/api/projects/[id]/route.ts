import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerId } from "@/lib/auth/owner";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    const { ownerId: _ownerId, ...publicProject } = project;
    return NextResponse.json(
      { project: publicProject },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[project-get]", error);
    return NextResponse.json(
      { error: "Unable to load the project." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
