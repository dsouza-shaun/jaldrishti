"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Send,
  Hourglass,
  X,
  RefreshCw,
} from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { useToast } from "@/hooks/use-toast";
import { StatusChip } from "@/components/jaldrishti/Document";
import { DECISION_LABEL, DECISION_MEANING } from "@/lib/report/document";

interface ReviewRow {
  id: string;
  projectId: string;
  decision: string;
  comments: string | null;
  updatedAt: string;
  reviewerName: string | null;
}

/**
 * Review status for the project on screen.
 *
 * This is a persistent indicator, not a toast. A submitted project must keep
 * showing that it is awaiting review, with a way to withdraw it, for as long as
 * the dashboard is open. The status is read from the same queue the Authority
 * screen works from, filtered to this project, so the two can never disagree.
 */
export function ReviewStatusStrip({ projectId }: { projectId: string | null }) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useJalDrishti();
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isDeveloper = user?.role === "DEVELOPER";

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch("/api/reviews", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { reviews?: ReviewRow[] };
      const match = (data.reviews ?? []).find((row) => row.projectId === projectId) ?? null;
      setReview(match);
    } catch {
      // Leave the previous value in place; a transient failure must not make a
      // submitted review look withdrawn.
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !user) return;
    // Kick the fetch off. The state updates happen inside the promise chain in
    // `load`, not synchronously in this effect body, so this is an
    // external-system sync rather than a cascading render on mount.
    const tick = () => void load();
    tick();
  }, [projectId, user, load]);

  // An Authority has nothing to submit, and the review controls live in the
  // Authority screen, so the strip stays out of their way.
  if (!isDeveloper || !projectId) return null;

  const run = async (
    action: "submit" | "cancel",
    successTitle: string,
    successBody: string,
  ) => {
    setBusy(true);
    try {
      if (action === "submit") {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        if (!response.ok) {
          throw new Error((await response.json()).error ?? "Unable to submit");
        }
      } else {
        const response = await fetch(`/api/reviews/${review?.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error((await response.json()).error ?? "Unable to withdraw");
        }
      }
      // Re-read the queue so the strip reflects the new state immediately,
      // rather than showing a stale status until the next page load.
      await load();
      toast({ title: successTitle, description: successBody });
    } catch (cause) {
      toast({
        title: "Could not update the review",
        description: cause instanceof Error ? cause.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="nb-card-flat p-3 sm:p-4 flex items-center gap-2 text-sm text-[var(--nb-muted)] nb-no-print">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking review status
      </div>
    );
  }

  const isPending = review?.decision === "PENDING";

  // Not yet submitted.
  if (!review) {
    return (
      <div className="nb-card-flat p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 nb-no-print">
        <p className="text-sm text-[var(--nb-muted)]">
          This screening has not been submitted for authority review.
        </p>
        <button
          onClick={() =>
            run("submit", "Submitted for review", "The authority can now assess this screening.")
          }
          disabled={busy}
          className="nb-btn !py-1.5 !px-3 text-sm"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit for review
        </button>
      </div>
    );
  }

  const tone =
    review.decision === "APPROVED"
      ? "feasible"
      : review.decision === "APPROVED_WITH_CONDITIONS"
        ? "conditional"
        : review.decision === "REJECTED"
          ? "constraint"
          : "neutral";

  const formattedDate = new Date(review.updatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="nb-card-flat p-3 sm:p-4 space-y-2 nb-no-print"
      // A pending review deserves to be noticed, so it is tinted rather than
      // left as a flat strip the eye passes over.
      style={isPending ? { background: "var(--nb-tint)" } : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={tone as "feasible" | "conditional" | "constraint" | "neutral"}>
          {isPending ? "On review" : DECISION_LABEL[review.decision] ?? review.decision}
        </StatusChip>

        {isPending ? (
          <span className="text-xs text-[var(--nb-muted)] flex items-center gap-1">
            <Hourglass className="h-3.5 w-3.5" />
            Submitted on {formattedDate}. Awaiting an authority decision.
          </span>
        ) : (
          <span className="text-xs text-[var(--nb-muted)]">
            {review.reviewerName ? `Recorded by ${review.reviewerName}` : "Recorded"}
            {" on "}
            {formattedDate}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => router.push(`/report?project=${projectId}`)}
            className="nb-btn !py-1 !px-2.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            Open report
          </button>

          {isPending ? (
            <button
              onClick={() =>
                run("cancel", "Review withdrawn", "This screening is no longer awaiting review.")
              }
              disabled={busy}
              className="nb-btn !py-1 !px-2.5 text-xs"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Cancel review
            </button>
          ) : (
            <button
              onClick={() =>
                run("submit", "Resubmitted for review", "The authority can now assess this screening again.")
              }
              disabled={busy}
              className="nb-btn !py-1 !px-2.5 text-xs"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Resubmit
            </button>
          )}
        </div>
      </div>

      {review.comments && (
        <div className="border-l-2 border-black pl-3">
          <div className="nb-eyebrow">Reviewer comments</div>
          <p className="text-sm mt-0.5 whitespace-pre-wrap">{review.comments}</p>
        </div>
      )}

      <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
        {isPending
          ? "The authority has been notified. You can withdraw the submission while it is still awaiting review."
          : (DECISION_MEANING[review.decision] ?? "")}
      </p>
    </div>
  );
}
