"use client";

import { motion } from "framer-motion";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

export function AIExplanationPanel() {
  const { analysis, currentProjectId, aiExplanation, aiLoading, setAiExplanation, setAiLoading } = useJalDrishti();
  const [open, setOpen] = useState(false);

  if (!analysis || !currentProjectId) return null;

  const explain = async () => {
    setAiLoading(true);
    setAiExplanation(null);
    setOpen(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, itLoad: (analysis.waterDemand as { facilityEnergyMwhPerDay: number }).facilityEnergyMwhPerDay }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      setAiExplanation(data.explanation || "No explanation returned.");
    } catch (e) {
      setAiExplanation(`**Error:** ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card p-4"
      style={{ background: "var(--accent-purple)" }}
    >
      <div className="flex items-center justify-between border-b-[2px] border-black pb-2 mb-3">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4" />
          <h3 className="text-sm font-extrabold uppercase tracking-tight">AI Explanation Layer</h3>
        </div>
        <span className="nb-badge" style={{ background: "var(--accent-yellow)" }}>
          Explains, never decides
        </span>
      </div>

      <div className="bg-[var(--paper)] border-[3px] border-black p-3 mb-3">
        <div className="text-xs text-black/80 leading-relaxed">
          The classification above is the authoritative answer. This layer
          summarises it in plain language and suggests what to investigate
          next - it cannot override the result or invent values.
        </div>
      </div>

      <button
        onClick={explain}
        disabled={aiLoading}
        className="nb-btn nb-btn-accent w-full"
      >
        {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {aiLoading ? "Generating explanation..." : "Generate Plain-Language Explanation"}
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mt-3 bg-[var(--paper)] border-[3px] border-black p-3 max-h-[400px] overflow-y-auto nb-scroll"
        >
          {aiLoading ? (
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Asking the LLM to summarise the structured JSON...
            </div>
          ) : aiExplanation ? (
            <div className="prose prose-sm max-w-none text-black">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 className="text-sm font-extrabold uppercase mt-3 mb-1 border-b-2 border-black pb-1">{children}</h2>,
                  p: ({ children }) => <p className="text-xs leading-relaxed mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="text-xs list-disc pl-4 mb-2">{children}</ul>,
                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                }}
              >
                {aiExplanation}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-xs text-black/60">No explanation yet.</div>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}
