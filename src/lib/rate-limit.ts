/**
 * Rate Limiter — Dual-mode (Upstash Redis or In-Memory fallback)
 *
 * • Production (Vercel): Uses @upstash/ratelimit + Upstash Redis.
 *   Requires env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
 *
 * • Development / single-instance: Falls back to an in-memory Map.
 *   The Map resets per process, which is fine for local dev.
 *
 * The public API is unchanged — callers use `checkRateLimit()`.
 */

// ---------------------------------------------------------------------------
// In-Memory fallback (dev / single instance)
// ---------------------------------------------------------------------------

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitRecord>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: 0,
  };
}

// ---------------------------------------------------------------------------
// Upstash Redis (production / serverless)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let upstashLimiterCache: Map<string, { limiter: any; windowMs: number; limit: number }> | null = null;

function getUpstashEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url, token };
  }
  return null;
}

/**
 * Lazily build an Upstash Ratelimit instance per (limit, windowMs) pair.
 * Instances are cached so we don't create a new one per request.
 */
async function getUpstashLimiter(limit: number, windowMs: number) {
  const env = getUpstashEnv();
  if (!env) return null;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    if (!upstashLimiterCache) {
      upstashLimiterCache = new Map();
    }

    const cacheKey = `${limit}:${windowMs}`;
    const cached = upstashLimiterCache.get(cacheKey);
    if (cached) return cached.limiter;

    const redis = new Redis({ url: env.url, token: env.token });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
      analytics: false,
      prefix: "pressipro:rl",
    });

    upstashLimiterCache.set(cacheKey, { limiter, windowMs, limit });
    return limiter;
  } catch {
    // If Upstash packages are not available, fall back silently.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * @param key     Unique key (e.g. `auth:login:ip:1.2.3.4`)
 * @param limit   Max number of requests allowed in the window
 * @param windowMs  Window size in milliseconds
 * @param now     Current timestamp (useful for deterministic tests)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now?: number
): Promise<RateLimitResult> {
  // If a timestamp is provided (tests), always use in-memory.
  if (now !== undefined) {
    return checkRateLimitInMemory(key, limit, windowMs, now);
  }

  // Try Upstash first.
  const upstash = await getUpstashLimiter(limit, windowMs);
  if (upstash) {
    try {
      const result = await upstash.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        retryAfterSeconds: result.success
          ? 0
          : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch {
      // Upstash call failed — fall through to in-memory.
    }
  }

  // Fallback to in-memory.
  return checkRateLimitInMemory(key, limit, windowMs);
}

/**
 * Synchronous rate limit check — always in-memory.
 * Used by callers that cannot be async (kept for backward compatibility).
 */
export function checkRateLimitSync(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  return checkRateLimitInMemory(key, limit, windowMs, now);
}

// Used by tests to keep them deterministic.
export function clearRateLimitBuckets() {
  buckets.clear();
}
