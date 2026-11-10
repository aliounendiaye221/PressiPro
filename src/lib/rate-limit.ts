/**
 * Rate Limiter — Dual-mode (Upstash Redis or In-Memory fallback)
 */

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const MAX_MEMORY_BUCKETS = 5_000;
const buckets = new Map<string, RateLimitRecord>();

function pruneMemoryBuckets(now: number) {
  if (buckets.size < MAX_MEMORY_BUCKETS) return;
  for (const [k, record] of buckets) {
    if (record.resetAt <= now) {
      buckets.delete(k);
    }
  }
  while (buckets.size >= MAX_MEMORY_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

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
    if (!current) {
      pruneMemoryBuckets(now);
    }
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
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now?: number
): Promise<RateLimitResult> {
  if (now !== undefined) {
    return checkRateLimitInMemory(key, limit, windowMs, now);
  }

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
      // Upstash call failed — fall through to bounded in-memory limiter.
    }
  }

  return checkRateLimitInMemory(key, limit, windowMs);
}

export function checkRateLimitSync(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  return checkRateLimitInMemory(key, limit, windowMs, now);
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
