"use client";

import type { ReactNode } from "react";

/**
 * Document primitives.
 *
 * The dashboard, report and review screens are documents, not a card gallery.
 * These four pieces carry that: a titled section, a dominant metric, a ruled
 * table, and a status chip. Colour is reserved for status only.
 */

// ---- Section -----------------------------------------------------------------

export function SectionShell({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`nb-print-section ${className}`}>
      <div className="border-b-2 border-black pb-1.5 mb-4">
        <h2 className="nb-section-title">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--nb-muted)]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ---- Metric ------------------------------------------------------------------

/**
 * A single quantitative output. The label is small and uppercase, the value is
 * the loudest thing in the block, and supporting detail is quieter still. No
 * decorative scale: the point is that the number reads before the text does.
 */
export function Metric({
  label,
  value,
  unit,
  note,
  emphasis = false,
  status,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  emphasis?: boolean;
  status?: "feasible" | "conditional" | "insufficient" | "constraint";
}) {
  const accent =
    status === "feasible"
      ? "var(--status-feasible)"
      : status === "conditional"
        ? "var(--status-conditional)"
        : status === "insufficient"
          ? "var(--status-insufficient)"
          : status === "constraint"
            ? "var(--status-constraint)"
            : null;

  return (
    <div className="min-w-0">
      <div className="nb-metric-label">{label}</div>
      <div
        className="mt-1 flex items-baseline gap-1.5 flex-wrap"
        style={accent ? { color: accent } : undefined}
      >
        <span
          className="nb-metric-value"
          style={{
            fontSize: emphasis ? "clamp(2.25rem, 7vw, 3.75rem)" : "1.5rem",
            color: accent ?? "var(--ink)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="font-bold"
            style={{
              fontSize: emphasis ? "1rem" : "0.875rem",
              color: accent ?? "var(--ink)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      {note && <div className="nb-metric-note mt-1">{note}</div>}
    </div>
  );
}

// ---- Table -------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: string;
  /** Shared render for body cells. The header cell uses the same function. */
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
}

/**
 * A ruled data table. Every value that used to sit in its own coloured box is a
 * row here, which is what makes a long assessment scannable.
 */
export function DataTable<T>({
  columns,
  rows,
  caption,
  empty = "No data available.",
  rowKey,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  caption?: string;
  empty?: string;
  rowKey?: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--nb-muted)] py-1">{empty}</p>;
  }

  return (
    <>
      {caption && (
        <div className="nb-eyebrow mb-1.5">{caption}</div>
      )}
      <div className="overflow-x-auto nb-scroll">
        <table className="nb-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{
                    width: column.width,
                    textAlign: column.align ?? "left",
                  }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey ? rowKey(row, index) : index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{ textAlign: column.align ?? "left" }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Status chip -------------------------------------------------------------

const CHIP_STYLES: Record<string, { background: string; color: string }> = {
  feasible: { background: "var(--status-feasible)", color: "#001a0a" },
  conditional: { background: "var(--status-conditional)", color: "#3a2a00" },
  insufficient: { background: "var(--status-insufficient)", color: "#3a1a00" },
  constraint: { background: "var(--status-constraint)", color: "#ffffff" },
  neutral: { background: "var(--nb-tint)", color: "var(--ink)" },
  muted: { background: "var(--status-unknown)", color: "var(--ink)" },
};

/**
 * A small uppercase label. Only the four outcome styles carry colour; the rest
 * are neutral, so colour never becomes decoration.
 */
export function StatusChip({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "feasible" | "conditional" | "insufficient" | "constraint" | "neutral" | "muted";
  title?: string;
}) {
  const style = CHIP_STYLES[tone];
  return (
    <span
      className="nb-badge"
      style={{ background: style.background, color: style.color }}
      title={title}
    >
      {children}
    </span>
  );
}

// ---- Classification mapping --------------------------------------------------

/**
 * Maps the four screening outcomes onto the four status tones. Centralised so
 * the dashboard, the report and the review screen agree on what a colour means.
 */
export function classificationTone(
  classification: string,
): "feasible" | "conditional" | "insufficient" | "constraint" {
  if (classification.includes("High Constraint")) return "constraint";
  if (classification.includes("Conditions")) return "conditional";
  if (classification.includes("Insufficient")) return "insufficient";
  return "feasible";
}

export function evidenceTone(status: string): "feasible" | "conditional" | "muted" {
  if (status === "VERIFIED") return "feasible";
  if (status === "PROXY") return "conditional";
  return "muted";
}
