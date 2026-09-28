import { describe, it, expect } from "vitest";
import { runGeneration } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/errors";
import { MockProvider } from "@/lib/ai/mock";
import { LessonPlanSchema } from "@/lib/ai/schemas";

/**
 * The shared generation engine (src/lib/ai/provider.ts runGeneration):
 * every provider response is zod-validated BEFORE anything reaches the UI.
 * On validation failure the engine runs exactly ONE repair retry with the
 * validation issues appended to the prompt — then surfaces an honest
 * AiGenerationError. Never partially-trusted model output.
 *
 * The provider is faked with an inline `produce` function so the first
 * response can be deliberately invalid.
 */

const LESSON_INPUT = {
  topic: "Repair Retry Probe",
  classLevel: "HSC",
  durationMin: 40,
  objectives: [],
  priorKnowledge: "",
  assessmentStyle: "Exit ticket",
};

/** A guaranteed-valid LessonPlan payload (mock output, re-serialized). */
async function validLessonJson(): Promise<string> {
  const result = await new MockProvider().generate(
    "lesson",
    LESSON_INPUT,
    LessonPlanSchema,
  );
  return JSON.stringify(result.data);
}

/** A structurally-close-but-invalid payload (title missing). */
async function invalidLessonJson(): Promise<string> {
  const valid = JSON.parse(await validLessonJson()) as Record<string, unknown>;
  delete valid.title;
  return JSON.stringify(valid);
}

describe("runGeneration: validation repair retry", () => {
  it("recovers when the FIRST response is invalid but the repair retry is valid", async () => {
    const valid = await validLessonJson();
    const invalid = await invalidLessonJson();
    const prompts: string[] = [];
    let call = 0;

    const result = await runGeneration("lesson", LESSON_INPUT, LessonPlanSchema, {
      name: "gemini",
      model: "gemini-2.5-flash-test",
      repairable: true,
      produce: async (prompt) => {
        call += 1;
        prompts.push(prompt);
        return call === 1 ? invalid : valid;
      },
    });

    expect(call).toBe(2); // exactly one repair retry
    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-2.5-flash-test");
    expect(result.data.title).toBeTruthy();

    // The repair prompt carries the original contract PLUS the exact
    // validation issues, so the model knows what to fix.
    expect(prompts[1]).toContain("REJECTED");
    expect(prompts[1]).toContain("title");
    expect(prompts[1]).toContain(LESSON_INPUT.topic); // original prompt kept
  });

  it("recovers when the first response is not even JSON", async () => {
    const valid = await validLessonJson();
    let call = 0;

    const result = await runGeneration("lesson", LESSON_INPUT, LessonPlanSchema, {
      name: "openai",
      model: "gpt-4o-mini",
      repairable: true,
      produce: async () => {
        call += 1;
        return call === 1 ? "```json\n{oops not json\n```" : valid;
      },
    });

    expect(call).toBe(2);
    expect(result.data.learningObjectives.length).toBeGreaterThan(0);
  });

  it("surfaces an honest validation error after ONE retry — never partial trust", async () => {
    const invalid = await invalidLessonJson();
    const prompts: string[] = [];
    let call = 0;

    const attempt = runGeneration("lesson", LESSON_INPUT, LessonPlanSchema, {
      name: "gemini",
      model: "gemini-2.5-flash-test",
      repairable: true,
      produce: async (prompt) => {
        call += 1;
        prompts.push(prompt);
        return invalid; // always invalid
      },
    });

    const error = await attempt.then(
      () => null,
      (caught) => caught as AiGenerationError,
    );
    expect(error).toBeInstanceOf(AiGenerationError);
    expect(error!.reason).toBe("validation");
    expect(error!.provider).toBe("gemini");
    expect(error!.issues && error!.issues.length).toBeGreaterThan(0);
    expect(error!.message).toContain("failed validation");
    expect(error!.message).toContain("Nothing was saved");
    expect(call).toBe(2); // initial + single repair retry, not more
    expect(prompts[1]).toContain("REJECTED");
  });

  it("does NOT repair-retry deterministic providers (mock): fail fast", async () => {
    const invalid = await invalidLessonJson();
    let call = 0;

    const error = await runGeneration(
      "lesson",
      LESSON_INPUT,
      LessonPlanSchema,
      {
        name: "mock",
        model: "mock-template-v1",
        repairable: false,
        produce: async () => {
          call += 1;
          return invalid;
        },
      },
    ).then(
      () => null,
      (caught) => caught as AiGenerationError,
    );

    expect(error).toBeInstanceOf(AiGenerationError);
    expect(error!.reason).toBe("validation");
    expect(call).toBe(1); // no retry for deterministic output
  });
});

describe("runGeneration: transport retry (timeout / network / 5xx)", () => {
  it("retries once when the transport throws, then succeeds", async () => {
    const valid = await validLessonJson();
    let call = 0;

    const result = await runGeneration("lesson", LESSON_INPUT, LessonPlanSchema, {
      name: "openai",
      model: "gpt-4o-mini",
      repairable: true,
      produce: async () => {
        call += 1;
        if (call === 1) throw new Error("fetch failed");
        return valid;
      },
    });

    expect(call).toBe(2);
    expect(result.data.title).toBeTruthy();
  });

  it("gives up after 2 transport attempts with an honest provider error", async () => {
    let call = 0;
    const error = await runGeneration(
      "lesson",
      LESSON_INPUT,
      LessonPlanSchema,
      {
        name: "gemini",
        model: "gemini-2.5-flash-test",
        repairable: true,
        produce: async () => {
          call += 1;
          throw new Error("network unreachable");
        },
      },
    ).then(
      () => null,
      (caught) => caught as AiGenerationError,
    );

    expect(error).toBeInstanceOf(AiGenerationError);
    expect(error!.reason).toBe("provider");
    expect(error!.message).toContain("failed after 2 attempts");
    expect(call).toBe(2);
  });
});
