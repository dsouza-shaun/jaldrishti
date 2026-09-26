import type { Metadata } from "next";
import { LoginForm } from "@/components/jaldrishti/LoginForm";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in - JalDrishti",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in: skip the form. This is a convenience redirect only,
  // it is not the access control, which lives in middleware and the routes.
  const user = await currentUser();
  const { next } = await searchParams;

  if (user) {
    redirect(user.role === "AUTHORITY" ? "/authority" : "/");
  }

  // Only same-site paths are honoured, so `?next=` cannot be used to bounce a
  // freshly authenticated user off to another origin.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-tight">
            Jal<span style={{ color: "var(--accent-red)" }}>Drishti</span>
          </div>
          <p className="mt-1 text-sm text-[var(--nb-muted)]">
            Preliminary Water Feasibility Screening
          </p>
        </div>

        <LoginForm next={target} />

        <p className="mt-6 text-center text-xs text-[var(--nb-muted)]">
          Authorised use only
        </p>
      </div>
    </div>
  );
}
