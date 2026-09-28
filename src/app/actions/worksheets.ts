"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProvider } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/errors";
import { WorksheetSpecSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import {
  worksheetFormSchema,
  splitLines,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";

/**
 * Worksheet Generator server actions (spec 20.7): generate -> edit every
 * field -> approve, then print or copy into a document. Generation runs
 * ONLY here, server-side; the result is zod-validated by the provider
 * layer before it is stored as a draft.
 */

export interface WorksheetFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidateWorksheetPaths(): void {
  revalidatePath("/worksheets");
  revalidatePath("/library");
  revalidatePath("/dashboard");
}

export async function generateWorksheetAction(
  _prev: WorksheetFormState,
  formData: FormData,
): Promise<WorksheetFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/worksheets");

  const parsed = worksheetFormSchema.safeParse({
    topic: formData.get("topic"),
    classLevel: formData.get("classLevel"),
    sectionCount: formData.get("sectionCount"),
    difficultyMix: formData.get("difficultyMix"),
    learningGoalsText: formData.get("learningGoals"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const { topic, classLevel, sectionCount, difficultyMix } = parsed.data;
  const learningGoals = splitLines(parsed.data.learningGoalsText);
  const promptInput = {
    topic,
    classLevel,
    sectionCount,
    difficultyMix,
    learningGoals,
    focus: "",
  };

  let result;
  try {
    result = await getProvider().generate(
      "worksheet",
      promptInput,
      WorksheetSpecSchema,
    );
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: error.message };
    return {
      error: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const store = await getStore();
  const doc = await store.createWorksheet({
    topic,
    classLevel,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: user.id,
  });

  revalidateWorksheetPaths();
  redirect(`/worksheets?id=${doc.id}`);
}

export interface WorksheetSaveState {
  message?: string;
  error?: string;
}

/** Save teacher edits (payload = full WorksheetSpec JSON). */
export async function saveWorksheetEditsAction(
  _prev: WorksheetSaveState,
  formData: FormData,
): Promise<WorksheetSaveState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/worksheets");
  const id = String(formData.get("id") ?? "");

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return {
      error:
        "The edited worksheet could not be read. Reload the page and try again.",
    };
  }

  const parsed = WorksheetSpecSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: `The edited worksheet is not valid: ${
        first
          ? `${first.path.join(".") || "(root)"}: ${first.message}`
          : "validation failed"
      }. Fix the highlighted field and save again.`,
    };
  }

  const store = await getStore();
  const updated = await store.updateWorksheet(
    id,
    { content: parsed.data },
    user.id,
  );
  if (!updated)
    return { error: "Worksheet not found — it may have been deleted." };

  revalidateWorksheetPaths();
  return { message: "Edits saved." };
}

/**
 * DraftEditorShell approve contract: FormData { id }.
 * Review-access rule: only the creator or an admin may approve.
 */
export async function approveWorksheetAction(
  formData: FormData,
): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/worksheets");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const worksheet = await store.getWorksheet(id);
  if (!worksheet) return;
  if (!canApproveArtifact(user, worksheet)) redirect("/403");
  await store.approveWorksheet(id, user.id);
  revalidateWorksheetPaths();
}

/** Delete ONLY drafts (the store enforces the draft guard atomically). */
export async function deleteWorksheetDraftAction(
  formData: FormData,
): Promise<void> {
  await requireRole(["TEACHER", "ADMIN"], "/worksheets");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  await store.deleteWorksheetDraft(id);
  revalidateWorksheetPaths();
  redirect("/worksheets");
}
