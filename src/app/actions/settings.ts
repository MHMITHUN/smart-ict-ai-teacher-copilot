"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import {
  displayNameSchema,
  fieldErrorsFromIssues,
} from "@/lib/validation/artifacts";

/**
 * Settings server actions. Only display-name updates mutate anything —
 * secrets (API keys, Mongo URIs) are NEVER shown or editable here; the
 * settings page only reports whether each env var is PRESENT (boolean).
 */

export interface DisplayNameFormState {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function updateDisplayNameAction(
  _prev: DisplayNameFormState,
  formData: FormData,
): Promise<DisplayNameFormState> {
  const user = await requireRole(["TEACHER", "ADMIN"], "/settings");

  const parsed = displayNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const store = await getStore();
  const updated = await store.updateUserName(user.id, parsed.data.name);
  if (!updated)
    return { error: "Your account could not be found — sign in again." };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { message: "Display name updated." };
}
