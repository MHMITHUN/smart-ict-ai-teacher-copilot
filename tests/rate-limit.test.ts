import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Fixed-window rate limiter (src/lib/rate-limit.ts): allows up to `max`
 * attempts per key inside a window, blocks extras with a retry hint in
 * seconds, opens a fresh window (count resets) once the old one expires,
 * and keeps keys independent. State sits on globalThis (HMR-surviving),
 * so every test uses its own key to stay isolated.
 */

let seq = 0;
const freshKey = () => `test:rate-limit:${++seq}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows up to max attempts inside one window", () => {
    const key = freshKey();
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(key, 10, 10 * 60 * 1000)).toEqual({
        ok: true,
        retryAfterSec: 0,
      });
    }
  });

  it("blocks the attempt after max and reports the seconds left", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));

    const key = freshKey();
    for (let i = 0; i < 10; i++) {
      rateLimit(key, 10, 10 * 60 * 1000);
    }

    // 30 seconds before the window closes.
    vi.setSystemTime(new Date("2026-09-28T10:09:30Z"));
    const blocked = rateLimit(key, 10, 10 * 60 * 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(30);
  });

  it("keeps counting inside the window (no early reset from time passing)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));

    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 10, 10 * 60 * 1000);
    }

    // Halfway through the window the budget is half gone, not refreshed.
    vi.setSystemTime(new Date("2026-09-28T10:05:00Z"));
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 10, 10 * 60 * 1000).ok).toBe(true);
    }
    expect(rateLimit(key, 10, 10 * 60 * 1000).ok).toBe(false);
  });

  it("opens a fresh window once the previous one has expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));

    const key = freshKey();
    for (let i = 0; i < 10; i++) {
      rateLimit(key, 10, 10 * 60 * 1000);
    }
    expect(rateLimit(key, 10, 10 * 60 * 1000).ok).toBe(false);

    // One second past the window close the count starts over.
    vi.setSystemTime(new Date("2026-09-28T10:10:01Z"));
    expect(rateLimit(key, 10, 10 * 60 * 1000)).toEqual({
      ok: true,
      retryAfterSec: 0,
    });
  });

  it("treats keys as independent counters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));

    const a = freshKey();
    const b = freshKey();
    for (let i = 0; i < 10; i++) {
      rateLimit(a, 10, 10 * 60 * 1000);
    }
    expect(rateLimit(a, 10, 10 * 60 * 1000).ok).toBe(false);
    expect(rateLimit(b, 10, 10 * 60 * 1000).ok).toBe(true);
  });
});
