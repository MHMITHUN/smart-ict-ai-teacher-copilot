"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProvider } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/errors";
import { LessonPlanSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import {
  lessonFormSchema,
  splitLines,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";
import { canApproveArtifact } from "@/lib/artifacts/review-access";

/**
 * Lesson Planner server actions (spec 20.3). Every action guards the
 * session itself; generation runs ONLY here, server-side, and the result is
 * zod-validated by the provider layer before it is saved as a draft.
 */

export interface LessonFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidateLessonPaths(): void {
  revalidatePath("/lesson-planner");
  revalidatePath("/lesson-planner/saved");
}

export async function generateLessonPlanAction(
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/lesson-planner");

  const parsed = lessonFormSchema.safeParse({
    topic: formData.get("topic"),
    classLevel: formData.get("classLevel"),
    durationMin: formData.get("durationMin"),
    objectivesText: formData.get("objectives"),
    priorKnowledge: formData.get("priorKnowledge"),
    assessmentStyle: formData.get("assessmentStyle"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const { topic, classLevel, durationMin, priorKnowledge, assessmentStyle } = parsed.data;
  const objectives = splitLines(parsed.data.objectivesText);
  const promptInput = {
    topic,
    classLevel,
    durationMin,
    objectives,
    priorKnowledge: priorKnowledge ?? "",
    assessmentStyle,
  };

  let result;
  try {
    result = await getProvider().generate("lesson", promptInput, LessonPlanSchema);
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: error.message };
    return {
      error: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const store = await getStore();
  const doc = await store.createLessonPlan({
    title: result.data.title,
    topic,
    classLevel,
    durationMin,
    objectives: result.data.learningObjectives,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: user.id,
  });

  revalidateLessonPaths();
  redirect(`/lesson-planner?id=${doc.id}`);
}

export interface LessonSaveState {
  message?: string;
  error?: string;
}

/** Save teacher edits to every LessonPlan field (payload = LessonPlan JSON). */
export async function saveLessonEditsAction(
  _prev: LessonSaveState,
  formData: FormData,
): Promise<LessonSaveState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/lesson-planner");
  const id = String(formData.get("id") ?? "");

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The edited draft could not be read. Reload the page and try again." };
  }

  const parsed = LessonPlanSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: `The edited draft is not valid: ${
        first ? `${first.path.join(".") || "(root)"}: ${first.message}` : "validation failed"
      }`,
    };
  }

  const store = await getStore();
  const updated = await store.updateLessonPlan(
    id,
    {
      title: parsed.data.title,
      objectives: parsed.data.learningObjectives,
      content: parsed.data,
    },
    user.id,
  );
  if (!updated) return { error: "Lesson plan not found — it may have been deleted." };

  revalidateLessonPaths();
  return { message: "Edits saved." };
}

/**
 * DraftEditorShell approve contract: FormData { id }.
 * Review-access rule: only the creator or an admin may approve (the page
 * hides the button; this is the server-side enforcement).
 */
export async function approveLessonPlanAction(formData: FormData): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/lesson-planner");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const lesson = await store.getLessonPlan(id);
  if (!lesson) return;
  if (!canApproveArtifact(user, lesson)) redirect("/403");
  await store.approveLessonPlan(id, user.id);
  revalidateLessonPaths();
}

/** Delete ONLY drafts (the store enforces the draft guard atomically). */
export async function deleteLessonPlanAction(formData: FormData): Promise<void> {
  await requireRole(["TEACHER", "ADMIN"], "/lesson-planner");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  await store.deleteLessonPlanDraft(id);
  revalidateLessonPaths();
}

/** Copy a lesson plan into a fresh draft owned by the current teacher. */
export async function duplicateLessonPlanAction(formData: FormData): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/lesson-planner");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const source = await store.getLessonPlan(id);
  if (!source) redirect("/lesson-planner/saved");

  const copy = await store.createLessonPlan({
    title: `${source.title} (copy)`,
    topic: source.topic,
    classLevel: source.classLevel,
    durationMin: source.durationMin,
    objectives: source.objectives,
    content: source.content,
    promptInput: source.promptInput,
    provider: source.provider,
    model: source.model,
    createdBy: user.id,
  });
  revalidateLessonPaths();
  redirect(`/lesson-planner?id=${copy.id}`);
}
