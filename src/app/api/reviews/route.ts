import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canAccessProject, getSessionUser, projectScopeFor } from "@/lib/auth/session";
import type { AnalysisResult } from "@/lib/engines/orchestrator";
import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";

export const runtime = "nodejs";

const submitSchema = z.object({ projectId: z.string().min(1) });

/**
 * GET /api/reviews
 *
 * The review queue. An Authority sees every submitted project, because that is
 * the job; a Developer sees only their own submissions and their current
 * status, so they can act on the feedback.
 */
export async function GET(req: NextRequest) {
  const rate = checkEdgeRateLimit(req, "reviews", 120, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const reviews = await db.review.findMany({
      // Scope through the project relation: the rule is about who owns the
      // project, not about who wrote the review row.
      where: { project: projectScopeFor(user) },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        reviewer: { select: { displayName: true, organisation: true } },
        project: {
          select: {
            id: true,
            projectName: true,
            latitude: true,
            longitude: true,
            createdAt: true,
            developer: { select: { displayName: true, organisation: true, username: true } },
            analyses: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { resultJson: true, createdAt: true },
            },
          },
        },
      },
    });

    const items = reviews.map((review) => {
      const latest = review.project.analyses[0];
      let classification: string | null = null;
      let waterKlPerDay: number | null = null;
      if (latest) {
        try {
          const parsed = JSON.parse(latest.resultJson) as AnalysisResult;
          classification = parsed.classification?.classification ?? null;
          const value = Number(parsed.waterDemand?.waterKlPerDay ?? NaN);
          waterKlPerDay = Number.isFinite(value) ? value : null;
        } catch {
          // A corrupt result row should not take the whole queue down; the row
          // still lists the project and its review state.
        }
      }

      return {
        id: review.id,
        projectId: review.projectId,
        projectName: review.project.projectName,
        latitude: review.project.latitude,
        longitude: review.project.longitude,
        developerName: review.project.developer?.displayName ?? "Unknown developer",
        developerOrganisation: review.project.developer?.organisation ?? null,
        decision: review.decision,
        comments: review.comments,
        submittedAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        reviewerName: review.reviewer?.displayName ?? null,
        hasAnalysis: Boolean(latest),
        classification,
        waterKlPerDay,
      };
    });

    return NextResponse.json(
      { reviews: items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[reviews-list]", error);
    return NextResponse.json(
      { error: "Unable to load the review queue." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * POST /api/reviews - submit a project for authority review.
 *
 * A submission is only meaningful once a screening exists, so this checks for
 * an analysis rather than trusting the client. Re-submitting a project that
 * already has an open review updates that row instead of creating a duplicate
 * queue entry, which is what a developer resubmitting after a change means.
 */
export async function POST(req: NextRequest) {
  const rate = checkEdgeRateLimit(req, "review-submit", 20, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (user.role !== "DEVELOPER") {
    return NextResponse.json(
      { error: "Only a Developer account can submit a project for review." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = submitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A project reference is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const project = await db.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project || !canAccessProject(user, project)) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const analysis = await db.analysis.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!analysis) {
      return NextResponse.json(
        { error: "Run a screening before submitting this project for review." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const open = await db.review.findFirst({
      where: { projectId: project.id, decision: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const review = open
      ? await db.review.update({
          where: { id: open.id },
          data: { comments: null, reviewerId: null, updatedAt: new Date() },
        })
      : await db.review.create({
          data: { projectId: project.id, decision: "PENDING" },
        });

    return NextResponse.json(
      {
        review: {
          id: review.id,
          projectId: review.projectId,
          decision: review.decision,
          updatedAt: review.updatedAt.toISOString(),
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[review-submit]", error);
    return NextResponse.json(
      { error: "Unable to submit this project for review." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
