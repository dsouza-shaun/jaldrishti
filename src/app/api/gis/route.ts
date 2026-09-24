import { NextResponse } from "next/server";
import { asFeatureCollection, allLayersAsFeatureCollection } from "@/lib/data/ecological-zones";

// GET /api/gis              -> all layers
// GET /api/gis?layer=esz    -> only ESZ
export async function GET(req: Request) {
  const url = new URL(req.url);
  const layer = url.searchParams.get("layer");
  if (layer && ["esz", "forest", "wetland", "crz"].includes(layer)) {
    return NextResponse.json(asFeatureCollection(layer as "esz" | "forest" | "wetland" | "crz"));
  }
  return NextResponse.json(allLayersAsFeatureCollection());
}
