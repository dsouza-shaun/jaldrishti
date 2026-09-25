import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";

export const OWNER_COOKIE = "jaldrishti_owner";
const OWNER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createOwnerId(): string {
  return randomUUID();
}

export function getOwnerId(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OWNER_COOKIE}=`))
    ?.slice(OWNER_COOKIE.length + 1);
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return OWNER_ID_PATTERN.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function setOwnerCookie(response: NextResponse, ownerId: string): void {
  response.cookies.set({
    name: OWNER_COOKIE,
    value: ownerId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function isValidOwnerId(value: string | null | undefined): value is string {
  return Boolean(value && OWNER_ID_PATTERN.test(value));
}
