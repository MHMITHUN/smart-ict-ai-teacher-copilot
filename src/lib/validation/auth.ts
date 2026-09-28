import { z } from "zod";

/**
 * Auth request schemas, shared by the server actions in
 * src/app/actions/auth.ts and unit-tested in tests/auth-session.test.ts.
 * Kept in this module — a "use server" file may only export async
 * functions, so the schemas must live outside it to be importable.
 *
 * No self-registration: this is a teacher tool (spec 11), accounts are
 * created by an ADMIN, so only a login schema is needed here. B/C add the
 * createUserSchema next to it when the Settings user management ships.
 */

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;
