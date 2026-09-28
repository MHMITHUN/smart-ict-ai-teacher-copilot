import type { ZodType } from "zod";
import {
  buildLessonPrompt,
  buildQuizPrompt,
  buildWorksheetPrompt,
  buildRubricPrompt,
  buildExplainerPrompt,
} from "./prompts";
import { validateArtifact, describeIssues, type ValidationResult } from "./validate";
import { AiGenerationError } from "./errors";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { MockProvider } from "./mock";

/**
 * THE provider layer (spec 20.11): one interface, three implementations.
 *
 *   getProvider() ── AI_PROVIDER override, else GEMINI_API_KEY -> gemini,
 *                    else OPENAI_API_KEY -> openai, else mock.
 *
 * Every generate() call:
 *   1. builds the artifact prompt (prompts/ module),
 *   2. asks the provider (20s timeout, 1 transport retry),
 *   3. zod-validates the response BEFORE anything reaches the UI,
 *   4. on validation failure runs ONE repair retry with the validation
 *      error appended to the prompt, then surfaces an honest error.
 * No API key ever reaches the client — this module is server-only and is
 * imported exclusively from server actions / route handlers.
 */

export type ProviderName = "gemini" | "openai" | "mock";

export type ArtifactKind = "lesson" | "quiz" | "worksheet" | "rubric" | "explainer";

export interface GenerationResult<T> {
  data: T;
  provider: ProviderName;
  model: string;
}

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string;
  generate<T>(
    kind: ArtifactKind,
    input: Record<string, unknown>,
    schema: ZodType<T>,
  ): Promise<GenerationResult<T>>;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  mock: "mock-template-v1",
};

const PROVIDER_LABELS: Record<ProviderName, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  mock: "Mock",
};

/**
 * Pure selection function (unit-tested env matrix). Explicit override
 * always wins; "auto"/unknown/absent falls through to key detection with
 * Gemini priority, and no keys at all means the mock provider.
 */
export function resolveProviderName(
  env: Record<string, string | undefined> = process.env,
): ProviderName {
  const override = env.AI_PROVIDER?.trim().toLowerCase();
  if (override === "gemini" || override === "openai" || override === "mock") {
    return override;
  }
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/** Resolve the model id for a provider (AI_MODEL override, else default). */
export function resolveModel(
  provider: ProviderName,
  env: Record<string, string | undefined> = process.env,
): string {
  return env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
}

/** The process-wide provider instance. Never call from client code. */
export function getProvider(): AiProvider {
  switch (resolveProviderName()) {
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
    case "mock":
      return new MockProvider();
  }
}

/** Safe for UI display — provider, model and label only, never keys. */
export interface ProviderInfo {
  provider: ProviderName;
  model: string;
  label: string;
  /** True when generation runs on the deterministic mock (demo honesty). */
  mockMode: boolean;
}

export function getProviderInfo(env: Record<string, string | undefined> = process.env): ProviderInfo {
  const provider = resolveProviderName(env);
  return {
    provider,
    model: resolveModel(provider, env),
    label: PROVIDER_LABELS[provider],
    mockMode: provider === "mock",
  };
}

// ---------------------------------------------------------------------------
// Shared generation engine (validation + repair retry + transport retry)
// ---------------------------------------------------------------------------

export const REQUEST_TIMEOUT_MS = 20_000;
/** 1 initial attempt + 1 retry for transport failures (timeout, network, 5xx). */
const TRANSPORT_ATTEMPTS = 2;

const PROMPT_BUILDERS: Record<
  ArtifactKind,
  (input: Record<string, unknown>) => string
> = {
  lesson: (input) => buildLessonPrompt(input as never),
  quiz: (input) => buildQuizPrompt(input as never),
  worksheet: (input) => buildWorksheetPrompt(input as never),
  rubric: (input) => buildRubricPrompt(input as never),
  explainer: (input) => buildExplainerPrompt(input as never),
};

/** One transport attempt is a fetch; retry once on thrown transport errors. */
async function withTransportRetry<T>(provider: ProviderName, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw new AiGenerationError(
    `The ${provider} request failed after ${TRANSPORT_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    { reason: "provider", provider },
  );
}

export interface GenerateEngineConfig {
  name: ProviderName;
  model: string;
  /**
   * Produce a candidate. Real providers return the raw model text (the
   * engine parses + validates it); the mock returns a ready object.
   */
  produce: (prompt: string) => Promise<string | unknown>;
  /** Repair retry applies to real providers only (mock output is deterministic). */
  repairable: boolean;
}

function schemaCheck<T>(schema: ZodType<T>, produced: string | unknown): ValidationResult<T> {
  if (typeof produced === "string") {
    return validateArtifact(schema, produced);
  }
  const result = schema.safeParse(produced);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, issues: describeIssues(result.error.issues) };
}

function validationError<T>(provider: ProviderName, result: Extract<ValidationResult<T>, { ok: false }>): never {
  throw new AiGenerationError(
    `The ${provider} response failed validation and could not be repaired. Nothing was saved — please try again or adjust the inputs.`,
    { reason: "validation", provider, issues: result.issues },
  );
}

/** Shared engine every provider delegates to. */
export async function runGeneration<T>(
  kind: ArtifactKind,
  input: Record<string, unknown>,
  schema: ZodType<T>,
  config: GenerateEngineConfig,
): Promise<GenerationResult<T>> {
  const basePrompt = PROMPT_BUILDERS[kind](input);

  const first = schemaCheck(
    schema,
    await withTransportRetry(config.name, () => config.produce(basePrompt)),
  );
  if (first.ok) {
    return { data: first.data, provider: config.name, model: config.model };
  }
  if (!config.repairable) {
    validationError(config.name, first);
  }

  // Single repair retry: same prompt + the exact validation issues.
  const repairPrompt = [
    basePrompt,
    "",
    "YOUR PREVIOUS RESPONSE WAS REJECTED. It was not valid JSON or failed validation:",
    ...first.issues.map((issue) => `- ${issue}`),
    "Return the corrected JSON object following the original contract exactly. Output JSON only.",
  ].join("\n");

  const second = schemaCheck(
    schema,
    await withTransportRetry(config.name, () => config.produce(repairPrompt)),
  );
  if (second.ok) {
    return { data: second.data, provider: config.name, model: config.model };
  }
  validationError(config.name, second);
}
