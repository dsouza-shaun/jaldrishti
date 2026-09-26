/**
 * Edge-safe auth constants.
 *
 * `middleware.ts` runs on the edge runtime and cannot import anything that
 * reaches for the database or Node built-ins, so the cookie name and the
 * presence probe live here rather than in `session.ts`.
 */

export const SESSION_COOKIE = "jaldrishti_session";

/**
 * The only two roles in the product. Declared here rather than in
 * `session.ts` because client components (the Zustand store, the header) need
 * the type without dragging in the database and `node:crypto`.
 */
export type Role = "DEVELOPER" | "AUTHORITY";

export function isRole(value: string): value is Role {
  return value === "DEVELOPER" || value === "AUTHORITY";
}

export const ROLE_LABEL: Record<Role, string> = {
  DEVELOPER: "Developer",
  AUTHORITY: "Authority",
};

/**
 * True when the request carries a non-empty session cookie. This proves
 * nothing on its own: the real check is a database lookup in `getSessionUser`.
 */
export function hasSessionCookie(request: Request): boolean {
  const header = request.headers.get("cookie") ?? "";
  return header
    .split(";")
    .map((part) => part.trim())
    .some(
      (part) =>
        part.startsWith(`${SESSION_COOKIE}=`) &&
        part.length > SESSION_COOKIE.length + 1,
    );
}

/** Read the raw token from a request's cookie header, if present. */
export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return token.length > 0 ? token : null;
}
