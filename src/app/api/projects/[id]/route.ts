import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessProject, getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
    // A project belonging to another developer is reported as missing rather
    // than forbidden, so the response does not confirm that it exists.
    if (!project || !canAccessProject(user, project)) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { developerId: _developerId, ...publicProject } = project;
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
