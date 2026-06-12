/**
 * ⚠️  IN-MEMORY RATE LIMITER — NOT EFFECTIVE ON SERVERLESS (Vercel)
 *
 * Each serverless invocation gets its own memory, so the Map resets
 * per instance. This provides basic protection in development and
 * single-instance deployments only.
 *
 * For production on Vercel, replace with a persistent store:
 *   - Upstash Redis (@upstash/ratelimit)
 *   - Vercel KV
 *
 * TODO: migrate to @upstash/ratelimit for production
 */

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitRecord>();

if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
  console.warn("⚠️ Using in-memory rate limiter in production. This is ineffective on serverless (Vercel) and should be replaced with Redis.");
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
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

// Used by tests to keep them deterministic.
export function clearRateLimitBuckets() {
  buckets.clear();
}
