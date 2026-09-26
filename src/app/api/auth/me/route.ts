import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { user: null },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[auth-me]", error);
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
