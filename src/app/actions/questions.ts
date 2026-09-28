"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { QuizSpecSchema, type QuizQuestion } from "@/lib/ai/schemas";
import { getStore } from "@/lib/db";
import type { QuestionBankStatus } from "@/lib/db/types";
import { requireRole } from "@/lib/auth/guards";
import {
  questionFormSchema,
  parseTags,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";

/**
 * Question Bank server actions (spec 20.5): manual create/edit, duplicate,
 * publish/archive status transitions, bulk ops, and "add to quiz".
 * All input is zod-validated here before it reaches the store.
 */

export interface QuestionFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function questionValuesFromFormData(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const options =
    type === "mcq"
      ? formData
          .getAll("options")
          .map((option) => String(option))
          .filter((option) => option.trim().length > 0)
      : undefined;
  return {
    question: formData.get("question"),
    type,
    difficulty: formData.get("difficulty"),
    topic: formData.get("topic"),
    learningObjective: formData.get("learningObjective"),
    options,
    answer: formData.get("answer"),
    explanation: formData.get("explanation"),
    tagsCsv: formData.get("tags") ?? undefined,
  };
}

export async function createQuestionAction(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/question-bank");

  const parsed = questionFormSchema.safeParse(questionValuesFromFormData(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const store = await getStore();
  try {
    await store.createQuestion({
      question: parsed.data.question,
      type: parsed.data.type,
      difficulty: parsed.data.difficulty,
      topic: parsed.data.topic,
      learningObjective: parsed.data.learningObjective,
      options: parsed.data.type === "mcq" ? parsed.data.options : undefined,
      answer: parsed.data.type === "true_false" ? parsed.data.answer.toLowerCase() : parsed.data.answer,
      explanation: parsed.data.explanation,
      tags: parseTags(parsed.data.tagsCsv),
      source: "manual",
      createdBy: user.id,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the question." };
  }

  revalidatePath("/question-bank");
  redirect("/question-bank?created=1");
}

export async function updateQuestionAction(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/question-bank");
  const id = String(formData.get("id") ?? "");

  const parsed = questionFormSchema.safeParse(questionValuesFromFormData(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const store = await getStore();
  const updated = await store.updateQuestion(
    id,
    {
      question: parsed.data.question,
      type: parsed.data.type,
      difficulty: parsed.data.difficulty,
      topic: parsed.data.topic,
      learningObjective: parsed.data.learningObjective,
      options: parsed.data.type === "mcq" ? parsed.data.options : undefined,
      answer:
        parsed.data.type === "true_false" ? parsed.data.answer.toLowerCase() : parsed.data.answer,
      explanation: parsed.data.explanation,
      tags: parseTags(parsed.data.tagsCsv),
    },
    user.id,
  );
  if (!updated) return { error: "Question not found — it may have been deleted." };

  revalidatePath("/question-bank");
  redirect("/question-bank?updated=1");
}

async function applyQuestionStatus(
  id: string,
  status: QuestionBankStatus,
): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/question-bank");
  const store = await getStore();
  await store.setQuestionStatus(id, status, user.id);
  revalidatePath("/question-bank");
}

/**
 * Row + bulk actions below use the React 19 bound-server-action pattern:
 * the page calls e.g. `publishQuestionAction.bind(null, question.id)` for
 * the button's formAction. (A submit button's own name/value pair is NOT
 * included in FormData when a form submits through a server action, so
 * ids/statuses are passed via binding instead.)
 */
export async function publishQuestionAction(id: string, _formData: FormData): Promise<void> {
  void _formData;
  await applyQuestionStatus(id, "published");
}

export async function archiveQuestionAction(id: string, _formData: FormData): Promise<void> {
  void _formData;
  await applyQuestionStatus(id, "archived");
}

export async function restoreQuestionAction(id: string, _formData: FormData): Promise<void> {
  void _formData;
  await applyQuestionStatus(id, "draft");
}

export async function duplicateQuestionAction(id: string, _formData: FormData): Promise<void> {
  void _formData;
  const user = await requireRole(["TEACHER", "ADMIN"], "/question-bank");
  const store = await getStore();
  await store.duplicateQuestion(id, user.id);
  revalidatePath("/question-bank");
}

async function bulkSetStatus(
  status: QuestionBankStatus,
  formData: FormData,
): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/question-bank");
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter((id) => id.length > 0);
  if (ids.length === 0) {
    revalidatePath("/question-bank");
    return;
  }
  const store = await getStore();
  await store.bulkSetQuestionStatus(ids, status, user.id);
  revalidatePath("/question-bank");
}

export async function bulkArchiveQuestionsAction(formData: FormData): Promise<void> {
  await bulkSetStatus("archived", formData);
}

export async function bulkPublishQuestionsAction(formData: FormData): Promise<void> {
  await bulkSetStatus("published", formData);
}

/** "Add to quiz": append a bank question to a quiz (skipped if the prompt is already there). */
export async function appendQuestionToQuizAction(formData: FormData): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/question-bank");
  const questionId = String(formData.get("questionId") ?? "");
  const quizId = String(formData.get("quizId") ?? "");
  const store = await getStore();

  const question = await store.getQuestion(questionId);
  const quiz = await store.getQuiz(quizId);
  if (!question || !quiz) {
    redirect("/question-bank");
  }

  const alreadyPresent = quiz.content.questions.some(
    (existing) => existing.prompt.trim().toLowerCase() === question.question.trim().toLowerCase(),
  );
  if (!alreadyPresent) {
    const appended: QuizQuestion = {
      prompt: question.question,
      type: question.type,
      options: question.type === "mcq" ? question.options : undefined,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
    };
    const content = QuizSpecSchema.parse({
      ...quiz.content,
      questions: [...quiz.content.questions, appended],
    });
    await store.updateQuiz(quizId, { content }, user.id);
  }

  revalidatePath("/question-bank");
  revalidatePath("/quiz-generator");
  redirect(
    `/question-bank?added=${alreadyPresent ? "0" : "1"}&quiz=${encodeURIComponent(quiz.content.title)}`,
  );
}
