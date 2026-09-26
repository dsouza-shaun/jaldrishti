import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/auth/constants";

/**
 * Sign-in is mandatory.
 *
 * This runs on the edge runtime, so it cannot reach the database. It therefore
 * only checks that a session cookie is present and redirects to /login when it
 * is not. That is a navigation guard, not the security boundary: every
 * project-scoped API route re-verifies the session against the database, and
 * the Authority area re-checks the role in its server page. A user who forges
 * or replays a cookie gets a page shell and nothing else.
 *
 * The role-specific guard for /authority lives in app/authority/page.tsx
 * because it needs the database.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (hasSessionCookie(request)) return NextResponse.next();

  // API routes answer 401 themselves; a redirect would be the wrong shape.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const target = new URL("/login", request.url);
  target.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   - /login            the sign-in page itself
     *   - /api/auth/*       sign-in, sign-out and session probe
     *   - Next.js internals (_next/*)
     *   - public files
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|robots.txt|logo.svg|maplibre-gl-shared.mjs|maplibre-gl-worker.mjs).*)",
  ],
};
