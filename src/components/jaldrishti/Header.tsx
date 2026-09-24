"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Home, Search, LayoutDashboard, FlaskConical, Info, Menu, X, AlertCircle } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const NAV = [
  { key: "home",       label: "Home",         icon: Home,            requiresAnalysis: false },
  { key: "analyze",    label: "New Analysis", icon: Search,          requiresAnalysis: false },
  { key: "dashboard",  label: "Dashboard",    icon: LayoutDashboard, requiresAnalysis: true  },
  { key: "scenarios",  label: "Scenarios",    icon: FlaskConical,    requiresAnalysis: true  },
  { key: "about",      label: "About",        icon: Info,            requiresAnalysis: false },
] as const;

export function Header() {
  const { view, setView, analysis } = useJalDrishti();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (item: typeof NAV[number]) => {
    // Dashboard and Scenarios require an analysis to exist
    if (item.requiresAnalysis && !analysis) {
      toast({
        title: "Run an analysis first",
        description: `The ${item.label} is available after you run a screening. Head to "New Analysis" to get started.`,
        variant: "destructive",
        action: {
          label: "New Analysis",
          altText: "Go to New Analysis",
          onClick: () => {
            setView("analyze");
            setMobileOpen(false);
          },
        },
      });
      // Also nudge them gently to the analyze page
      setView("analyze");
      setMobileOpen(false);
      return;
    }
    setView(item.key);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-black bg-[var(--paper)]">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
        {/* Brand */}
        <button
          onClick={() => handleNav(NAV[0])}
          className="flex items-center gap-2 sm:gap-3 group shrink-0"
        >
          <motion.div
            whileHover={{ rotate: -12, scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-[var(--accent-red)] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_0_#000]"
          >
            <Droplets className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
          </motion.div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl md:text-[26px] font-extrabold leading-none tracking-tight">
              Jal<span className="text-[var(--accent-red)]">Drishti</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-black/60 mt-0.5 hidden sm:block">
              Water intelligence for data centres
            </p>
          </div>
        </button>

        {/* Desktop nav - shows on tablet+ */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
          {NAV.map((item) => {
            const active = view === item.key;
            const Icon = item.icon;
            const disabled = item.requiresAnalysis && !analysis;
            return (
              <motion.button
                key={item.key}
                onClick={() => handleNav(item)}
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className={`relative px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[15px] font-bold border-[3px] border-black transition-colors flex items-center gap-1 sm:gap-1.5 ${
                  active
                    ? "bg-[var(--ink)] text-[var(--paper)] shadow-[3px_3px_0_0_var(--accent-red)]"
                    : disabled
                      ? "bg-[var(--paper)] text-black/55 hover:bg-[var(--accent-yellow)] hover:text-black shadow-[2px_2px_0_0_#000] hover:shadow-[3px_3px_0_0_#000]"
                      : "bg-[var(--paper)] hover:bg-[var(--accent-yellow)] shadow-[2px_2px_0_0_#000] hover:shadow-[3px_3px_0_0_#000]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {/* "Locked" indicator dot for disabled nav items */}
                {disabled && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[var(--accent-red)] border-2 border-black rounded-full"
                    title="Run an analysis first"
                  />
                )}
                {/* Active underline pulse */}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-[3px] left-0 right-0 h-[3px] bg-[var(--accent-red)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Mobile menu button - shows below md (768px) */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden nb-btn !p-2 !border-[3px]"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t-[3px] border-black bg-[var(--paper)]"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              {NAV.map((item) => {
                const active = view === item.key;
                const Icon = item.icon;
                const disabled = item.requiresAnalysis && !analysis;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item)}
                    className={`relative px-4 py-3 text-base font-bold border-[3px] border-black text-left flex items-center gap-2 ${
                      active ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--paper)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {disabled && (
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
