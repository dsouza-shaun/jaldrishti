import {
  remember,
  type MemoryCacheStatus,
} from "@/lib/api/cached-json";

export class ExternalApiError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

export interface ProviderAttribution {
  label: string;
  sourceUrl: string;
  licenseUrl: string;
  transformationNote: string;
}

export interface ProviderResult<T> {
  data: T;
  provider: string;
  sourceUrl: string;
  retrievedAt: string;
  cacheStatus: MemoryCacheStatus;
  /** Live geocoder/model output is derived context, not an authoritative observation. */
  evidenceStatus: "PROXY";
}

interface FetchJsonOptions {
  provider: string;
  ttlMs: number;
  staleMs: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  cacheTags?: string[];
  requestScheduler?: (operation: () => Promise<Response>) => Promise<Response>;
}

const SECRET_QUERY_KEYS = new Set([
  "apikey",
  "api_key",
  "key",
  "token",
  "access_token",
  "password",
]);

export function redactUrl(url: URL): URL {
  const redacted = new URL(url.toString());
  redacted.username = "";
  redacted.password = "";
  for (const key of [...redacted.searchParams.keys()]) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
      redacted.searchParams.set(key, "REDACTED");
    }
  }
  redacted.searchParams.sort();
  return redacted;
}

function isJsonResponseBody(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestJson<T>(
  url: URL,
  provider: string,
  timeoutMs: number,
  headers: Record<string, string>,
  ttlMs: number,
  cacheTags: string[],
  requestScheduler?: (operation: () => Promise<Response>) => Promise<Response>,
): Promise<T> {
  const containsApiKey = [...url.searchParams.keys()].some((key) =>
    SECRET_QUERY_KEYS.has(key.toLowerCase()),
  );
  let response: Response;
  try {
    const performRequest = () =>
      fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "JalDrishti/0.3.1",
          ...headers,
        },
        // A customer key is part of the upstream URL contract. Do not persist a
        // URL containing that secret in Next's data cache; the bounded process
        // cache still deduplicates it using only the redacted canonical URL.
        ...(containsApiKey
          ? { cache: "no-store" as const }
          : {
              cache: "force-cache" as const,
              next: {
                revalidate: Math.max(1, Math.ceil(ttlMs / 1_000)),
                tags: cacheTags,
              },
            }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    response = requestScheduler
      ? await requestScheduler(performRequest)
      : await performRequest();
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "RateLimitQueueFullError"
    ) {
      throw new ExternalApiError(
        "The geocoding request queue is full",
        provider,
        429,
      );
    }
    const message =
      error instanceof Error ? error.message : "Network request failed";
    throw new ExternalApiError(message, provider);
  }

  if (!response.ok) {
    throw new ExternalApiError(
      `Upstream request failed with HTTP ${response.status}`,
      provider,
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ExternalApiError("Upstream returned invalid JSON", provider);
  }

  if (!isJsonResponseBody(payload)) {
    throw new ExternalApiError(
      "Upstream returned an unexpected payload",
      provider,
    );
  }

  return payload as T;
}

export async function fetchJsonCached<T>(
  cacheKey: string,
  url: URL,
  options: FetchJsonOptions,
): Promise<ProviderResult<T>> {
  const publicUrl = redactUrl(url);
  const remembered = await remember(
    `${cacheKey}|${publicUrl.toString()}`,
    options.ttlMs,
    options.staleMs,
    () =>
      requestJson<T>(
        url,
        options.provider,
        options.timeoutMs ?? 8_000,
        options.headers ?? {},
        options.ttlMs,
        options.cacheTags ?? [],
        options.requestScheduler,
      ),
  );

  return {
    data: remembered.data,
    provider: options.provider,
    sourceUrl: publicUrl.toString(),
    retrievedAt: remembered.retrievedAt,
    cacheStatus: remembered.cacheStatus,
    evidenceStatus: "PROXY",
  };
}
