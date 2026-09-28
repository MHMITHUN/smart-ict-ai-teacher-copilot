/**
 * Settings > Environment status (spec 20.13 / demo honesty).
 *
 * The settings page reports WHICH configuration keys are present — never
 * their values. This module is the single source of that report so it can
 * be unit-tested: every item is a key + boolean `present` + a human note,
 * and by construction no environment value can leak into the UI through it.
 */

export interface EnvStatusItem {
  /** The environment variable name (public knowledge, safe to show). */
  key: string;
  /** True when the variable is set — the VALUE is never read out. */
  present: boolean;
  /** One-line explanation of what the key does. */
  note: string;
}

/** Keys reported on the settings page, in display order. */
export const REPORTED_ENV_KEYS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "AI_PROVIDER",
  "AI_MODEL",
  "MONGODB_URI",
] as const;

export function getEnvStatus(
  env: Record<string, string | undefined> = process.env,
): EnvStatusItem[] {
  return [
    {
      key: "GEMINI_API_KEY",
      present: Boolean(env.GEMINI_API_KEY),
      note: "Enables the Gemini provider (priority when both keys are set).",
    },
    {
      key: "OPENAI_API_KEY",
      present: Boolean(env.OPENAI_API_KEY),
      note: "Enables the OpenAI provider as the fallback.",
    },
    {
      key: "AI_PROVIDER",
      present: Boolean(env.AI_PROVIDER),
      note: "Optional override: gemini | openai | mock.",
    },
    {
      key: "AI_MODEL",
      present: Boolean(env.AI_MODEL),
      note: "Optional model override (defaults are provider-specific).",
    },
    {
      key: "MONGODB_URI",
      present: Boolean(env.MONGODB_URI),
      note: "Persistence: MongoStore when set, in-memory demo store otherwise.",
    },
  ];
}
