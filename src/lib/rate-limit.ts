/**
 * Fixed-window rate limiter for server actions and route handlers.
 *
 * Counters live in a Map stored on globalThis (via Symbol.for, so even
 * duplicated module copies share one store) — this survives Next.js dev
 * HMR, which would reset plain module-level state on every hot reload.
 *
 * The counter is in-memory and therefore PER-INSTANCE: on serverless or
 * multi-instance deployments each server instance keeps its own
 * independent counters, so the effective limit is roughly max x instance
 * count, and counters are lost on restart or re-deploy. Swap in a shared
 * store (e.g. Redis) behind this same signature if a global limit is
 * ever needed.
 */

interface RateLimitEntry {
  count: number;
  /** Epoch ms at which the current window closes. */
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets; 0 when ok. */
  retryAfterSec: number;
}

const WINDOWS = Symbol.for("smart-ict.rate-limit-windows");

type RateLimitGlobal = typeof globalThis & {
  [WINDOWS]?: Map<string, RateLimitEntry>;
};

function windows(): Map<string, RateLimitEntry> {
  const g = globalThis as RateLimitGlobal;
  g[WINDOWS] ??= new Map();
  return g[WINDOWS];
}

/**
 * Count one attempt against `key`. Callers choose the granularity
 * (e.g. `login:<email>`, `export:<userId>`); keys are independent.
 *
 * @param max      Attempts allowed per window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const store = windows();
  const entry = store.get(key);

  // No entry yet, or the previous window has closed -> fresh window.
  if (!entry || entry.resetAt <= now) {
    // Sweep expired entries while we are here: keys often derive from
    // user-supplied values (emails), and this keeps the map bounded.
    for (const [k, v] of store) {
      if (v.resetAt <= now) store.delete(k);
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (entry.count < max) {
    entry.count += 1;
    return { ok: true, retryAfterSec: 0 };
  }

  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}
