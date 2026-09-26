"use client";

import { Droplets } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";

export function Footer() {
  const { setView } = useJalDrishti();
  return (
    <footer
      data-nb-chrome
      className="mt-auto bg-[var(--ink)] text-[var(--paper)] border-t-[3px] border-black"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 py-8 sm:py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
        {/* Brand */}
        <div className="sm:col-span-2 md:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[var(--accent-red)] border-[2px] border-[var(--paper)] flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold">JalDrishti</span>
          </div>
          <p className="text-sm text-white/75 leading-relaxed max-w-md">
            A pre-development screening tool that surfaces water, ecological,
            and regulatory constraints for proposed data centre sites in India
            before you invest or build them.
          </p>
          <p className="text-xs text-white/55 mt-4 leading-relaxed max-w-md">
            For screening only. Consult environmental and legal experts before investing.
          </p>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--paper)] mb-3">
            Explore
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <button onClick={() => setView("home")} className="text-white/80 hover:text-[var(--paper)] transition-colors">
                Home
              </button>
            </li>
            <li>
              <button onClick={() => setView("analyze")} className="text-white/80 hover:text-[var(--paper)] transition-colors">
                Run a new analysis
              </button>
            </li>
            <li>
              <button onClick={() => setView("about")} className="text-white/80 hover:text-[var(--paper)] transition-colors">
                How it works
              </button>
            </li>
          </ul>
        </div>

        {/* Outcomes */}
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--paper)] mb-3">
            Outcomes
          </h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-white/80">
              <span className="w-3 h-3 border border-white" style={{ background: "var(--status-feasible)" }} />
              Feasible
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="w-3 h-3 border border-white" style={{ background: "var(--status-conditional)" }} />
              Feasible with conditions
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="w-3 h-3 border border-white" style={{ background: "var(--status-insufficient)" }} />
              Data insufficient
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="w-3 h-3 border border-white" style={{ background: "var(--status-constraint)" }} />
              High constraint
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
