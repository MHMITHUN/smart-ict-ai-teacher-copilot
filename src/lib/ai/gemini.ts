import type { ZodType } from "zod";
import { AiGenerationError } from "./errors";
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
 * Google Gemini provider (generativelanguage.googleapis.com v1beta
 * generateContent, responseMimeType application/json). One 20s-timeout
 * REST call per attempt; the shared engine owns retry + validation.
 * Server-side only.
 */

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

export class GeminiProvider implements AiProvider {
  readonly name: ProviderName = "gemini";

  get model(): string {
    return resolveModel("gemini");
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

  /** One REST call. Throws plain transport errors — the engine retries once. */
  private async complete(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AiGenerationError(
        "GEMINI_API_KEY is not set, but the Gemini provider is selected. Set GEMINI_API_KEY or switch AI_PROVIDER to auto/mock (see .env.example).",
        { reason: "provider", provider: "gemini" },
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Gemini API returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
      );
    }

    const json = (await response.json()) as GeminiResponse;
    const text = json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error(
        "Gemini API returned no content (the response may have been blocked or empty).",
      );
    }
    return text;
  }
}
