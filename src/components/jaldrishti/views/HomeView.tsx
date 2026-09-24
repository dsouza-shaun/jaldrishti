"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import {
  Droplets, Search, ShieldAlert, MapPin, Layers, Sparkles, ArrowRight,
  CheckCircle2, AlertTriangle, HelpCircle, XOctagon,
} from "lucide-react";

const FEATURES = [
  {
    icon: Droplets,
    title: "Water demand modelling",
    text: "Deterministic engine turns your IT load, PUE and WUE into precise daily and annual water requirements.",
    color: "var(--accent-red)",
  },
  {
    icon: Layers,
    title: "Spatial intelligence",
    text: "Polygon checks against ESZ, forest, wetland and CRZ layers reveal ecological constraints before you commit.",
    color: "var(--accent-green)",
  },
  {
    icon: ShieldAlert,
    title: "Regulatory screening",
    text: "CGWA groundwater rules, environmental clearance thresholds and pollution-board requirements evaluated upfront.",
    color: "var(--accent-orange)",
  },
  {
    icon: Sparkles,
    title: "Explainable results",
    text: "Every classification comes with a full decision trail — from rule fired to underlying data and source.",
    color: "var(--accent-purple)",
  },
];

const OUTCOMES = [
  { icon: CheckCircle2, label: "Feasible", desc: "No constraints detected.", color: "var(--status-feasible)" },
  { icon: AlertTriangle, label: "Feasible with conditions", desc: "Mitigations or approvals required.", color: "var(--status-conditional)" },
  { icon: HelpCircle, label: "Data insufficient", desc: "Critical evidence missing.", color: "var(--status-insufficient)" },
  { icon: XOctagon, label: "High constraint", desc: "Hard constraint — re-site or pursue clearance.", color: "var(--status-constraint)" },
];

const STATS = [
  { value: 16, suffix: "",  label: "Groundwater blocks mapped" },
  { value: 8,  suffix: "",  label: "IMD rainfall stations" },
  { value: 13, suffix: "",  label: "Ecological polygons" },
  { value: 7,  suffix: "",  label: "Regulatory rules applied" },
];

/** Animated number counter that runs on mount. */
function Counter({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    // Small delay so the spring enter animation finishes first
    const startDelay = 200;
    const startTimer = setTimeout(() => {
      const start = performance.now();
      const duration = 1400;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(eased * value));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, startDelay);
    return () => { clearTimeout(startTimer); cancelAnimationFrame(raf); };
  }, [value]);

  return (
    <span>{display}{suffix}</span>
  );
}

export function HomeView() {
  const { setView } = useJalDrishti();

  return (
    <div className="space-y-10 sm:space-y-16 md:space-y-24 pb-12">
      {/* ============================================================
          HERO
         ============================================================ */}
      <section className="relative pt-6 sm:pt-10 md:pt-16 overflow-hidden">
        {/* Floating decorative blobs - hidden on mobile to save space */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="hidden md:block absolute top-10 right-10 w-24 h-24 bg-[var(--accent-yellow)] border-[3px] border-black rounded-full nb-bob shadow-[6px_6px_0_0_#000]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="hidden md:block absolute top-40 right-40 w-16 h-16 bg-[var(--accent-purple)] border-[3px] border-black rounded-full nb-bob shadow-[4px_4px_0_0_#000]"
          style={{ animationDelay: "1s" }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, type: "spring" }}
          className="hidden md:block absolute top-32 right-72 w-12 h-12 bg-[var(--accent-green)] border-[3px] border-black nb-spin-slow shadow-[3px_3px_0_0_#000]"
        />
        {/* Extra: a triangle that spins the other way */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, type: "spring" }}
          className="hidden md:block absolute top-72 right-28 w-10 h-10 bg-[var(--accent-orange)] border-[3px] border-black nb-spin-slow-rev"
          style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
        />

        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-5 sm:mb-6"
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="w-2 h-2 bg-[var(--accent-green)] rounded-full"
            />
            Pre-development site intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] tracking-tighter max-w-5xl"
          >
            {"Know the water risk".split(" ").map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="inline-block mr-2 sm:mr-3"
              >
                {word}
              </motion.span>
            ))}
            <br />
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              className="text-[var(--accent-red)] inline-block"
            >
              before
            </motion.span>{" "}
            you build.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-base sm:text-lg md:text-2xl text-black/75 mt-5 sm:mt-6 max-w-3xl leading-relaxed"
          >
            JalDrishti screens proposed data centre sites in India for water,
            ecological, and regulatory constraints — turning days of due
            diligence into a transparent, explainable report.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <motion.button
              whileHover={{ y: -3 }}
              whileTap={{ y: 0 }}
              onClick={() => setView("analyze")}
              className="nb-btn nb-btn-primary text-base sm:text-lg !py-3 sm:!py-3.5 !px-5 sm:!px-7"
            >
              <Search className="w-5 h-5" />
              <span className="hidden sm:inline">Start screening</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ y: -3 }}
              whileTap={{ y: 0 }}
              onClick={() => setView("about")}
              className="nb-btn nb-btn-accent text-base sm:text-lg !py-3 sm:!py-3.5 !px-5 sm:!px-7"
            >
              How it works
            </motion.button>
          </motion.div>

          {/* Animated stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-10 sm:mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
          >
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + i * 0.1, type: "spring" }}
                className="nb-card-flat p-3 sm:p-4 text-center"
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--accent-red)]">
                  <Counter value={s.value} suffix={s.suffix} />
                </div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-black/70 mt-1 leading-tight">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============================================================
          FEATURES
         ============================================================ */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-8 sm:mb-10"
        >
          <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-red)] mb-2">
            What you get
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            Four lenses on every site, in one report.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 80 }}
                whileHover={{ y: -4 }}
                className="nb-card p-5 sm:p-7"
              >
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-12 h-12 sm:w-14 sm:h-14 border-[3px] border-black flex items-center justify-center mb-3 sm:mb-4 shadow-[3px_3px_0_0_#000]"
                  style={{ background: f.color }}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.2} />
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-extrabold mb-2">{f.title}</h3>
                <p className="text-sm sm:text-base text-black/70 leading-relaxed">{f.text}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          OUTCOMES
         ============================================================ */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-8 sm:mb-10"
        >
          <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-red)] mb-2">
            Clear outcomes
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            No black-box score. Just an honest answer.
          </h2>
          <p className="text-base sm:text-lg text-black/70 mt-3 max-w-2xl">
            Every site is classified into one of four categories — each one
            backed by traceable evidence and a clear next step.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {OUTCOMES.map((o, i) => {
            const Icon = o.icon;
            return (
              <motion.div
                key={o.label}
                initial={{ opacity: 0, scale: 0.85, rotate: -3 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 120 }}
                whileHover={{ y: -6, rotate: i % 2 === 0 ? 1 : -1 }}
                className="nb-card-flat p-4 sm:p-5"
                style={{ background: o.color }}
              >
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Icon className="w-8 h-8 sm:w-9 sm:h-9 mb-3" strokeWidth={2.2} />
                </motion.div>
                <div className="text-base sm:text-lg font-extrabold leading-tight">{o.label}</div>
                <div className="text-xs sm:text-sm mt-1 opacity-80">{o.desc}</div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          CTA
         ============================================================ */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="nb-card p-6 sm:p-10 md:p-14 text-center relative overflow-hidden"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          {/* Animated gradient blob in CTA card */}
          <motion.div
            animate={{
              x: [0, 60, 0],
              y: [0, -40, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, var(--accent-red), transparent 70%)" }}
          />
          <motion.div
            animate={{
              x: [0, -50, 0],
              y: [0, 30, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, var(--accent-yellow), transparent 70%)" }}
          />

          <h2 className="relative text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight mb-3 sm:mb-4">
            Ready to screen a site?
          </h2>
          <p className="relative text-base sm:text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-6 sm:mb-8">
            Enter your project details and coordinates. Get a full feasibility
            breakdown in seconds.
          </p>
          <motion.button
            whileHover={{ y: -3, scale: 1.03 }}
            whileTap={{ y: 0, scale: 0.98 }}
            onClick={() => setView("analyze")}
            className="nb-btn nb-btn-accent text-base sm:text-lg !py-3 sm:!py-3.5 !px-6 sm:!px-8 mx-auto relative"
          >
            <Search className="w-5 h-5" />
            <span className="hidden sm:inline">Start screening</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </section>
    </div>
  );
}
