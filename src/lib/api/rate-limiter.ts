export interface SerialRateLimiter {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export class RateLimitQueueFullError extends Error {
  constructor() {
    super("The geocoding request queue is full. Retry shortly.");
    this.name = "RateLimitQueueFullError";
  }
}

/**
 * Serializes work and spaces operation start times. The queue is bounded so an
 * unauthenticated caller cannot retain an unlimited chain of pending requests.
 * This remains process-local; multi-instance deployments need a shared limiter.
 */
export function createSerialRateLimiter(
  minimumIntervalMs: number,
  maxPending = 8,
): SerialRateLimiter {
  let queue: Promise<void> = Promise.resolve();
  let pending = 0;
  let lastStartedAtMs = 0;

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      if (pending >= maxPending) {
        return Promise.reject(new RateLimitQueueFullError());
      }

      pending += 1;
      const result = queue.then(async () => {
        const waitMs = Math.max(
          0,
          lastStartedAtMs + minimumIntervalMs - Date.now(),
        );
        if (waitMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        }

        lastStartedAtMs = Date.now();
        return operation();
      });

      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result.finally(() => {
        pending -= 1;
      });
    },
  };
}
