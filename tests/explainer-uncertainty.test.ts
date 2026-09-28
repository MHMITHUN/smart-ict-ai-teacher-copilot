import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { MockProvider } from "@/lib/ai/mock";
import { buildExplainerPrompt } from "@/lib/ai/prompts/explainer";
import { ExplanationSchema } from "@/lib/ai/schemas";
import type { ExplanationDoc } from "@/lib/db/types";

/**
 * AI Explainer integrity (spec 20.6): the prompt forbids references
 * outright, uncertainty surfaces in uncertaintyNote, and the stored doc
 * keeps the note through create/edit/approve so the UI can render it
 * prominently. No references field exists anywhere in the schema.
 */

const TEACHER = "usr-teacher-01";

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

describe("explainer prompt: no-references instruction (spec 20.6)", () => {
  const prompt = buildExplainerPrompt({
    question: "Why is 13 written as 1101 in binary?",
    confusion: "They added the digits and got 3.",
    topic: "Number Systems",
    audience: "teacher",
  });

  it("includes the explicit no-references rule", () => {
    expect(prompt).toContain("Do not include references");
    expect(prompt).toMatch(
      /fabricating a reference is worse than giving none/i,
    );
  });

  it("never requests a references/citation field", () => {
    expect(prompt).not.toMatch(/"references"/);
    expect(prompt).not.toMatch(/"citations"/);
    expect(prompt).not.toMatch(/"sources"/);
  });

  it("keeps the uncertainty field OPTIONAL and honest", () => {
    expect(prompt).toMatch(/include ONLY if you are not fully certain/i);
  });

  it("echoes the teacher's inputs", () => {
    expect(prompt).toContain("Why is 13 written as 1101 in binary?");
    expect(prompt).toContain("Number Systems");
    expect(prompt).toContain("teacher");
  });
});

describe("explainer schema: uncertaintyNote in, references out", () => {
  it("accepts uncertaintyNote as the only optional integrity field", () => {
    const base = {
      simpleExplanation: "Positions have values.",
      analogy: "Boxes of money.",
      stepByStep: ["Write place values."],
      commonMistake: "Adding digits.",
      practiceQuestion: { question: "Convert 11.", answer: "1011" },
    };
    expect(ExplanationSchema.safeParse(base).success).toBe(true);
    expect(
      ExplanationSchema.safeParse({
        ...base,
        uncertaintyNote: "Verify the analogy.",
      }).success,
    ).toBe(true);
    // An empty note is invalid — silence must be real silence, not "".
    expect(
      ExplanationSchema.safeParse({ ...base, uncertaintyNote: "" }).success,
    ).toBe(false);
    // References are not part of the contract at all.
    expect("references" in ExplanationSchema.shape).toBe(false);
  });
});

describe("explainer doc: uncertaintyNote survives the review workflow", () => {
  async function createDraft(): Promise<ExplanationDoc> {
    const store = await getStore();
    const provider = new MockProvider();
    const promptInput = {
      question: "When does an XOR gate output 1?",
      confusion: "Thought it behaved like OR.",
      topic: "A Very Obscure Unlisted Topic",
      audience: "teacher",
    };
    // Unknown topic -> the honest mock stamps an uncertaintyNote.
    const result = await provider.generate(
      "explainer",
      promptInput,
      ExplanationSchema,
    );
    expect(result.data.uncertaintyNote).toBeDefined();
    return store.createExplanation({
      question: promptInput.question,
      confusion: promptInput.confusion,
      topic: promptInput.topic,
      audience: "teacher",
      content: result.data,
      promptInput,
      provider: result.provider,
      model: result.model,
      createdBy: TEACHER,
    });
  }

  it("stores and re-reads the uncertaintyNote with the doc", async () => {
    const store = await getStore();
    const doc = await createDraft();
    const reread = await store.getExplanation(doc.id);
    expect(reread).not.toBeNull();
    expect(reread!.content.uncertaintyNote).toBeTruthy();
    expect(reread!.status).toBe("draft");
    expect(reread!.provider).toBe("mock");
  });

  it("keeps the note through edits and approval (the UI relies on it)", async () => {
    const store = await getStore();
    const doc = await createDraft();
    const note = doc.content.uncertaintyNote!;

    const edited = await store.updateExplanation(
      doc.id,
      {
        content: {
          ...doc.content,
          simpleExplanation: "Teacher-verified explanation.",
          uncertaintyNote: note,
        },
      },
      "usr-teacher-02",
    );
    expect(edited!.content.uncertaintyNote).toBe(note);
    expect(edited!.content.simpleExplanation).toBe(
      "Teacher-verified explanation.",
    );

    const approved = await store.approveExplanation(doc.id, "usr-teacher-02");
    expect(approved!.status).toBe("approved");
    expect(approved!.content.uncertaintyNote).toBe(note);
  });

  it("lists explanations filterable by status; drafts are deletable, approved are not", async () => {
    const store = await getStore();
    const draft = await createDraft();
    const approvedDoc = await createDraft();
    await store.approveExplanation(approvedDoc.id, TEACHER);

    const drafts = await store.listExplanations({ status: "draft" });
    expect(drafts.some((doc) => doc.id === draft.id)).toBe(true);
    expect(drafts.some((doc) => doc.id === approvedDoc.id)).toBe(false);

    expect(await store.deleteExplanationDraft(approvedDoc.id)).toBe(false);
    expect(await store.deleteExplanationDraft(draft.id)).toBe(true);
    expect(await store.getExplanation(draft.id)).toBeNull();
  });
});
