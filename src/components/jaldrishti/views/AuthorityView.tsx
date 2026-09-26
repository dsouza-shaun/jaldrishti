"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, FileText, Inbox } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { useToast } from "@/hooks/use-toast";
import { DataTable, StatusChip, classificationTone } from "@/components/jaldrishti/Document";
import { DECISION_LABEL, DECISION_MEANING, fmtInt } from "@/lib/report/document";
import type { ReportSection } from "@/lib/report/sections";

interface QueueRow {
  id: string;
  projectId: string;
  projectName: string;
  latitude: number;
  longitude: number;
  developerName: string;
  developerOrganisation: string | null;
  decision: string;
  comments: string | null;
  submittedAt: string;
  updatedAt: string;
  reviewerName: string | null;
  hasAnalysis: boolean;
  classification: string | null;
  waterKlPerDay: number | null;
}

const DECISIONS: Array<{ value: string; label: string }> = [
  { value: "APPROVED", label: "Approve" },
  { value: "APPROVED_WITH_CONDITIONS", label: "Approve with conditions" },
  { value: "REJECTED", label: "Do not approve" },
  { value: "MORE_INFO", label: "More information required" },
];

function toneFor(decision: string) {
  if (decision === "APPROVED") return "feasible" as const;
  if (decision === "APPROVED_WITH_CONDITIONS") return "conditional" as const;
  if (decision === "REJECTED") return "constraint" as const;
  return "neutral" as const;
}

/**
 * The Authority workspace.
 *
 * A review queue over submitted screenings, and a read-only view of exactly
 * what the developer submitted. The Authority records an assessment; this screen
 * never states that a site is approved, because the system cannot grant or
 * refuse a statutory permission.
 */
export function AuthorityView() {
  const { toast } = useToast();
  const fail = (cause: unknown, fallback: string) =>
    toast({
      title: "Could not record the decision",
      description: cause instanceof Error ? cause.message : fallback,
      variant: "destructive",
    });
  const router = useRouter();
  const { user } = useJalDrishti();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [selected, setSelected] = useState<QueueRow | null>(null);

  const load = () => {
    fetch("/api/reviews")
      .then((response) => (response.ok ? response.json() : { reviews: [] }))
      .then((data: { reviews?: QueueRow[] }) => setRows(data.reviews ?? []))
      .catch(() => setRows([]));
  };

  useEffect(load, []);

  // A signed-in Developer is redirected away by the route, so this only guards
  // the moment before the session has been read.
  if (user && user.role !== "AUTHORITY") {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-16 text-center">
        <div className="nb-card p-8">
          <h1 className="text-2xl font-extrabold">Authority access only</h1>
          <p className="text-sm text-[var(--nb-muted)] mt-2">
            This area is for reviewing submitted screenings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-8 space-y-5">
      <header>
        <div className="nb-eyebrow">Review</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
          Submitted screenings
        </h1>
        <p className="text-sm text-[var(--nb-muted)] mt-1 max-w-3xl">
          Assessments recorded here are review records. JalDrishti provides preliminary
          decision support and is not the authority; recording a decision does not grant
          or refuse any statutory permission.
        </p>
      </header>

      <DataTable
        columns={[
          {
            key: "project",
            header: "Project",
            render: (row) => (
              <div className="min-w-0">
                <div className="font-semibold break-words">{row.projectName}</div>
                <div className="text-xs text-[var(--nb-muted)] font-mono">
                  {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
                </div>
              </div>
            ),
          },
          {
            key: "developer",
            header: "Developer",
            render: (row) => (
              <div className="min-w-0">
                <div className="text-sm break-words">{row.developerName}</div>
                {row.developerOrganisation && (
                  <div className="text-xs text-[var(--nb-muted)] break-words">
                    {row.developerOrganisation}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "result",
            header: "Screening result",
            render: (row) =>
              row.classification ? (
                <StatusChip tone={classificationTone(row.classification)}>
                  {row.classification}
                </StatusChip>
              ) : (
                <span className="text-xs text-[var(--nb-muted)]">No result</span>
              ),
          },
          {
            key: "water",
            header: "Water requirement",
            align: "right",
            render: (row) => (
              <span className="text-sm font-mono whitespace-nowrap">
                {row.waterKlPerDay != null ? `${fmtInt(row.waterKlPerDay)} kL/day` : "-"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <StatusChip tone={toneFor(row.decision)}>
                {DECISION_LABEL[row.decision] ?? row.decision}
              </StatusChip>
            ),
          },
          {
            key: "submitted",
            header: "Submitted",
            align: "right",
            render: (row) => (
              <span className="text-xs font-mono whitespace-nowrap">
                {new Date(row.submittedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ),
          },
          {
            key: "action",
            header: "",
            align: "right",
            render: (row) => (
              <button
                onClick={() => setSelected(row)}
                disabled={!row.hasAnalysis}
                className="nb-btn !py-1 !px-2.5 text-xs"
              >
                Review
              </button>
            ),
          },
        ]}
        rows={rows ?? []}
        rowKey={(row) => row.id}
        empty="No screenings have been submitted for review yet."
      />

      {rows && rows.length === 0 && (
        <div className="nb-card-flat p-6 flex items-start gap-3 bg-[var(--nb-tint)]">
          <Inbox className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--nb-muted)] max-w-2xl">
            Nothing is waiting. A submission appears here once a developer runs a
            screening and submits it for review from the report page.
          </p>
        </div>
      )}

      {selected && (
        <ReviewDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onError={fail}
          onSaved={() => {
            load();
            setSelected(null);
            toast({ title: "Decision recorded", description: "The developer can see this feedback." });
          }}
          onOpenReport={() =>
            router.push(`/report?project=${selected.projectId}`)
          }
        />
      )}
    </div>
  );
}

function ReviewDrawer({
  row,
  onClose,
  onSaved,
  onError,
  onOpenReport,
}: {
  row: QueueRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (cause: unknown, fallback: string) => void;
  onOpenReport: () => void;
}) {
  const [sections, setSections] = useState<ReportSection[] | null>(null);
  const [decision, setDecision] = useState(
    row.decision === "PENDING" ? "MORE_INFO" : row.decision,
  );
  const [comments, setComments] = useState(row.comments ?? "");
  const [busy, setBusy] = useState(false);

  // The reviewer reads the same document the developer submitted, built by the
  // same code path, so there is no second, divergent rendering to trust.
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${row.projectId}/report?format=json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { sections?: ReportSection[] } | null) => {
        if (active && data?.sections) setSections(data.sections);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [row.projectId]);

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/reviews/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to record the decision.");
      onSaved();
    } catch (cause) {
      onError(cause, "Unable to record the decision.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end nb-scroll overflow-y-auto">
      <button
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-3xl bg-[var(--sky)] border-l-[3px] border-black p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="nb-eyebrow">Reviewing</div>
            <h2 className="text-xl font-extrabold break-words">{row.projectName}</h2>
            <p className="text-xs text-[var(--nb-muted)] mt-0.5">
              {row.developerName}
              {row.developerOrganisation ? `, ${row.developerOrganisation}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="nb-btn !p-2 shrink-0" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusChip tone={classificationTone(row.classification ?? "")}>
            {row.classification ?? "No result"}
          </StatusChip>
          {row.waterKlPerDay != null && (
            <StatusChip tone="neutral">
              {fmtInt(row.waterKlPerDay)} kL/day
            </StatusChip>
          )}
          <StatusChip tone={toneFor(row.decision)}>
            {DECISION_LABEL[row.decision] ?? row.decision}
          </StatusChip>
        </div>

        {/* Decision controls */}
        <div className="nb-card p-4 space-y-3">
          <div>
            <div className="nb-label">Assessment</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DECISIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDecision(option.value)}
                  aria-pressed={decision === option.value}
                  className={`border-[3px] border-black px-3 py-2 text-left text-sm font-bold ${
                    decision === option.value
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--paper)] hover:bg-[var(--nb-tint)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="nb-label" htmlFor="review-comments">
              Comments for the developer
            </label>
            <textarea
              id="review-comments"
              className="nb-input min-h-[110px]"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="State what is required, what was verified and what remains outstanding."
            />
          </div>

          <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
            {DECISION_MEANING[decision] ?? ""}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="nb-btn nb-btn-primary !py-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Record assessment
            </button>
            <button onClick={onOpenReport} className="nb-btn !py-2">
              <FileText className="w-4 h-4" />
              Open full report
            </button>
          </div>
        </div>

        {/* The submitted report, read only. */}
        <div className="nb-card p-4 sm:p-5">
          <div className="border-b-2 border-black pb-1 mb-3">
            <h3 className="nb-section-title">Submitted report</h3>
          </div>
          {sections === null ? (
            <p className="text-sm text-[var(--nb-muted)] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading the submitted report.
            </p>
          ) : (
            <div className="space-y-4">
              {sections.map((section, index) => (
                <section key={section.id}>
                  <h4 className="nb-eyebrow mb-1.5">
                    {index + 1}. {section.title}
                  </h4>
                  <AuthorityBlocks blocks={section.blocks} />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A compact read-only renderer for the drawer. Full styling lives in ReportView. */
function AuthorityBlocks({ blocks }: { blocks: ReportSection["blocks"] }) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.kind === "metrics") {
          return (
            <div key={index} className="flex flex-wrap gap-x-6 gap-y-2">
              {block.items.map((item, itemIndex) => (
                <div key={itemIndex}>
                  <div className="nb-metric-label">{item.label}</div>
                  <div className="font-bold text-sm">{item.value}</div>
                  {item.note && (
                    <div className="text-xs text-[var(--nb-muted)]">{item.note}</div>
                  )}
                </div>
              ))}
            </div>
          );
        }
        if (block.kind === "table") {
          return (
            <div key={index} className="overflow-x-auto nb-scroll">
              <table className="nb-table">
                <thead>
                  <tr>
                    {block.columns.map((column, columnIndex) => (
                      <th key={columnIndex}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="text-sm">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={index} className="list-disc pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="text-sm leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "paragraph") {
          return (
            <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
              {block.text}
            </p>
          );
        }
        if (block.kind === "note") {
          return (
            <p key={index} className="text-xs text-[var(--nb-muted)] leading-relaxed">
              {block.text}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
