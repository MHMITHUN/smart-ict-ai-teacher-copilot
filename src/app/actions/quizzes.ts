"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProvider } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/errors";
import { QuizSpecSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { questionDraftsFromQuiz } from "@/lib/artifacts/quiz-to-bank";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import {
  quizFormSchema,
  questionTypesFor,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";

/**
 * Quiz Generator server actions (spec 20.4): generate -> edit -> approve,
 * then export approved questions into the Question Bank (dedup by prompt)
 * or print/export. Generation runs only here, server-side.
 */

export interface QuizFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidateQuizPaths(): void {
  revalidatePath("/quiz-generator");
  revalidatePath("/question-bank");
}

export async function generateQuizAction(
  _prev: QuizFormState,
  formData: FormData,
): Promise<QuizFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/quiz-generator");

  const parsed = quizFormSchema.safeParse({
    topic: formData.get("topic"),
    classLevel: formData.get("classLevel"),
    questionCount: formData.get("questionCount"),
    difficulty: formData.get("difficulty"),
    quizType: formData.get("quizType"),
    learningObjective: formData.get("learningObjective"),
    language: formData.get("language"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const { topic, classLevel, questionCount, difficulty, quizType, language } = parsed.data;
  const promptInput = {
    topic,
    classLevel,
    questionCount,
    difficulty,
    questionTypes: questionTypesFor(quizType),
    learningObjective: parsed.data.learningObjective ?? "",
    language,
  };

  let result;
  try {
    result = await getProvider().generate("quiz", promptInput, QuizSpecSchema);
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: error.message };
    return {
      error: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const store = await getStore();
  const doc = await store.createQuiz({
    topic,
    classLevel,
    questionCount,
    difficulty: result.data.difficulty,
    language,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: user.id,
  });

  revalidateQuizPaths();
  redirect(`/quiz-generator?id=${doc.id}`);
}

export interface QuizSaveState {
  message?: string;
  error?: string;
}

/** Save teacher edits (payload = full QuizSpec JSON, questions included). */
export async function saveQuizEditsAction(
  _prev: QuizSaveState,
  formData: FormData,
): Promise<QuizSaveState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/quiz-generator");
  const id = String(formData.get("id") ?? "");

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The edited quiz could not be read. Reload the page and try again." };
  }

  const parsed = QuizSpecSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: `The edited quiz is not valid: ${
        first ? `${first.path.join(".") || "(root)"}: ${first.message}` : "validation failed"
      }. Fix the highlighted question fields and save again.`,
    };
  }

  const store = await getStore();
  const updated = await store.updateQuiz(id, { content: parsed.data }, user.id);
  if (!updated) return { error: "Quiz not found — it may have been deleted." };

  revalidateQuizPaths();
  return { message: "Edits saved." };
}

/**
 * DraftEditorShell approve contract: FormData { id }.
 * Review-access rule: only the creator or an admin may approve.
 */
export async function approveQuizAction(formData: FormData): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/quiz-generator");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const quiz = await store.getQuiz(id);
  if (!quiz) return;
  if (!canApproveArtifact(user, quiz)) redirect("/403");
  await store.approveQuiz(id, user.id);
  revalidateQuizPaths();
}

export async function deleteQuizDraftAction(formData: FormData): Promise<void> {
  await requireRole(["TEACHER", "ADMIN"], "/quiz-generator");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  await store.deleteQuizDraft(id);
  revalidateQuizPaths();
  redirect("/quiz-generator");
}

/**
 * Approved-only action: bulk-insert the quiz's questions into the bank,
 * deduped by prompt. Redirects back with an honest result summary.
 */
export async function sendQuizToBankAction(formData: FormData): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/quiz-generator");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const quiz = await store.getQuiz(id);

  if (!quiz || quiz.status !== "approved") {
    redirect("/quiz-generator?id=" + encodeURIComponent(id));
  }

  const drafts = questionDraftsFromQuiz(quiz, user.id);
  const { inserted, skipped } = await store.addQuestionsToBank(drafts);
  revalidateQuizPaths();
  redirect(
    `/quiz-generator?id=${encodeURIComponent(id)}&sent=${inserted.length}&skipped=${skipped.length}`,
  );
}
