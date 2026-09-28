import { describe, it, expect } from "vitest";
import { getEnvStatus, REPORTED_ENV_KEYS } from "@/lib/settings/env-status";

/**
 * Settings > Environment status (src/lib/settings/env-status.ts): the page
 * may only report WHICH keys are present (booleans) — never their values.
 * These tests pin that contract: secret-looking values must never appear
 * anywhere in the report, not even partially.
 */

const SECRET_VALUES = [
  "AIzaSy-very-secret-gemini-key-1234567890",
  "sk-proj-openai-super-secret-value",
  "mongodb+srv://user:pass@cluster0.example.mongodb.net/?retryWrites=true",
];

describe("getEnvStatus", () => {
  it("reports every configured key as absent in an empty environment", () => {
    const report = getEnvStatus({});
    expect(report.map((item) => item.key)).toEqual([...REPORTED_ENV_KEYS]);
    for (const item of report) {
      expect(item.present).toBe(false);
      expect(typeof item.note).toBe("string");
      expect(item.note.length).toBeGreaterThan(0);
    }
  });

  it("flips to present=true only for keys that are actually set", () => {
    const report = getEnvStatus({
      GEMINI_API_KEY: SECRET_VALUES[0],
      MONGODB_URI: SECRET_VALUES[2],
    });
    const byKey = Object.fromEntries(report.map((item) => [item.key, item]));

    expect(byKey.GEMINI_API_KEY.present).toBe(true);
    expect(byKey.MONGODB_URI.present).toBe(true);
    expect(byKey.OPENAI_API_KEY.present).toBe(false);
    expect(byKey.AI_PROVIDER.present).toBe(false);
    expect(byKey.AI_MODEL.present).toBe(false);
  });

  it("NEVER leaks values: no environment value appears in the serialized report", () => {
    const env: Record<string, string | undefined> = {
      GEMINI_API_KEY: SECRET_VALUES[0],
      OPENAI_API_KEY: SECRET_VALUES[1],
      MONGODB_URI: SECRET_VALUES[2],
      AI_PROVIDER: "openai", // non-secret override values...
      AI_MODEL: "gpt-4o-test", // ...must not leak either
    };
    const serialized = JSON.stringify(getEnvStatus(env));

    for (const secret of SECRET_VALUES) {
      expect(serialized).not.toContain(secret);
    }
    // Even fragments of the secrets must not slip through the notes.
    expect(serialized).not.toContain("AIzaSy");
    expect(serialized).not.toContain("sk-proj");
    expect(serialized).not.toContain("mongodb+srv");
    expect(serialized).not.toContain("user:pass");
    // The non-secret override VALUES stay out of the report too (the notes
    // legitimately mention provider NAMES, never what was configured).
    expect(serialized).not.toContain("gpt-4o-test");
  });

  it("treats an empty-string value as not set (Boolean coercion)", () => {
    const report = getEnvStatus({ OPENAI_API_KEY: "" });
    const byKey = Object.fromEntries(report.map((item) => [item.key, item]));
    expect(byKey.OPENAI_API_KEY.present).toBe(false);
  });
});
