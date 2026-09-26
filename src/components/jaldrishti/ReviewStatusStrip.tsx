"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Send } from "lucide-react";
import { useJalDrishti } from "@/lib/stores/jaldrishti-store";
import { useToast } from "@/hooks/use-toast";
import { StatusChip } from "@/components/jaldrishti/Document";
import { DECISION_LABEL, DECISION_MEANING } from "@/lib/report/document";

interface ReviewRow {
  projectId: string;
  decision: string;
  comments: string | null;
  updatedAt: string;
  reviewerName: string | null;
}

/**
 * Review status for the project on screen.
 *
 * Reads the same queue the Authority screen works from, filtered to this
 * project. It is the Developer's view of feedback: what was decided, by whom,
 * and what is being asked for. A review is an assessment record, not an
 * approval, and the wording says so.
 */
export function ReviewStatusStrip({ projectId }: { projectId: string | null }) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useJalDrishti();
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [busy, setBusy] = useState(false);

  const isDeveloper = user?.role === "DEVELOPER";

  useEffect(() => {
    if (!projectId || !user) return;
    const controller = new AbortController();

    fetch("/api/reviews", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { reviews: [] }))
      .then((data: { reviews?: Array<ReviewRow & { id: string }> }) => {
        const match = (data.reviews ?? []).find((row) => row.projectId === projectId);
        setReview(match ?? null);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [projectId, user]);

  // An Authority has no submission to make and the report page carries the
  // review controls, so the strip stays out of their way.
  if (!isDeveloper || !projectId) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to submit");
      toast({ title: "Submitted for review", description: "The authority can now assess this screening." });
      router.push(`/report?project=${projectId}`);
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not submit",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!review) {
    return (
      <div className="nb-card-flat p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 nb-no-print">
        <p className="text-sm text-[var(--nb-muted)]">
          This screening has not been submitted for authority review.
        </p>
        <button onClick={submit} disabled={busy} className="nb-btn !py-1.5 !px-3 text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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

  return (
    <div className="nb-card-flat p-3 sm:p-4 space-y-2 nb-no-print">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={tone as "feasible" | "conditional" | "constraint" | "neutral"}>
          {DECISION_LABEL[review.decision] ?? review.decision}
        </StatusChip>
        <span className="text-xs text-[var(--nb-muted)]">
          {review.reviewerName ? `Recorded by ${review.reviewerName}` : "Awaiting an authority decision"}
          {" on "}
          {new Date(review.updatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <button
          onClick={() => router.push(`/report?project=${projectId}`)}
          className="ml-auto nb-btn !py-1 !px-2.5 text-xs"
        >
          <FileText className="w-3.5 h-3.5" />
          Open report
        </button>
      </div>

      {review.comments && (
        <div className="border-l-2 border-black pl-3">
          <div className="nb-eyebrow">Reviewer comments</div>
          <p className="text-sm mt-0.5 whitespace-pre-wrap">{review.comments}</p>
        </div>
      )}

      <p className="text-xs text-[var(--nb-muted)] leading-relaxed">
        {DECISION_MEANING[review.decision] ?? ""}
      </p>

      {review.decision !== "PENDING" && (
        <button onClick={submit} disabled={busy} className="nb-btn !py-1 !px-2.5 text-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Resubmit
        </button>
      )}
    </div>
  );
}
