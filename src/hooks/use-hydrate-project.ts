"use client";

import { useEffect } from "react";
import { useJalDrishti, type ProjectInputs } from "@/lib/stores/jaldrishti-store";

/**
 * Re-read a project and its latest analysis when the store is empty.
 *
 * The analysis lives in memory, so opening a deep link such as /report after a
 * reload would otherwise render an empty page even though the project is on the
 * server. This refetches the persisted result and puts it back in the store.
 *
 * Scenarios are intentionally not restored here: they are a working session for
 * the scenario page, and the report reads them from the API when needed.
 */
export function useHydrateProject(projectId: string | null) {
  const { currentProjectId, analysis, setCurrentProjectId, setAnalysis, setProject } =
    useJalDrishti();

  useEffect(() => {
    if (!projectId) return;
    if (currentProjectId === projectId && analysis) return;

    const controller = new AbortController();

    fetch(`/api/projects/${projectId}/analyze`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data:
            | { result?: unknown; hasAnalysis?: boolean; project?: ProjectInputs }
            | null,
        ) => {
          if (!data?.hasAnalysis || !data.result) return;
          setCurrentProjectId(projectId);
          setAnalysis(data.result as never);
          if (data.project) setProject(data.project);
        },
      )
      .catch(() => undefined);

    return () => controller.abort();
  }, [projectId, currentProjectId, analysis, setCurrentProjectId, setAnalysis, setProject]);
}
