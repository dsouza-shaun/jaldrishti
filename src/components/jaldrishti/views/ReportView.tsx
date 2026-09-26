"use client";

import { useEffect, useState } from "react";
import { FileDown, FileType2, Printer, Loader2, AlertCircle, Send } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { useToast } from "@/hooks/use-toast";
import { DataTable, Metric, StatusChip, classificationTone } from "@/components/jaldrishti/Document";
import type { Block, Metric as MetricItem } from "@/lib/report/document";
import type { ReportSection } from "@/lib/report/sections";

interface ReportPayload {
  title: string;
  subtitle: string;
  footer: string;
  generatedAt: string;
  projectId: string;
  sections: ReportSection[];
}

/**
 * The screening report.
 *
 * A dedicated page rather than a panel at the foot of the dashboard, because it
 * is the artefact the developer submits and the authority reads. The blocks come
 * from the same builder the PDF and Word exports use, so what is read on screen
 * is what gets downloaded.
 */
export function ReportView({ projectId }: { projectId: string | null }) {
  const { currentProjectId } = useJalDrishti();
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  // The URL carries the project id, but the analysis itself arrives from the
  // store via hydration. Until one of them is present the page is still loading
  // rather than empty, which is why the URL id is accepted as a fallback.
  const target = currentProjectId ?? projectId;

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();

    fetch(`/api/projects/${target}/report?format=json`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Unable to load the report.");
        return data as ReportPayload;
      })
      .then(setPayload)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load the report.");
      });

    return () => controller.abort();
  }, [target]);

  const download = async (format: "pdf" | "docx") => {
    if (!target) return;
    setDownloading(format);
    try {
      const response = await fetch(`/api/projects/${target}/report?format=${format}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "Failed");

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? `screening-report.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate the file.");
    } finally {
      setDownloading(null);
    }
  };

  if (error) {
    return (
      <Frame
        title="Screening report"
        subtitle={error}
      />
    );
  }

  if (!payload) {
    return (
      <div className="max-w-[1000px] mx-auto px-4 py-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        <p className="mt-2 text-sm text-[var(--nb-muted)]">
          {target ? "Building the report" : "No project is loaded. Run a screening first."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-8 space-y-6">
      {/* Actions. Hidden from print, which is for the document itself. */}
      <div className="flex flex-wrap items-center gap-2 nb-no-print">
        <button
          onClick={() => download("pdf")}
          disabled={downloading !== null}
          className="nb-btn nb-btn-primary"
        >
          {downloading === "pdf" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Generate PDF
        </button>
        <button
          onClick={() => download("docx")}
          disabled={downloading !== null}
          className="nb-btn"
        >
          {downloading === "docx" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileType2 className="w-4 h-4" />
          )}
          Download Word
        </button>
        <button onClick={() => window.print()} className="nb-btn">
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {error && (
        <div className="nb-card-flat p-3 flex items-start gap-2 border-[var(--accent-red)]">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <ReportActions projectId={target} />

      {/* The document. */}
      <article className="nb-card p-5 sm:p-8">
        <header className="border-b-[3px] border-black pb-4 mb-6">
          <div
            className="nb-eyebrow"
            style={{ color: "var(--accent-red)", letterSpacing: "0.18em" }}
          >
            JalDrishti
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            {payload.title}
          </h1>
          <p className="text-sm text-[var(--nb-muted)] mt-1">{payload.subtitle}</p>
        </header>

        <div className="space-y-7">
          {payload.sections.map((section, index) => (
            <section key={section.id} className="nb-print-section">
              <div className="border-b-2 border-black pb-1 mb-3">
                <h2 className="nb-section-title">
                  {index + 1}. {section.title}
                </h2>
              </div>
              <div className="space-y-4">
                {section.blocks.map((block, blockIndex) => (
                  <BlockView key={blockIndex} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-8 pt-3 border-t-2 border-black">
          <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
            {payload.footer}
          </p>
        </footer>
      </article>
    </div>
  );
}

/** Submit-for-review, shown only to the Developer. */
function ReportActions({ projectId }: { projectId: string | null }) {
  const { toast } = useToast();
  const { user } = useJalDrishti();
  const [busy, setBusy] = useState(false);

  if (user?.role !== "DEVELOPER" || !projectId) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to submit");
      toast({
        title: "Submitted for review",
        description: "The authority can now assess this screening.",
      });
    } catch (cause) {
      toast({
        title: "Could not submit",
        description: cause instanceof Error ? cause.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nb-card-flat p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 nb-no-print">
      <p className="text-sm text-[var(--nb-muted)] max-w-xl">
        Submit this screening for authority review. The authority records an assessment
        against it; JalDrishti does not grant approval.
      </p>
      <button onClick={submit} disabled={busy} className="nb-btn !py-1.5 !px-3 text-sm">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit for authority review
      </button>
    </div>
  );
}

/** Renders one block of the shared document model. */
function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "title":
      return <h3 className="text-xl font-extrabold">{block.text}</h3>;

    case "subtitle":
      return <p className="text-sm text-[var(--nb-muted)]">{block.text}</p>;

    case "heading":
      return <h3 className="text-base font-extrabold">{block.text}</h3>;

    case "paragraph":
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{block.text}</p>
      );

    case "note":
      return (
        <p className="text-xs text-[var(--nb-muted)] leading-relaxed border-l-2 border-[var(--nb-rule)] pl-3">
          {block.text}
        </p>
      );

    case "divider":
      return <hr className="border-t border-[var(--nb-rule)]" />;

    case "metrics":
      return <MetricRow items={block.items} />;

    case "list":
      return block.items.length === 0 ? null : (
        <BlockList items={block.items} ordered={block.ordered} />
      );

    case "table":
      return (
        <DataTable
          caption={block.caption}
          columns={block.columns.map((column, index) => ({
            key: `${column}-${index}`,
            header: column,
            render: (row: string[]) => {
              const cell = row[index] ?? "";
              // Evidence columns are the only ones that carry colour, and only
              // because the wording is a status, not decoration.
              if (/^(Sourced|Modelled|Needs verification|Limited)$/.test(cell)) {
                const tone =
                  cell === "Sourced"
                    ? "feasible"
                    : cell === "Needs verification" || cell === "Limited"
                      ? "muted"
                      : "conditional";
                return <StatusChip tone={tone}>{cell}</StatusChip>;
              }
              if (/^(Feasible|Feasible with Conditions|Data Insufficient|High Constraint)/.test(cell)) {
                return <StatusChip tone={classificationTone(cell)}>{cell}</StatusChip>;
              }
              return <span className="text-sm">{cell}</span>;
            },
          }))}
          rows={block.rows}
        />
      );

    default:
      return null;
  }
}

function MetricRow({ items }: { items: MetricItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-y-2 border-black py-4">
      {items.map((item, index) => (
        <Metric
          key={index}
          label={item.label}
          value={item.value}
          note={item.note}
          emphasis={index === 0}
        />
      ))}
    </div>
  );
}

function BlockList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`space-y-1.5 ${ordered ? "list-none" : "list-disc pl-5"}`}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          {ordered && (
            <span className="shrink-0 w-5 h-5 border border-black bg-[var(--nb-tint)] flex items-center justify-center text-[10px] font-bold mt-0.5">
              {index + 1}
            </span>
          )}
          <span className="text-sm leading-relaxed">{item}</span>
        </li>
      ))}
    </Tag>
  );
}

function Frame({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="max-w-[1000px] mx-auto px-4 py-16">
      <div className="nb-card p-8 text-center">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="text-sm text-[var(--nb-muted)] mt-2">{subtitle}</p>
      </div>
    </div>
  );
}
