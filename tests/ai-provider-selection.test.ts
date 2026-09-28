import { describe, it, expect, afterEach } from "vitest";
import {
  resolveProviderName,
  resolveModel,
  getProviderInfo,
  getProvider,
  DEFAULT_MODELS,
  type ProviderName,
} from "@/lib/ai/provider";
import { GeminiProvider } from "@/lib/ai/gemini";
import { OpenAIProvider } from "@/lib/ai/openai";
import { MockProvider } from "@/lib/ai/mock";

/**
 * Provider selection (spec 20.11): AI_PROVIDER override wins, else
 * GEMINI_API_KEY -> gemini, else OPENAI_API_KEY -> openai, else mock.
 * getProviderInfo must be safe for UI display (no keys).
 */

const ENV_KEYS = [
  "AI_PROVIDER",
  "AI_MODEL",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
] as const;

const SELECTED_ENV: Array<{
  name: string;
  env: Record<string, string | undefined>;
  expected: ProviderName;
}> = [
  {
    name: "no keys, no override -> mock",
    env: {},
    expected: "mock",
  },
  {
    name: "auto with no keys -> mock",
    env: { AI_PROVIDER: "auto" },
    expected: "mock",
  },
  {
    name: "GEMINI_API_KEY -> gemini",
    env: { GEMINI_API_KEY: "g-key" },
    expected: "gemini",
  },
  {
    name: "OPENAI_API_KEY only -> openai",
    env: { OPENAI_API_KEY: "o-key" },
    expected: "openai",
  },
  {
    name: "both keys -> gemini (priority)",
    env: { GEMINI_API_KEY: "g-key", OPENAI_API_KEY: "o-key" },
    expected: "gemini",
  },
  {
    name: "AI_PROVIDER=gemini overrides keys",
    env: { AI_PROVIDER: "gemini", OPENAI_API_KEY: "o-key" },
    expected: "gemini",
  },
  {
    name: "AI_PROVIDER=openai overrides gemini key",
    env: { AI_PROVIDER: "openai", GEMINI_API_KEY: "g-key" },
    expected: "openai",
  },
  {
    name: "AI_PROVIDER=mock forces mock even with keys",
    env: { AI_PROVIDER: "mock", GEMINI_API_KEY: "g-key" },
    expected: "mock",
  },
  {
    name: "unknown AI_PROVIDER value degrades to auto behavior",
    env: { AI_PROVIDER: "claude", GEMINI_API_KEY: "g-key" },
    expected: "gemini",
  },
];

describe("resolveProviderName", () => {
  for (const { name, env, expected } of SELECTED_ENV) {
    it(name, () => {
      expect(resolveProviderName(env)).toBe(expected);
    });
  }
});

describe("resolveModel", () => {
  it("uses the documented defaults per provider", () => {
    expect(resolveModel("gemini", {})).toBe("gemini-2.5-flash");
    expect(resolveModel("openai", {})).toBe("gpt-4o-mini");
    expect(resolveModel("mock", {})).toBe(DEFAULT_MODELS.mock);
  });

  it("AI_MODEL overrides the default for the selected provider", () => {
    expect(resolveModel("gemini", { AI_MODEL: "gemini-2.5-pro" })).toBe(
      "gemini-2.5-pro",
    );
    expect(resolveModel("openai", { AI_MODEL: "gpt-4o" })).toBe("gpt-4o");
  });
});

describe("getProviderInfo", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("reports mock mode honestly when no keys are set", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const info = getProviderInfo();
    expect(info).toMatchObject({
      provider: "mock",
      model: DEFAULT_MODELS.mock,
      label: "Mock",
      mockMode: true,
    });
  });

  it("reports gemini with its default model when the key is set", () => {
    process.env.GEMINI_API_KEY = "g-key";
    const info = getProviderInfo();
    expect(info).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
      label: "Gemini",
      mockMode: false,
    });
  });

  it("never exposes API keys in its output", () => {
    process.env.GEMINI_API_KEY = "super-secret-key";
    process.env.OPENAI_API_KEY = "another-secret";
    const serialized = JSON.stringify(getProviderInfo());
    expect(serialized).not.toContain("super-secret-key");
    expect(serialized).not.toContain("another-secret");
  });
});

describe("getProvider", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("returns the provider class matching the selection", () => {
    process.env.GEMINI_API_KEY = "g-key";
    expect(getProvider()).toBeInstanceOf(GeminiProvider);

    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "o-key";
    expect(getProvider()).toBeInstanceOf(OpenAIProvider);

    delete process.env.OPENAI_API_KEY;
    expect(getProvider()).toBeInstanceOf(MockProvider);
  });
});
