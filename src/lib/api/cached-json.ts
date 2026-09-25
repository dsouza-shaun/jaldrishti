export type MemoryCacheStatus = "MISS" | "HIT" | "STALE";

export interface RememberedValue<T> {
  data: T;
  retrievedAt: string;
  cacheStatus: MemoryCacheStatus;
}

interface CacheEntry<T> {
  value?: T;
  retrievedAtMs: number;
  freshUntilMs: number;
  staleUntilMs: number;
  retryAtMs: number;
  failureCount: number;
  lastError?: unknown;
  promise?: Promise<T>;
}

interface CacheRegistry {
  entries: Map<string, CacheEntry<unknown>>;
}

const globalWithCache = globalThis as typeof globalThis & {
  __jaldrishtiExternalDataCacheV1?: CacheRegistry;
};

const registry =
  globalWithCache.__jaldrishtiExternalDataCacheV1 ??
  (globalWithCache.__jaldrishtiExternalDataCacheV1 = {
    entries: new Map<string, CacheEntry<unknown>>(),
  });

const MAX_ENTRIES = 2_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1_000;

function pruneRegistry(): void {
  if (registry.entries.size < MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of registry.entries) {
    const removable =
      !entry.promise &&
      (entry.value === undefined
        ? entry.retryAtMs <= now
        : entry.staleUntilMs <= now);
    if (removable) registry.entries.delete(key);
  }

  while (registry.entries.size >= MAX_ENTRIES) {
    const oldestKey = registry.entries.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = registry.entries.get(oldestKey);
    if (oldest?.promise) break;
    registry.entries.delete(oldestKey);
  }
}

function retryDelayMs(error: unknown, failureCount: number): number {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
  const baseDelay =
    status === 429
      ? 60_000
      : status === 403
        ? 5 * 60_000
        : status !== null && status >= 500
          ? 15_000
          : 2_000;
  return Math.min(
    MAX_RETRY_DELAY_MS,
    baseDelay * 2 ** Math.max(0, failureCount - 1),
  );
}

async function refreshEntry<T>(
  entry: CacheEntry<T>,
  loader: () => Promise<T>,
  ttlMs: number,
  staleMs: number,
): Promise<T> {
  try {
    const value = await loader();
    const now = Date.now();
    entry.value = value;
    entry.retrievedAtMs = now;
    entry.freshUntilMs = now + ttlMs;
    entry.staleUntilMs = now + ttlMs + staleMs;
    entry.retryAtMs = 0;
    entry.failureCount = 0;
    entry.lastError = undefined;
    return value;
  } catch (error) {
    entry.failureCount += 1;
    entry.lastError = error;
    entry.retryAtMs = Date.now() + retryDelayMs(error, entry.failureCount);
    throw error;
  } finally {
    entry.promise = undefined;
  }
}

function result<T>(
  entry: CacheEntry<T>,
  data: T,
  cacheStatus: MemoryCacheStatus,
): RememberedValue<T> {
  return {
    data,
    retrievedAt: new Date(entry.retrievedAtMs).toISOString(),
    cacheStatus,
  };
}

/**
 * Process-local, stale-on-error cache in front of Next's persistent fetch
 * cache. Concurrent requests share one refresh, failures back off, and memory
 * is bounded. Multi-instance deployments still require shared cache and rate
 * limiting to enforce an upstream-wide request budget.
 */
export async function remember<T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  loader: () => Promise<T>,
): Promise<RememberedValue<T>> {
  const now = Date.now();
  let entry = registry.entries.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    pruneRegistry();
    entry = {
      retrievedAtMs: 0,
      freshUntilMs: 0,
      staleUntilMs: 0,
      retryAtMs: 0,
      failureCount: 0,
    };
    registry.entries.set(key, entry as CacheEntry<unknown>);
  }

  if (entry.value !== undefined && now < entry.freshUntilMs) {
    return result(entry, entry.value, "HIT");
  }

  if (now < entry.retryAtMs) {
    if (entry.value !== undefined && now < entry.staleUntilMs) {
      return result(entry, entry.value, "STALE");
    }
    throw entry.lastError ?? new Error("Provider refresh is in backoff");
  }

  if (entry.promise) {
    try {
      const value = await entry.promise;
      return result(entry, value, "HIT");
    } catch (error) {
      if (entry.value !== undefined && Date.now() < entry.staleUntilMs) {
        return result(entry, entry.value, "STALE");
      }
      throw error;
    }
  }

  if (entry.value !== undefined && now < entry.staleUntilMs) {
    entry.promise = refreshEntry(entry, loader, ttlMs, staleMs);
    void entry.promise.catch(() => undefined);
    return result(entry, entry.value, "STALE");
  }

  entry.promise = refreshEntry(entry, loader, ttlMs, staleMs);
  try {
    const value = await entry.promise;
    return result(entry, value, "MISS");
  } catch (error) {
    if (entry.value !== undefined && Date.now() < entry.staleUntilMs) {
      return result(entry, entry.value, "STALE");
    }
    throw error;
  }
}

export function clearMemoryCache(prefix?: string): void {
  if (!prefix) {
    registry.entries.clear();
    return;
  }

  for (const key of registry.entries.keys()) {
    if (key.startsWith(prefix)) registry.entries.delete(key);
  }
}
