"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Building2, HardHat, Loader2 } from "lucide-react";

type Role = "DEVELOPER" | "AUTHORITY";

const ROLES: Array<{
  value: Role;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "DEVELOPER",
    label: "Developer",
    blurb: "Submit a site and run a screening",
    icon: HardHat,
  },
  {
    value: "AUTHORITY",
    label: "Authority",
    blurb: "Review submitted screenings",
    icon: Building2,
  },
];

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("DEVELOPER");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Unable to sign in. Please try again.");
        return;
      }

      // The requested page wins when it is still valid for the role, otherwise
      // each role lands on its own starting point.
      const landing = role === "AUTHORITY" ? "/authority" : "/";
      router.replace(next ?? landing);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="nb-card p-5 sm:p-6" noValidate>
      <fieldset className="mb-5">
        <legend className="nb-label">Sign in as</legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((option) => {
            const Icon = option.icon;
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                aria-pressed={selected}
                className={`border-[3px] border-black p-3 text-left transition-colors ${
                  selected
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--nb-tint)]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-bold uppercase tracking-wide">
                    {option.label}
                  </span>
                </span>
                <span
                  className={`mt-1 block text-[11px] leading-tight ${
                    selected ? "text-[var(--paper)]/75" : "text-[var(--nb-muted)]"
                  }`}
                >
                  {option.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-4">
        <label className="nb-label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className="nb-input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </div>

      <div className="mb-5">
        <label className="nb-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="nb-input"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 border-[3px] border-black bg-[var(--accent-red)] px-3 py-2 text-sm font-semibold text-white"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="nb-btn nb-btn-primary w-full justify-center !py-3 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Droplets className="h-4 w-4" />
        )}
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
