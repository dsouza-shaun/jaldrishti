"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Header } from "@/components/jaldrishti/Header";
import { Footer } from "@/components/jaldrishti/Footer";
import { HomeView } from "@/components/jaldrishti/views/HomeView";
import { AnalyzeView } from "@/components/jaldrishti/views/AnalyzeView";
import { DashboardView } from "@/components/jaldrishti/views/DashboardView";
import { ScenariosView } from "@/components/jaldrishti/views/ScenariosView";
import { AboutView } from "@/components/jaldrishti/views/AboutView";

export default function Home() {
  const { view } = useJalDrishti();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {view === "home" && <HomeView />}
            {view === "analyze" && <AnalyzeView />}
            {view === "dashboard" && <DashboardView />}
            {view === "scenarios" && <ScenariosView />}
            {view === "about" && <AboutView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
