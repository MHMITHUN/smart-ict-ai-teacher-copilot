"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

/** Login throttling: max attempts per email per fixed window. */
const LOGIN_LIMIT = {
  max: 10,
  windowMs: 10 * 60 * 1000, // 10 minutes
} as const;

export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
}

/** First validation message per field, from a zod error's issues. */
function fieldErrorsFromIssues(
  issues: z.ZodIssue[],
): AuthFormState["fieldErrors"] {
  const out: AuthFormState["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if ((key === "email" || key === "password") && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  // Only same-site absolute paths, no protocol tricks.
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues;
    return { fieldErrors: fieldErrorsFromIssues(issues) };
  }

  const { email, password } = parsed.data;

  // Throttle by normalized email before touching the user store. The
  // counter is in-memory and per-instance (see src/lib/rate-limit.ts).
  const throttle = rateLimit(
    `login:${email.trim().toLowerCase()}`,
    LOGIN_LIMIT.max,
    LOGIN_LIMIT.windowMs,
  );
  if (!throttle.ok) {
    const minutes = Math.max(1, Math.ceil(throttle.retryAfterSec / 60));
    return {
      error: `Too many attempts - try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const store = await getStore();
  const user = await store.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Incorrect email or password." };
  }

  await setSessionCookie(
    createSessionToken({ uid: user.id, role: user.role }),
  );

  const next = safeNextPath(formData.get("next"));
  redirect(next ?? "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
