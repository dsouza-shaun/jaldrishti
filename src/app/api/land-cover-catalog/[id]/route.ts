import {
  checkEdgeRateLimit,
  rateLimitResponse,
} from "@/lib/api/edge-rate-limit";
import { renderLandCoverPng } from "@/lib/data/land-cover-render";

/**
 * Colour-mapped PNG of one bundled WorldCover footprint.
 *
 * The id is the raster's content hash, so a rebuild that changes the pixels
 * also changes the URL and cannot serve a stale image from a cache. No
 * filesystem path is ever taken from the request, and the lookup is a scan over
 * the in-memory index rather than a join to user input.
 */

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  // A content hash is 64 lowercase hex characters.
  if (!/^[a-f0-9]{64}$/.test(id)) {
    return new Response("Malformed raster id.", { status: 400 });
  }

  const rate = checkEdgeRateLimit(request, "land-cover-png", 120, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const rendered = await renderLandCoverPng(id);
    if (!rendered) {
      return new Response("Unknown raster.", { status: 404 });
    }
    return new Response(new Uint8Array(rendered.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(rendered.png.byteLength),
        // Immutable: the id is the content hash.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(`[land-cover-png] ${id}`, error);
    return new Response("Raster could not be rendered.", { status: 500 });
  }
}
