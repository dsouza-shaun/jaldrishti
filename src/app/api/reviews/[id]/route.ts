import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

const decisionSchema = z.object({
  decision: z.enum([
    "APPROVED",
    "APPROVED_WITH_CONDITIONS",
    "REJECTED",
    "MORE_INFO",
  ]),
  comments: z.string().max(4000).optional().nullable(),
});

/**
 * PATCH /api/reviews/[id] - an Authority records a decision.
 *
 * This records an assessment against a submission. It does not grant, refuse
 * or vary any statutory permission, and the wording stored here is the wording
 * the Developer will read.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rate = checkEdgeRateLimit(req, "review-decision", 60, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (user.role !== "AUTHORITY") {
    return NextResponse.json(
      { error: "Only an Authority account can record a review decision." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid decision and comments are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const comments = parsed.data.comments?.trim() || null;

    // A decision without a rationale is not reviewable by the applicant, so it
    // is required for the outcomes that tell the applicant to do something.
    if (!comments && parsed.data.decision !== "APPROVED") {
      return NextResponse.json(
        { error: "Please record comments so the developer knows what is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const review = await db.review.update({
      where: { id },
      data: {
        decision: parsed.data.decision,
        comments,
        reviewerId: user.id,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        review: {
          id: review.id,
          projectId: review.projectId,
          decision: review.decision,
          comments: review.comments,
          reviewerName: user.displayName,
          updatedAt: review.updatedAt.toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[review-decision]", error);
    return NextResponse.json(
      { error: "Unable to record this decision." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
