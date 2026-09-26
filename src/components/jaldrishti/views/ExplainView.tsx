"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, FileText, ArrowLeft } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";

/**
 * The AI-assisted explanation, on its own page.
 *
 * The screening result is produced by deterministic rules and is not affected by
 * anything on this page. The explanation is generated text: it restates the
 * result in plain language, summarises the evidence and drafts follow-up
 * questions. It cannot assign feasibility, introduce a threshold, or state that
 * a requirement is met.
 */
export function ExplainView({ projectId }: { projectId: string | null }) {
  const {
    analysis,
    currentProjectId,
    aiExplanation,
    aiLoading,
    setAiExplanation,
    setAiLoading,
    setView,
  } = useJalDrishti();
  const router = useRouter();
  const [stored, setStored] = useState<string | null>(null);
  // Set once the lookup settles, so a project that was never screened reports
  // that fact instead of appearing to load forever.
  const [checked, setChecked] = useState(false);

  // The URL carries the project id while the analysis arrives through store
  // hydration, so either one is enough to know which project is being explained.
  const target = currentProjectId ?? projectId;

  // A deep link into this page has an empty store, so pick up an explanation
  // that was generated on an earlier visit rather than showing a blank page.
  useEffect(() => {
    if (aiExplanation || !target) return;
    const controller = new AbortController();
    fetch(`/api/projects/${target}/analyze`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { explanation?: string | null } | null) => {
        if (data?.explanation) {
          setStored(data.explanation);
          setAiExplanation(data.explanation);
        }
      })
      .catch(() => undefined)
      .finally(() => setChecked(true));
    return () => controller.abort();
  }, [aiExplanation, target, setAiExplanation]);

  if (!analysis) {
    const stillLoading = Boolean(target) && !checked;
    return (
      <div className="max-w-[900px] mx-auto px-4 py-16 text-center">
        <div className="nb-card p-8">
          {stillLoading ? (
            <>
              <h1 className="text-2xl font-extrabold">Loading the screening</h1>
              <p className="text-sm text-[var(--nb-muted)] mt-2">
                Fetching the result this explanation summarises.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold">No screening to explain</h1>
              <p className="text-sm text-[var(--nb-muted)] mt-2">
                Run a screening first. The explanation summarises an existing result.
              </p>
              <button onClick={() => setView("analyze")} className="nb-btn nb-btn-primary mt-5">
                Start screening
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const text = aiExplanation ?? stored;

  const explain = async () => {
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          projectId: target,
          itLoad: (analysis.waterDemand as { facilityEnergyMwhPerDay: number })
            .facilityEnergyMwhPerDay,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to generate an explanation.");
      setAiExplanation(data.explanation || "No explanation was returned.");
    } catch (cause) {
      setAiExplanation(
        `**Error:** ${cause instanceof Error ? cause.message : "Unknown error"}`,
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-8 space-y-5">
      <header>
        <button
          onClick={() => {
            // This page pins its own view, so the in-app view has to be set
            // before returning to "/" or the shell would render it again.
            setView("dashboard");
            if (target) router.push(`/?project=${target}`);
            else router.push("/");
          }}
          className="nb-btn !py-1 !px-2.5 text-xs mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to screening
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-2xl font-extrabold tracking-tight">
            AI-assisted explanation
          </h1>
        </div>
        <p className="text-sm text-[var(--nb-muted)] mt-1">
          {analysis.projectName}
        </p>
      </header>

      {/* Standing disclaimer. Not optional, and not small. */}
      <div className="nb-card-flat p-4 bg-[var(--nb-tint)]">
        <div className="nb-eyebrow mb-1">What this is</div>
        <p className="text-sm leading-relaxed">
          The screening result was produced by deterministic rules over the submitted
          parameters and the evidence listed on the report. This page restates that
          result in plain language and drafts questions worth investigating next. It
          cannot assign feasibility, introduce a threshold, or state that a requirement
          is met. The rules remain the only source of the result.
        </p>
      </div>

      <button onClick={explain} disabled={aiLoading} className="nb-btn nb-btn-primary">
        {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {aiLoading ? "Generating" : text ? "Regenerate explanation" : "Generate explanation"}
      </button>

      {aiLoading && (
        <p className="text-sm text-[var(--nb-muted)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Summarising the structured result.
        </p>
      )}

      {text && !aiLoading && (
        <article className="nb-card p-5">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="text-sm font-extrabold uppercase tracking-wide mt-4 mb-1.5 border-b-2 border-black pb-1 first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mt-3 mb-1">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm leading-relaxed mb-2">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="text-sm list-disc pl-5 mb-2 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="text-sm list-decimal pl-5 mb-2 space-y-1">{children}</ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-bold">{children}</strong>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </article>
      )}
    </div>
  );
}
