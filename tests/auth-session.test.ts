import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_MAX_AGE,
  type SessionPayload,
} from "@/lib/auth/session";

/**
 * Stateless session tokens (src/lib/auth/session.ts): roundtrip, tamper
 * rejection, expiry rejection and payload-schema enforcement. This app has
 * exactly two roles — TEACHER and ADMIN. Cookie helper functions
 * (setSessionCookie etc.) need a Next.js request scope and are covered by
 * the e2e login flow instead.
 */

const TEST_SECRET = "unit-test-session-secret";

/** Sign a payload with the same scheme the module uses (HMAC-SHA256). */
function forgeToken(payload: SessionPayload, secret: string): string {
  const b64url = (input: Buffer | string) =>
    Buffer.from(input)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  const encoded = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest();
  return `${encoded}.${b64url(signature)}`;
}

beforeEach(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
});

describe("createSessionToken / verifySessionToken", () => {
  it("roundtrips: a fresh token verifies and carries the same uid and role", () => {
    const token = createSessionToken({ uid: "usr-teacher-01", role: "TEACHER" });
    const payload = verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.uid).toBe("usr-teacher-01");
    expect(payload!.role).toBe("TEACHER");
    // Expiry is one session-window ahead, never in the past.
    const nowSec = Math.floor(Date.now() / 1000);
    expect(payload!.exp).toBeGreaterThan(nowSec);
    expect(payload!.exp).toBeLessThanOrEqual(nowSec + SESSION_MAX_AGE);
  });

  it("rejects a tampered payload (signature no longer matches)", () => {
    const token = createSessionToken({ uid: "usr-teacher-01", role: "TEACHER" });
    const [encodedPayload, encodedSignature] = token.split(".");

    // Decode, escalate the role, re-encode - the signature is untouched.
    const payload = JSON.parse(
      Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as SessionPayload;
    payload.role = "ADMIN";
    const forgedPayload = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    expect(verifySessionToken(`${forgedPayload}.${encodedSignature}`)).toBeNull();
  });

  it("rejects a signature made with the wrong secret", () => {
    const payload: SessionPayload = {
      uid: "usr-admin-01",
      role: "ADMIN",
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    expect(verifySessionToken(forgeToken(payload, "a-different-secret"))).toBeNull();
  });

  it("rejects an expired token", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expired: SessionPayload = {
      uid: "usr-teacher-01",
      role: "TEACHER",
      exp: nowSec - 1,
    };
    expect(verifySessionToken(forgeToken(expired, TEST_SECRET))).toBeNull();
  });

  it("rejects a token whose expiry is exactly now (boundary is inclusive)", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const boundary: SessionPayload = {
      uid: "usr-teacher-01",
      role: "TEACHER",
      exp: nowSec,
    };
    expect(verifySessionToken(forgeToken(boundary, TEST_SECRET))).toBeNull();
  });

  it("rejects a valid-signature token with a role outside TEACHER/ADMIN", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      uid: "usr-student-01",
      role: "STUDENT", // this app has no student role (spec 11)
      exp: nowSec + 60,
    };
    expect(verifySessionToken(forgeToken(payload as unknown as SessionPayload, TEST_SECRET))).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("onlyonepart")).toBeNull();
    expect(verifySessionToken("a.")).toBeNull();
    expect(verifySessionToken(".b")).toBeNull();
    expect(verifySessionToken("!!!.???")).toBeNull();
  });
});
