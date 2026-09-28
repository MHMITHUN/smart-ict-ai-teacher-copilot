/**
 * Prompt modules — one per artifact kind. Each exports a function that
 * builds the full prompt string (role framing + inputs + strict JSON
 * contract + worked mini-example + integrity rules).
 * Server-side only: prompts never reach the client.
 */

export { buildLessonPrompt, type LessonPromptInput } from "./lesson";
export { buildQuizPrompt, type QuizPromptInput } from "./quiz";
export { buildWorksheetPrompt, type WorksheetPromptInput } from "./worksheet";
export { buildRubricPrompt, type RubricPromptInput } from "./rubric";
export { buildExplainerPrompt, type ExplainerPromptInput } from "./explainer";
