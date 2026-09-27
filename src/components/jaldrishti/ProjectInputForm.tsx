"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { COOLING_TECH_WUE_BANDS, defaultWueForCooling } from "@/lib/engines/water-demand";
import { Loader2, Rocket, RotateCcw, ChevronDown } from "lucide-react";
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

export function ProjectInputForm() {
  const { form, setForm, resetForm, analyzing, currentProjectId } = useJalDrishti();
  const [open, setOpen] = useState(true);

  const onAnalyze = async () => {
    const { setAnalyzing, setAnalysis, setCurrentProjectId, setScenarios, setAiExplanation } = useJalDrishti.getState();
    setAnalyzing(true);
    setAnalysis(null);
    setScenarios([]);
    setAiExplanation(null);
    try {
      // 1. Create project (or reuse currentProjectId)
      let pid = currentProjectId;
      if (!pid) {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create project");
        const data = await res.json();
        pid = data.project.id;
        setCurrentProjectId(pid);
      } else {
        // re-create to capture form edits
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create project");
        const data = await res.json();
        pid = data.project.id;
        setCurrentProjectId(pid);
      }

      // 2. Analyze
      const aRes = await fetch(`/api/projects/${pid}/analyze`, { method: "POST" });
      if (!aRes.ok) throw new Error((await aRes.json()).error ?? "Failed to analyze");
      const aData = await aRes.json();
      setAnalysis(aData.result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      alert("Analysis failed: " + msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-5"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black text-[var(--paper)] flex items-center justify-center font-extrabold">1</div>
          <h2 className="text-lg font-extrabold uppercase tracking-tight">Project & Site Inputs</h2>
        </div>
        <ChevronDown className={`w-5 h-5 transition-transform ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Project name */}
          <Field label="Project Name" full>
            <input
              className="nb-input"
              value={form.projectName}
              onChange={(e) => setForm({ projectName: e.target.value })}
              placeholder="e.g. Taloja DC Park - Building 1"
            />
          </Field>

          {/* Coordinates */}
          <Field label="Latitude (decimal degrees)">
            <input
              type="number"
              step="0.0001"
              className="nb-input font-mono"
              value={form.latitude}
              onChange={(e) => setForm({ latitude: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label="Longitude (decimal degrees)">
            <input
              type="number"
              step="0.0001"
              className="nb-input font-mono"
              value={form.longitude}
              onChange={(e) => setForm({ longitude: parseFloat(e.target.value) })}
            />
          </Field>

          {/* Preset sites */}
          <Field label="Quick site presets">
            <select
              className="nb-input"
              value=""
              onChange={(e) => {
                const p = PRESET_SITES.find((s) => s.name === e.target.value);
                if (p) {
                  setForm({ latitude: p.lat, longitude: p.lng, projectName: p.name + " DC" });
                }
              }}
            >
              <option value="">— pick a site —</option>
              {PRESET_SITES.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>

          {/* IT load + PUE + WUE */}
          <Field label="IT Load (MW)">
            <input
              type="number"
              step="0.1"
              className="nb-input font-mono"
              value={form.itLoad}
              onChange={(e) => setForm({ itLoad: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label="PUE">
            <input
              type="number"
              step="0.01"
              className="nb-input font-mono"
              value={form.pue}
              onChange={(e) => setForm({ pue: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label={`WUE (L/kWh)${form.wue ? "" : " — using default"}`}>
            <input
              type="number"
              step="0.01"
              className="nb-input font-mono"
              value={form.wue}
              onChange={(e) => setForm({ wue: parseFloat(e.target.value) })}
              placeholder={String(defaultWueForCooling(form.coolingType))}
            />
          </Field>

          {/* Cooling tech */}
          <Field label="Cooling Technology">
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

          {/* Built-up area */}
          <Field label="Built-up Area (m²)">
            <input
              type="number"
              step="100"
              className="nb-input font-mono"
              value={form.builtUpArea ?? ""}
              onChange={(e) => setForm({ builtUpArea: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="e.g. 80000"
            />
          </Field>

          {/* Land tenure */}
          <Field label="Land Tenure">
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

          {/* Water source */}
          <Field label="Proposed Water Source">
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

          {/* Alternative water source */}
          <Field label="Alternative Water Source (if any)">
            <input
              className="nb-input"
              value={form.alternativeWaterSource ?? ""}
              onChange={(e) => setForm({ alternativeWaterSource: e.target.value || undefined })}
              placeholder="e.g. municipal, tanker"
            />
          </Field>

          {/* Notes */}
          <Field label="Notes" full>
            <textarea
              className="nb-input"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ notes: e.target.value })}
              placeholder="Anything else the rule engine should know about..."
            />
          </Field>

          {/* Actions */}
          <div className="md:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 mt-2">
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className="nb-btn nb-btn-primary"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {analyzing ? "Analyzing..." : "Run Full Analysis"}
            </button>
            <button onClick={resetForm} className="nb-btn" disabled={analyzing}>
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <span className="text-xs font-mono uppercase tracking-wider text-black/60">
              POST /api/projects → POST /api/projects/[id]/analyze
            </span>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2 lg:col-span-3" : ""}>
      <label className="nb-label">{label}</label>
      {children}
    </div>
  );
}
