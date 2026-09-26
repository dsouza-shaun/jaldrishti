/**
 * Session handling for JalDrishti.
 *
 * Sign-in is mandatory: `middleware.ts` refuses any page request that arrives
 * without a session cookie, and every project-scoped API route calls
 * `requireSession` before touching data.
 *
 * Scope of this implementation, stated plainly because it is prototype-grade:
 * credentials are bcrypt-hashed and sessions are server-side rows, but there
 * is no password reset, no email verification, no multi-factor authentication,
 * no lockout after repeated failures and no session revocation list. The
 * existing per-IP rate limiter is the only brute-force mitigation.
 */

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRole, readSessionToken, SESSION_COOKIE } from "@/lib/auth/constants";
import type { Role } from "@/lib/auth/constants";

export {
  SESSION_COOKIE,
  hasSessionCookie,
  readSessionToken,
  isRole,
  ROLE_LABEL,
} from "@/lib/auth/constants";
export type { Role } from "@/lib/auth/constants";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const BCRYPT_ROUNDS = 10;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  organisation: string | null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the signed-in user from the request cookie. Expired sessions are
 * deleted on sight so the table does not grow without bound.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;

  const session = await db.session.findUnique({ where: { token } });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !isRole(user.role)) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    organisation: user.organisation,
  };
}

/** Server-component flavour of `getSessionUser`, reading from next/headers. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !isRole(user.role)) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    organisation: user.organisation,
  };
}

/**
 * Project visibility, in one place so the rule is stated once:
 * a DEVELOPER sees only the projects they submitted; an AUTHORITY sees all of
 * them, because reviewing submitted screenings is their job.
 */
export function projectScopeFor(user: SessionUser): { developerId?: string } {
  return user.role === "DEVELOPER" ? { developerId: user.id } : {};
}

export function canAccessProject(user: SessionUser, project: { developerId: string | null }): boolean {
  if (user.role === "AUTHORITY") return true;
  return project.developerId !== null && project.developerId === user.id;
}
