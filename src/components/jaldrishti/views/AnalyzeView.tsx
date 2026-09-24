"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { COOLING_TECH_WUE_BANDS, defaultWueForCooling } from "@/lib/engines/water-demand";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Rocket, RotateCcw, MapPin, Settings2, Droplets, Building2, ChevronRight, CheckCircle2,
} from "lucide-react";
import { useState } from "react";

const COOLING_OPTIONS = Object.keys(COOLING_TECH_WUE_BANDS);
const LAND_TENURES = [
  { value: "midc", label: "MIDC Industrial" },
  { value: "private-freehold", label: "Private / Freehold" },
  { value: "other", label: "Other" },
];
const WATER_SOURCES = [
  { value: "groundwater", label: "Groundwater (borewell)" },
  { value: "surface", label: "Surface water (river/dam)" },
  { value: "municipal", label: "Municipal supply" },
  { value: "tanker", label: "Tanker" },
  { value: "mixed", label: "Mixed" },
];

const PRESET_SITES = [
  { name: "Taloja MIDC, Raigad", lat: 19.0418, lng: 73.0856 },
  { name: "Navi Mumbai, Mahape", lat: 19.1086, lng: 73.0210 },
  { name: "Mumbai, BKC", lat: 19.0640, lng: 72.8693 },
  { name: "Pune, Hinjewadi", lat: 18.5915, lng: 73.7388 },
  { name: "Hyderabad, HITEC City", lat: 17.4435, lng: 78.3772 },
  { name: "Chennai, OMR", lat: 12.8250, lng: 80.2228 },
];

export function AnalyzeView() {
  const { form, setForm, resetForm, analyzing, currentProjectId, setView } = useJalDrishti();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const onAnalyze = async () => {
    const { setAnalyzing, setAnalysis, setCurrentProjectId, setScenarios, setAiExplanation } = useJalDrishti.getState();
    setSubmitting(true);
    setAnalyzing(true);
    setAnalysis(null);
    setScenarios([]);
    setAiExplanation(null);
    try {
      // Always create a fresh project so the form values are the source of truth.
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create project");
      const data = await res.json();
      const pid = data.project.id;
      setCurrentProjectId(pid);

      const aRes = await fetch(`/api/projects/${pid}/analyze`, { method: "POST" });
      if (!aRes.ok) throw new Error((await aRes.json()).error ?? "Failed to analyze");
      const aData = await aRes.json();
      setAnalysis(aData.result);

      // Success toast
      toast({
        title: "Screening complete",
        description: `Classification: ${aData.result.classification.classification}. View the full dashboard below.`,
      });

      // Jump to dashboard once analysis is ready
      setView("dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({
        title: "Screening failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 md:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-red)]">
          Step 1 of 1
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight">
          Tell us about your project.
        </h1>
        <p className="text-base sm:text-lg text-black/70 max-w-2xl">
          Fill in the project details and proposed site coordinates. JalDrishti
          will run a full screening and take you to the dashboard.
        </p>
      </motion.div>

      {/* Site & coordinates */}
      <motion.section
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 80 }}
        className="nb-card p-5 sm:p-7"
      >
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--accent-red)] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_0_#000]"
          >
            <MapPin className="w-5 h-5 text-white" />
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-extrabold">Site & coordinates</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <Field label="Project name" full>
            <input
              className="nb-input"
              value={form.projectName}
              onChange={(e) => setForm({ projectName: e.target.value })}
              placeholder="e.g. Taloja DC Park - Building 1"
            />
          </Field>

          <Field label="Latitude">
            <input
              type="number"
              step="0.0001"
              className="nb-input"
              value={form.latitude}
              onChange={(e) => setForm({ latitude: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="0.0001"
              className="nb-input"
              value={form.longitude}
              onChange={(e) => setForm({ longitude: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label="Quick site presets">
            <select
              className="nb-input"
              value=""
              onChange={(e) => {
                const p = PRESET_SITES.find((s) => s.name === e.target.value);
                if (p) setForm({ latitude: p.lat, longitude: p.lng, projectName: p.name + " DC" });
              }}
            >
              <option value="">— pick a known site —</option>
              {PRESET_SITES.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </motion.section>

      {/* Project parameters */}
      <motion.section
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 80 }}
        className="nb-card p-5 sm:p-7"
      >
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--accent-yellow)] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_0_#000]"
          >
            <Settings2 className="w-5 h-5" />
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-extrabold">Project parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <Field label="IT load (MW)">
            <input
              type="number"
              step="0.1"
              className="nb-input"
              value={form.itLoad}
              onChange={(e) => setForm({ itLoad: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label="PUE">
            <input
              type="number"
              step="0.01"
              className="nb-input"
              value={form.pue}
              onChange={(e) => setForm({ pue: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label={`WUE (L/kWh)${form.wue ? "" : " — using default"}`}>
            <input
              type="number"
              step="0.01"
              className="nb-input"
              value={form.wue}
              onChange={(e) => setForm({ wue: parseFloat(e.target.value) })}
              placeholder={String(defaultWueForCooling(form.coolingType))}
            />
          </Field>

          <Field label="Cooling technology">
            <select
              className="nb-input"
              value={form.coolingType}
              onChange={(e) => {
                const ct = e.target.value;
                setForm({ coolingType: ct, wue: defaultWueForCooling(ct) });
              }}
            >
              {COOLING_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())} (typ. WUE {COOLING_TECH_WUE_BANDS[c].typical})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Built-up area (m²)">
            <input
              type="number"
              step="100"
              className="nb-input"
              value={form.builtUpArea ?? ""}
              onChange={(e) => setForm({ builtUpArea: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="e.g. 80000"
            />
          </Field>

          <Field label="Land tenure">
            <select
              className="nb-input"
              value={form.landTenure}
              onChange={(e) => setForm({ landTenure: e.target.value })}
            >
              {LAND_TENURES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </motion.section>

      {/* Water source */}
      <motion.section
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 80 }}
        className="nb-card p-5 sm:p-7"
      >
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--accent-purple)] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_0_#000]"
          >
            <Droplets className="w-5 h-5 text-white" />
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-extrabold">Water source</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <Field label="Proposed water source">
            <select
              className="nb-input"
              value={form.proposedWaterSource}
              onChange={(e) => setForm({ proposedWaterSource: e.target.value })}
            >
              {WATER_SOURCES.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Alternative water source (if any)">
            <input
              className="nb-input"
              value={form.alternativeWaterSource ?? ""}
              onChange={(e) => setForm({ alternativeWaterSource: e.target.value || undefined })}
              placeholder="e.g. municipal, tanker"
            />
          </Field>
          <Field label="Notes">
            <input
              className="nb-input"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ notes: e.target.value || undefined })}
              placeholder="Anything else the engine should know"
            />
          </Field>
        </div>
      </motion.section>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center gap-4"
      >
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ y: 0 }}
          onClick={onAnalyze}
          disabled={submitting || analyzing}
          className="nb-btn nb-btn-primary text-base sm:text-lg !py-3 sm:!py-3.5 !px-5 sm:!px-7"
        >
          {submitting || analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
          {submitting || analyzing ? "Screening..." : "Run screening"}
          {!submitting && !analyzing && <ChevronRight className="w-5 h-5" />}
        </motion.button>
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ y: 0 }}
          onClick={resetForm}
          className="nb-btn text-base sm:text-lg !py-3 sm:!py-3.5 !px-5 sm:!px-7"
          disabled={submitting || analyzing}
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </motion.button>
      </motion.div>

      {/* Tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="nb-card-flat p-5 flex items-start gap-3"
        style={{ background: "var(--accent-yellow)" }}
      >
        <Building2 className="w-5 h-5 mt-0.5 shrink-0" />
        <p className="text-base">
          <strong>Tip:</strong> Use the quick site presets for known industrial
          areas. You can fine-tune coordinates manually for greater accuracy.
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-3" : ""}>
      <label className="nb-label">{label}</label>
      {children}
    </div>
  );
}
