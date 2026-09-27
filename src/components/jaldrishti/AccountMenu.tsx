"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

/**
 * Initials for the account avatar.
 *
 * Takes the first letter of the first two words, so "Developer One" becomes
 * "DO" and "Authority Officer" becomes "AO". Falls back to a single letter for
 * a one-word name, and to "?" when there is no name at all, so the avatar is
 * never an empty box.
 */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0].slice(0, 1) + words[1].slice(0, 1)).toUpperCase();
}

export interface AccountMenuEntry {
  key: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
  tone?: "default" | "danger";
}

export interface AccountIdentity {
  displayName: string;
  username: string;
  role: string;
  organisation: string | null;
}

/**
 * The signed-in account control.
 *
 * An initials avatar rather than a full name in the header, so the navigation
 * keeps its width as the name changes length. Clicking it opens a panel with
 * the identity, the profile details and the sign-out action, which is the
 * convention users already expect from this pattern.
 *
 * Closes on Escape, on an outside click and on a menu selection, and returns
 * focus to the trigger so keyboard users are not stranded.
 */
export function AccountMenu({
  identity,
  entries,
  onSignOut,
}: {
  identity: AccountIdentity;
  entries?: AccountMenuEntry[];
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = initialsOf(identity.displayName);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (entry: AccountMenuEntry) => {
    setOpen(false);
    entry.onSelect?.();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${identity.displayName}`}
        title={`${identity.displayName} (${identity.role})`}
        className="w-9 h-9 sm:w-10 sm:h-10 border-[3px] border-black bg-[var(--ink)] text-[var(--paper)] flex items-center justify-center font-extrabold text-xs sm:text-sm tracking-wide hover:bg-[var(--accent-red)] transition-colors"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 border-[3px] border-black bg-[var(--paper)] shadow-[6px_6px_0_0_var(--ink)]"
        >
          <div className="border-b-[3px] border-black p-3">
            <div className="font-extrabold leading-tight break-words">
              {identity.displayName}
            </div>
            <div className="text-xs text-[var(--nb-muted)] font-mono break-all">
              {identity.username}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="nb-badge !border-0 !p-0 bg-[var(--nb-tint)]">
                {identity.role}
              </span>
              {identity.organisation && (
                <span className="text-xs text-[var(--nb-muted)] break-words">
                  {identity.organisation}
                </span>
              )}
            </div>
          </div>

          {entries && entries.length > 0 && (
            <div className="border-b-[3px] border-black py-1">
              {entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.key}
                    role="menuitem"
                    onClick={() => choose(entry)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--nb-tint)] flex items-start gap-2"
                  >
                    {Icon && <Icon className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{entry.label}</span>
                      {entry.description && (
                        <span className="block text-xs text-[var(--nb-muted)] leading-snug">
                          {entry.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="py-1">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--nb-tint)] flex items-center gap-2"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="text-sm font-bold">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
