"use client";

import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { classificationTone, StatusChip } from "@/components/jaldrishti/Document";
import { selectHeadlineConditions } from "@/lib/report/document";

/**
 * The screening result and the estimated water requirement, as the two things a
 * reader must take away from this page.
 *
 * Neither figure appears anywhere else on the dashboard. The old layout printed
 * the classification inside a card, repeated the water figure in a header strip
 * and again inside the water panel; that repetition is what made the result
 * hard to find, so each now has exactly one home.
 */
export function ResultBanner() {
  const { analysis } = useJalDrishti();
  if (!analysis) return null;

  const classification = analysis.classification.classification;
  const tone = classificationTone(classification);
  // The raw first reason carries an internal tag such as "[CONDITION]", so the
  // headline selector supplies the sentence shown to the reader instead. The
  // store keeps constraints loosely typed, so they are narrowed here.
  const headline = selectHeadlineConditions(
    {
      classification: analysis.classification.classification,
      hardConstraints: analysis.classification.hardConstraints as never,
      softConstraints: analysis.classification.softConstraints as never,
      evidenceGaps: analysis.classification.evidenceGaps as never,
      reasons: analysis.classification.reasons,
    },
    1,
  );
  const lead = headline.shown[0];
  const leadLine = lead
    ? `${lead.label}${lead.summary ? `: ${lead.summary}` : ""}`
    : null;
  // A clean "Feasible" result returns three positive statements rather than
  // conditions, so there is nothing to point the reader on to.
  const showMore = headline.total > 1 && classification !== "Feasible";
  const water = analysis.waterDemand as unknown as {
    waterKlPerDay: number;
    waterMcmPerYear: number;
    waterMld: number;
    facilityEnergyMwhPerDay: number;
  };

  const background =
    tone === "constraint"
      ? "var(--status-constraint)"
      : tone === "conditional"
        ? "var(--status-conditional)"
        : tone === "insufficient"
          ? "var(--status-insufficient)"
          : "var(--status-feasible)";
  const onColour = tone === "constraint" ? "#ffffff" : "#0a0a0a";

  return (
    <div className="nb-card overflow-hidden">
      {/* Result band */}
      <div className="p-4 sm:p-5" style={{ background, color: onColour }}>
        <div className="nb-eyebrow" style={{ color: onColour, opacity: 0.75 }}>
          Screening result
        </div>
        <h2
          className="mt-1 font-extrabold leading-tight tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 4.5vw, 2.5rem)" }}
        >
          {classification}
        </h2>
        {leadLine && (
          <p className="mt-2 text-sm leading-relaxed max-w-3xl" style={{ opacity: 0.9 }}>
            {leadLine}
          </p>
        )}
        {showMore && (
          <p className="mt-1 text-xs" style={{ opacity: 0.75 }}>
            {headline.total - 1} further condition{headline.total - 1 === 1 ? "" : "s"}
            {headline.total - 1 === 1 ? " is" : " are"} listed in the Screening Result
            section.
          </p>
        )}
      </div>

      {/* Key figure band */}
      <div className="bg-[var(--paper)] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <div className="nb-metric-label">Estimated water requirement</div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span
              className="nb-metric-value"
              style={{ fontSize: "clamp(2.25rem, 7vw, 3.5rem)" }}
            >
              {Number(water.waterKlPerDay).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-base font-bold">kL/day</span>
          </div>
          <div className="nb-metric-note mt-1">
            Calculated from the submitted IT load, PUE and WUE.
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 content-start sm:border-l sm:border-[var(--nb-rule)] sm:pl-5">
          <Figure label="Annual requirement" value={`${Number(water.waterMcmPerYear).toFixed(2)} MCM/yr`} />
          <Figure label="Daily volume" value={`${Number(water.waterMld).toFixed(2)} MLD`} />
          <Figure label="Facility energy" value={`${Number(water.facilityEnergyMwhPerDay).toFixed(0)} MWh/day`} />
          <Figure label="Result basis" value="Deterministic rules" />
        </dl>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="nb-metric-label">{label}</dt>
      <dd className="mt-0.5 font-bold text-base leading-tight break-words">{value}</dd>
    </div>
  );
}
