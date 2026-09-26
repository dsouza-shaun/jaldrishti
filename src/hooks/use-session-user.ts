"use client";

import { useEffect } from "react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";

/**
 * Load the signed-in account into the store on mount.
 *
 * The page is reachable only through middleware, but the session is still
 * confirmed against the database here so the role shown in the header and the
 * role enforced by the API can never silently disagree.
 */
export function useSessionUser() {
  const { user, setUser } = useJalDrishti();

  useEffect(() => {
    if (user) return;
    const controller = new AbortController();

    fetch("/api/auth/me", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data: { user?: unknown }) => {
        if (data.user) setUser(data.user as never);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [user, setUser]);

  return user;
}
