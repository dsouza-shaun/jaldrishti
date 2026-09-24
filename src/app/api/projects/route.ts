import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/projects - create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ["projectName", "latitude", "longitude", "itLoad", "pue", "coolingType", "landTenure", "proposedWaterSource"];
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === "") {
        return NextResponse.json({ error: `Missing required field: ${f}` }, { status: 400 });
      }
    }

    const project = await db.project.create({
      data: {
        projectName: String(body.projectName),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        itLoad: Number(body.itLoad),
        pue: Number(body.pue),
        wue: body.wue != null && body.wue !== "" ? Number(body.wue) : 0,
        coolingType: String(body.coolingType),
        builtUpArea: body.builtUpArea != null && body.builtUpArea !== "" ? Number(body.builtUpArea) : null,
        landTenure: String(body.landTenure),
        proposedWaterSource: String(body.proposedWaterSource),
        alternativeWaterSource: body.alternativeWaterSource ?? null,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/projects - list all projects
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ projects });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
