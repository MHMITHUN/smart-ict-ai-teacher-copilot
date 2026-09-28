/**
 * Tiny constants/helpers shared by BOTH stores (kept dependency-free so
 * MongoStore never pulls in the demo seeds or the AI layer).
 */

/** Default page size for question listings (spec 20.5: 15 per page). */
export const QUESTIONS_PER_PAGE = 15;
export const MAX_QUESTIONS_PER_PAGE = 100;

/** Dedup key for question text: trimmed, whitespace-collapsed, lowercase. */
export function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
