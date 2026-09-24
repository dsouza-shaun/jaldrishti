import { NextResponse } from "next/server";
import { asFeatureCollection } from "@/lib/data/ecological-zones";

// GET /api/gis/[layer]  -> returns GeoJSON for esz|forest|wetland|crz
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ layer: string }> }
) {
  const { layer } = await params;
  if (!["esz", "forest", "wetland", "crz"].includes(layer)) {
    return NextResponse.json({ error: "Invalid layer" }, { status: 400 });
  }
  return NextResponse.json(asFeatureCollection(layer as "esz" | "forest" | "wetland" | "crz"));
}
