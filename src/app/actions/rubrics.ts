"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProvider } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/errors";
import { RubricSpecSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import {
  rubricFormSchema,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";

/**
 * Rubric Builder server actions (spec 20.8): generate a criteria table,
 * edit every cell, approve. totalPoints is recomputed from the criteria
 * points on every save so the stored rubric is always internally
 * consistent (the editor shows the same auto total).
 */

export interface RubricFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidateRubricPaths(): void {
  revalidatePath("/rubrics");
  revalidatePath("/library");
  revalidatePath("/dashboard");
}

export async function generateRubricAction(
  _prev: RubricFormState,
  formData: FormData,
): Promise<RubricFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/rubrics");

  const parsed = rubricFormSchema.safeParse({
    assignmentTitle: formData.get("assignmentTitle"),
    topic: formData.get("topic"),
    classLevel: formData.get("classLevel"),
    criteriaCount: formData.get("criteriaCount"),
    totalPoints: formData.get("totalPoints"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const { assignmentTitle, topic, classLevel, criteriaCount, totalPoints } =
    parsed.data;
  const promptInput = {
    assignmentTitle,
    topic,
    classLevel,
    criteriaCount,
    totalPoints,
  };

  let result;
  try {
    result = await getProvider().generate(
      "rubric",
      promptInput,
      RubricSpecSchema,
    );
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: error.message };
    return {
      error: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const store = await getStore();
  const doc = await store.createRubric({
    assignmentTitle,
    topic,
    classLevel,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: user.id,
  });

  revalidateRubricPaths();
  redirect(`/rubrics?id=${doc.id}`);
}

export interface RubricSaveState {
  message?: string;
  error?: string;
}

/** Save teacher edits (payload = full RubricSpec JSON; total auto-summed). */
export async function saveRubricEditsAction(
  _prev: RubricSaveState,
  formData: FormData,
): Promise<RubricSaveState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/rubrics");
  const id = String(formData.get("id") ?? "");

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return {
      error:
        "The edited rubric could not be read. Reload the page and try again.",
    };
  }

  const parsed = RubricSpecSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: `The edited rubric is not valid: ${
        first
          ? `${first.path.join(".") || "(root)"}: ${first.message}`
          : "validation failed"
      }. Every cell needs text and points must be positive whole numbers.`,
    };
  }

  // Auto total: the stored totalPoints is always the criteria sum.
  const content = {
    ...parsed.data,
    totalPoints: parsed.data.criteria.reduce(
      (sum, criterion) => sum + criterion.points,
      0,
    ),
  };

  const store = await getStore();
  const updated = await store.updateRubric(id, { content }, user.id);
  if (!updated)
    return { error: "Rubric not found — it may have been deleted." };

  revalidateRubricPaths();
  return { message: "Edits saved." };
}

/**
 * DraftEditorShell approve contract: FormData { id }.
 * Review-access rule: only the creator or an admin may approve.
 */
export async function approveRubricAction(formData: FormData): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/rubrics");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const rubric = await store.getRubric(id);
  if (!rubric) return;
  if (!canApproveArtifact(user, rubric)) redirect("/403");
  await store.approveRubric(id, user.id);
  revalidateRubricPaths();
}

/** Delete ONLY drafts (the store enforces the draft guard atomically). */
export async function deleteRubricDraftAction(
  formData: FormData,
): Promise<void> {
  await requireRole(["TEACHER", "ADMIN"], "/rubrics");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  await store.deleteRubricDraft(id);
  revalidateRubricPaths();
  redirect("/rubrics");
}
