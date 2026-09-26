"use client";

import { useMemo } from "react";
import { useJalDrishti, type AnalysisResult, type ProjectInputs } from "@/lib/stores/jaldrishti-store";

/**
 * The client-side subset of a report input.
 *
 * The report page and the PDF/Word exports are built server side from the same
 * `ReportInput` type. This hook exists for the few client components that need
 * to derive something from the analysis, such as the recommendation list on the
 * dashboard, without a round trip.
 */
export function useReportInput(): { project: ProjectInputs; analysis: AnalysisResult } | null {
  const { project, analysis } = useJalDrishti();

  return useMemo(() => {
    if (!project || !analysis) return null;
    return { project, analysis };
  }, [project, analysis]);
}
