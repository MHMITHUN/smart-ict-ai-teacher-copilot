import type { ZodType } from "zod";

/**
 * Validation helper shared by every provider (spec 20.11):
 * parse the raw model text as JSON, then schema-validate it. Issues are
 * collected as human-readable strings so they can be appended to the
 * prompt for the single repair retry.
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

/** Strip a defensive markdown fence some models add despite instructions. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }
  return trimmed;
}

export function describeIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/**
 * Validate raw provider output against a zod schema.
 * JSON-parse failures are reported as validation issues (they feed the
 * repair retry too) instead of throwing.
 */
export function validateArtifact<T>(
  schema: ZodType<T>,
  raw: string,
): ValidationResult<T> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripFences(raw));
  } catch (error) {
    return {
      ok: false,
      issues: [
        `Response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false, issues: describeIssues(result.error.issues) };
  }
  return { ok: true, data: result.data };
}
