"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  Home,
  Search,
  LayoutDashboard,
  FlaskConical,
  FileText,
  Info,
  Menu,
  X,
  AlertCircle,
  LogOut,
  Building2,
} from "lucide-react";
import { useJalDrishti, type ViewKey } from "@/lib/stores/jaldrishti-store";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABEL } from "@/lib/auth/constants";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAnalysis?: boolean;
  /** Screens with a real route link out to it rather than switching in place. */
  routed?: boolean;
  authorityOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "analyze", label: "New Analysis", icon: Search },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, requiresAnalysis: true },
  { key: "scenarios", label: "Scenarios", icon: FlaskConical, requiresAnalysis: true },
  { key: "report", label: "Reports", icon: FileText, requiresAnalysis: true, routed: true },
  { key: "authority", label: "Authority", icon: Building2, routed: true, authorityOnly: true },
  { key: "about", label: "About", icon: Info },
];

export function Header({ activeView }: { activeView: ViewKey }) {
  const { setView, analysis, currentProjectId, user, setUser } = useJalDrishti();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // /report, /explanation and /authority pin their own screen, so switching to
  // one of the in-app views means returning to "/" as well as setting the view.
  const onRoutedPage = pathname !== "/";

  const isAuthority = user?.role === "AUTHORITY";
  const items = NAV.filter((item) => !item.authorityOnly || isAuthority);

  const hrefFor = (item: NavItem): string => {
    if (item.key === "authority") return "/authority";
    if (item.key === "report" && currentProjectId) {
      return `/report?project=${encodeURIComponent(currentProjectId)}`;
    }
    return "/";
  };

  const handleNav = (item: NavItem) => {
    setMobileOpen(false);

    // Dashboard, Scenarios and Reports have nothing to show without a result.
    if (item.requiresAnalysis && !analysis) {
      toast({
        title: "Run an analysis first",
        description: `${item.label} is available once a screening has been run. Head to "New Analysis" to get started.`,
        variant: "destructive",
        action: {
          label: "New Analysis",
          altText: "Go to New Analysis",
          onClick: () => setView("analyze"),
        },
      });
      if (onRoutedPage) {
        router.push("/");
      }
      setView("analyze");
      return;
    }

    if (item.routed) {
      router.push(hrefFor(item));
      return;
    }

    if (onRoutedPage) {
      router.push("/");
    }
    setView(item.key);
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
    } catch {
      // Even if the request fails, drop local state and return to the sign-in
      // page; middleware will refuse any further navigation without a cookie.
    }
    setUser(null);
    setMobileOpen(false);
    router.replace("/login");
    router.refresh();
  };

  return (
    <header
      data-nb-chrome
      className="sticky top-0 z-50 border-b-[3px] border-black bg-[var(--paper)]"
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => handleNav(NAV[0])}
          className="flex items-center gap-2 sm:gap-3 group shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--accent-red)] border-[3px] border-black flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl font-extrabold leading-none tracking-tight">
              Jal<span style={{ color: "var(--accent-red)" }}>Drishti</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--nb-muted)] mt-0.5 hidden sm:block">
              Water feasibility screening
            </p>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-wrap justify-end">
          {items.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={activeView === item.key}
              locked={Boolean(item.requiresAnalysis && !analysis)}
              onClick={() => handleNav(item)}
            />
          ))}
        </nav>

        {/* Account + mobile menu */}
        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <div className="hidden sm:flex items-center gap-2 border-[3px] border-black px-2.5 py-1.5">
              <span className="nb-badge !border-0 !p-0 bg-[var(--nb-tint)]">
                {ROLE_LABEL[user.role]}
              </span>
              <span className="text-xs font-semibold max-w-[9rem] truncate">
                {user.displayName}
              </span>
              <button
                onClick={signOut}
                title="Sign out"
                aria-label="Sign out"
                className="hover:text-[var(--accent-red)]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="lg:hidden nb-btn !p-2"
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden overflow-hidden border-t-[3px] border-black bg-[var(--paper)]"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              {user && (
                <div className="flex items-center justify-between border-[3px] border-black px-3 py-2 mb-1">
                  <div className="min-w-0">
                    <div className="nb-badge !border-0 !p-0 bg-[var(--nb-tint)]">
                      {ROLE_LABEL[user.role]}
                    </div>
                    <div className="text-sm font-bold truncate">{user.displayName}</div>
                  </div>
                  <button
                    onClick={signOut}
                    className="nb-btn !py-1.5 !px-3 text-sm shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}

              {items.map((item) => {
                const active = activeView === item.key;
                const locked = Boolean(item.requiresAnalysis && !analysis);
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item)}
                    className={`relative px-4 py-3 text-base font-bold border-[3px] border-black text-left flex items-center gap-2 ${
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "bg-[var(--paper)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {locked && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--accent-red)]">
                        <AlertCircle className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavButton({
  item,
  active,
  locked,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative px-3 py-2 text-sm font-bold border-[3px] border-black transition-colors flex items-center gap-1.5 ${
        active
          ? "bg-[var(--ink)] text-[var(--paper)]"
          : "bg-[var(--paper)] hover:bg-[var(--nb-tint)]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {item.label}
      {locked && (
        <span
          className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[var(--accent-red)] border-2 border-black"
          title="Run an analysis first"
        />
      )}
      {active && (
        <span className="absolute -bottom-[3px] left-0 right-0 h-[3px] bg-[var(--accent-red)]" />
      )}
    </button>
  );
}
