"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useJalDrishti, type ViewKey } from "@/lib/stores/jaldrishti-store";
import { Header } from "@/components/jaldrishti/Header";
import { Footer } from "@/components/jaldrishti/Footer";
import { HomeView } from "@/components/jaldrishti/views/HomeView";
import { AnalyzeView } from "@/components/jaldrishti/views/AnalyzeView";
import { DashboardView } from "@/components/jaldrishti/views/DashboardView";
import { ScenariosView } from "@/components/jaldrishti/views/ScenariosView";
import { ReportView } from "@/components/jaldrishti/views/ReportView";
import { ExplainView } from "@/components/jaldrishti/views/ExplainView";
import { AuthorityView } from "@/components/jaldrishti/views/AuthorityView";
import { AboutView } from "@/components/jaldrishti/views/AboutView";
import { useSessionUser } from "@/hooks/use-session-user";
import { useHydrateProject } from "@/hooks/use-hydrate-project";

/**
 * The shared chrome and screen switcher.
 *
 * When `view` is omitted the shell follows the Zustand view field, which is
 * how the five original screens work. When a real route passes a `view`, that
 * screen wins, so `/report` stays on the report even though `setView` may have
 * been called elsewhere.
 */
export function AppShell({ view, projectId }: { view?: ViewKey; projectId?: string | null }) {
  const { view: storeView } = useJalDrishti();
  const active: ViewKey = view ?? storeView;

  useSessionUser();
  useHydrateProject(projectId ?? null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header activeView={active} />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {active === "home" && <HomeView />}
            {active === "analyze" && <AnalyzeView />}
            {active === "dashboard" && <DashboardView />}
            {active === "scenarios" && <ScenariosView />}
            {active === "report" && <ReportView projectId={projectId ?? null} />}
            {active === "explanation" && <ExplainView projectId={projectId ?? null} />}
            {active === "authority" && <AuthorityView />}
            {active === "about" && <AboutView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
