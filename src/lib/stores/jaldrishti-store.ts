/**
 * JalDrishti global UI state.
 */

import { create } from "zustand";

export interface ProjectInput {
  projectName: string;
  latitude: number;
  longitude: number;
  itLoad: number;
  pue: number;
  wue: number;
  coolingType: string;
  builtUpArea?: number;
  landTenure: string;
  proposedWaterSource: string;
  alternativeWaterSource?: string;
  notes?: string;
}

export interface AnalysisResult {
  projectId: string;
  projectName: string;
  site: { latitude: number; longitude: number; pointWkt: string; crs: string };
  siteData: {
    location: Record<string, unknown> | null;
    climate: Record<string, unknown> | null;
    nearbyPowerPlants: Array<Record<string, unknown>>;
    landCover: Record<string, unknown> | null;
    failures: Array<{ provider: string; message: string }>;
    reusedAt?: string | null;
  };
  waterDemand: Record<string, number | string | object>;
  groundwater: Record<string, unknown>;
  rainfall: Record<string, unknown>;
  ecology: Record<string, unknown>;
  regulatory: Record<string, unknown>;
  power: Record<string, unknown>;
  constraints: Array<Record<string, unknown>>;
  evidenceGaps: Array<Record<string, unknown>>;
  classification: {
    classification: string;
    reasons: string[];
    hardConstraints: Array<Record<string, unknown>>;
    softConstraints: Array<Record<string, unknown>>;
    evidenceGaps: Array<Record<string, unknown>>;
    trace: Array<{ step: string; result: string }>;
  };
  generatedAt: string;
}

export interface ScenarioResult {
  id: string;
  label: string;
  createdAt: string;
  result: AnalysisResult;
}

interface JalDrishtiState {
  // Inputs
  form: ProjectInput;
  setForm: (patch: Partial<ProjectInput>) => void;
  resetForm: () => void;

  // Currently displayed project + analysis
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  analysis: AnalysisResult | null;
  setAnalysis: (a: AnalysisResult | null) => void;

  analyzing: boolean;
  setAnalyzing: (b: boolean) => void;

  // What-if scenarios
  scenarios: ScenarioResult[];
  setScenarios: (s: ScenarioResult[]) => void;
  addScenario: (s: ScenarioResult) => void;

  // AI explanation
  aiExplanation: string | null;
  aiLoading: boolean;
  setAiExplanation: (s: string | null) => void;
  setAiLoading: (b: boolean) => void;

  // Map selection
  selectedPolygon: { name: string; layer: string; category?: string; source?: string; sourceDate?: string; evidenceStatus?: string } | null;
  setSelectedPolygon: (p: JalDrishtiState["selectedPolygon"]) => void;

  // Active tab
  activeTab: "dashboard" | "whatif" | "evidence" | "rules";
  setActiveTab: (t: JalDrishtiState["activeTab"]) => void;

  // View router (state-based, single Next.js route)
  view: "home" | "analyze" | "dashboard" | "scenarios" | "about";
  setView: (v: JalDrishtiState["view"]) => void;
}

const DEFAULT_FORM: ProjectInput = {
  projectName: "Taloja DC Park - Building 1",
  latitude: 19.0418,
  longitude: 73.0856,
  itLoad: 100,
  pue: 1.4,
  wue: 1.5,
  coolingType: "water-cooled-chiller",
  builtUpArea: 80000,
  landTenure: "midc",
  proposedWaterSource: "groundwater",
  alternativeWaterSource: "municipal",
  notes: "Hypothetical 100 MW data-centre campus at Taloja MIDC phase 2.",
};

export const useJalDrishti = create<JalDrishtiState>((set) => ({
  form: DEFAULT_FORM,
  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
  resetForm: () => set({ form: DEFAULT_FORM }),

  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  analysis: null,
  setAnalysis: (a) => set({ analysis: a }),

  analyzing: false,
  setAnalyzing: (b) => set({ analyzing: b }),

  scenarios: [],
  setScenarios: (s) => set({ scenarios: s }),
  addScenario: (s) => set((st) => ({ scenarios: [s, ...st.scenarios].slice(0, 8) })),

  aiExplanation: null,
  aiLoading: false,
  setAiExplanation: (s) => set({ aiExplanation: s }),
  setAiLoading: (b) => set({ aiLoading: b }),

  selectedPolygon: null,
  setSelectedPolygon: (p) => set({ selectedPolygon: p }),

  activeTab: "dashboard",
  setActiveTab: (t) => set({ activeTab: t }),

  view: "home",
  setView: (v) => set({ view: v }),
}));
