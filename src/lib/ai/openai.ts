import type { ZodType } from "zod";
import { AiGenerationError } from "./errors";
import { ROLE_FRAME } from "./prompts/shared";
import {
  REQUEST_TIMEOUT_MS,
  resolveModel,
  runGeneration,
  type ArtifactKind,
  type AiProvider,
  type GenerationResult,
  type ProviderName,
} from "./provider";

/**
 * OpenAI provider (chat completions API, response_format json_object).
 * One 20s-timeout call per attempt; the shared engine owns retry +
 * validation. Server-side only.
 */

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenAIProvider implements AiProvider {
  readonly name: ProviderName = "openai";

  get model(): string {
    return resolveModel("openai");
  }

  async generate<T>(
    kind: ArtifactKind,
    input: Record<string, unknown>,
    schema: ZodType<T>,
  ): Promise<GenerationResult<T>> {
    return runGeneration(kind, input, schema, {
      name: this.name,
      model: this.model,
      repairable: true,
      produce: (prompt) => this.complete(prompt),
    });
  }

  /** One API call. Throws plain transport errors — the engine retries once. */
  private async complete(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AiGenerationError(
        "OPENAI_API_KEY is not set, but the OpenAI provider is selected. Set OPENAI_API_KEY or switch AI_PROVIDER to auto/mock (see .env.example).",
        { reason: "provider", provider: "openai" },
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ROLE_FRAME },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `OpenAI API returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
      );
    }

    const json = (await response.json()) as ChatResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("OpenAI API returned no message content.");
    }
    return text;
  }
}
