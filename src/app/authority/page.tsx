import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/jaldrishti/AppShell";

/**
 * Authority area.
 *
 * Middleware already refuses anonymous requests, but it cannot read the
 * database, so the role check that actually matters happens here. Both roles
 * are legitimate callers of `/api/auth/me`; only AUTHORITY reaches this screen.
 */
export default async function AuthorityPage() {
  const user = await currentUser();

  if (!user) redirect("/login?next=%2Fauthority");
  if (user.role !== "AUTHORITY") redirect("/");

  return <AppShell view="authority" />;
}
