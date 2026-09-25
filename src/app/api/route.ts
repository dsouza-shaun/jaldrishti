import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "JalDrishti",
    status: "ok",
    dataIntegration: {
      datasets: "/api/datasets",
      location: "/api/geocode?lat=&lng=",
      climate: "/api/climate?lat=&lng=",
      environment: "/api/environment?lat=&lng=",
    },
  });
}
