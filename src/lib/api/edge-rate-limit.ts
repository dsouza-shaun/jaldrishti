interface RateBucket {
  count: number;
  resetAtMs: number;
}

interface EdgeRateRegistry {
  buckets: Map<string, RateBucket>;
}

const globalWithRateRegistry = globalThis as typeof globalThis & {
  __jaldrishtiEdgeRateLimitV1?: EdgeRateRegistry;
};

const registry =
  globalWithRateRegistry.__jaldrishtiEdgeRateLimitV1 ??
  (globalWithRateRegistry.__jaldrishtiEdgeRateLimitV1 = {
    buckets: new Map<string, RateBucket>(),
  });

function clientKey(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function checkEdgeRateLimit(
  request: Request,
  name: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = `${name}:${clientKey(request)}`;
  const current = registry.buckets.get(key);
  if (!current || current.resetAtMs <= now) {
    registry.buckets.set(key, { count: 1, resetAtMs: now + windowMs });
    if (registry.buckets.size > 5_000) {
      for (const [bucketKey, bucket] of registry.buckets) {
        if (bucket.resetAtMs <= now) registry.buckets.delete(bucketKey);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAtMs - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Retry later.",
      },
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
