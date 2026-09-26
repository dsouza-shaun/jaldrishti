import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  readSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth/session";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(64),
  password: z.string().min(1, "Password is required.").max(200),
  // The role is chosen on the form and checked against the account, so a user
  // cannot reach the wrong workspace by picking the wrong tile.
  role: z.enum(["DEVELOPER", "AUTHORITY"]),
});

const GENERIC_FAILURE = "Invalid username or password.";

export async function POST(req: NextRequest) {
  const rate = checkEdgeRateLimit(req, "auth-login", 20, 10 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  let parsed;
  try {
    parsed = credentialsSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: GENERIC_FAILURE },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { username, password, role } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { username } });

    // One message for "no such user" and "wrong password" so the form cannot
    // be used to enumerate accounts.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: GENERIC_FAILURE },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (user.role !== role) {
      const label = role === "DEVELOPER" ? "a Developer" : "an Authority";
      return NextResponse.json(
        { error: `This account is not registered as ${label}.` },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json(
      {
        user: {
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          organisation: user.organisation,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    console.error("[auth-login]", error);
    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const token = readSessionToken(req);
  if (token) {
    await destroySession(token).catch(() => undefined);
  }
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearSessionCookie(response);
  return response;
}
