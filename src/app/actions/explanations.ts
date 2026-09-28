"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProvider } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/errors";
import { ExplanationSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import {
  explainerFormSchema,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";

/**
 * AI Explainer server actions (spec 20.6). Teacher-mode by default: the
 * draft stays private to the teacher until they review and approve it —
 * only then is it classroom-ready. The prompt forbids references, and any
 * uncertaintyNote from the model is stored and rendered prominently.
 */

export interface ExplainerFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidateExplainerPaths(): void {
  revalidatePath("/ai-explainer");
  revalidatePath("/library");
  revalidatePath("/dashboard");
}

export async function generateExplanationAction(
  _prev: ExplainerFormState,
  formData: FormData,
): Promise<ExplainerFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/ai-explainer");

  const parsed = explainerFormSchema.safeParse({
    question: formData.get("question"),
    confusion: formData.get("confusion"),
    topic: formData.get("topic"),
    audience: formData.get("audience") ?? "teacher",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const { question, confusion, topic, audience } = parsed.data;
  const promptInput = { question, confusion: confusion ?? "", topic, audience };

  let result;
  try {
    result = await getProvider().generate(
      "explainer",
      promptInput,
      ExplanationSchema,
    );
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: error.message };
    return {
      error: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const store = await getStore();
  const doc = await store.createExplanation({
    question,
    confusion: confusion || undefined,
    topic,
    audience,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: user.id,
  });

  revalidateExplainerPaths();
  redirect(`/ai-explainer?id=${doc.id}`);
}

export interface ExplanationSaveState {
  message?: string;
  error?: string;
}

/**
 * Save teacher edits (payload = full Explanation JSON). An emptied
 * uncertaintyNote is dropped (the field is optional); a non-empty one is
 * kept and stays prominent in the UI.
 */
export async function saveExplanationEditsAction(
  _prev: ExplanationSaveState,
  formData: FormData,
): Promise<ExplanationSaveState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/ai-explainer");
  const id = String(formData.get("id") ?? "");

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return {
      error:
        "The edited explanation could not be read. Reload the page and try again.",
    };
  }

  const parsed = ExplanationSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: `The edited explanation is not valid: ${
        first
          ? `${first.path.join(".") || "(root)"}: ${first.message}`
          : "validation failed"
      }.`,
    };
  }

  const store = await getStore();
  const updated = await store.updateExplanation(
    id,
    { content: parsed.data },
    user.id,
  );
  if (!updated)
    return { error: "Explanation not found — it may have been deleted." };

  revalidateExplainerPaths();
  return { message: "Edits saved." };
}

/**
 * DraftEditorShell approve contract: FormData { id } — the "teacher-reviewed" state.
 * Review-access rule: only the creator or an admin may approve.
 */
export async function approveExplanationAction(
  formData: FormData,
): Promise<void> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/ai-explainer");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  const explanation = await store.getExplanation(id);
  if (!explanation) return;
  if (!canApproveArtifact(user, explanation)) redirect("/403");
  await store.approveExplanation(id, user.id);
  revalidateExplainerPaths();
}

/** Delete ONLY drafts (the store enforces the draft guard atomically). */
export async function deleteExplanationDraftAction(
  formData: FormData,
): Promise<void> {
  await requireRole(["TEACHER", "ADMIN"], "/ai-explainer");
  const id = String(formData.get("id") ?? "");
  const store = await getStore();
  await store.deleteExplanationDraft(id);
  revalidateExplainerPaths();
  redirect("/ai-explainer");
}
