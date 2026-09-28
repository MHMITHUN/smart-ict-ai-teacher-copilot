/**
 * AI output schemas — one module per artifact kind.
 * EVERY provider response is validated against one of these BEFORE it
 * reaches the UI (spec 20.11 + 10); on failure the provider layer runs a
 * single repair retry and otherwise surfaces an honest error.
 */

export {
  LessonPlanSchema,
  type LessonPlan,
} from "./lesson";
export {
  QuizSpecSchema,
  QuizQuestionSchema,
  QuestionTypeSchema,
  DifficultySchema,
  type QuizSpec,
  type QuizQuestion,
  type QuestionType,
  type Difficulty,
} from "./quiz";
export {
  WorksheetSpecSchema,
  WorksheetSectionSchema,
  type WorksheetSpec,
  type WorksheetSection,
} from "./worksheet";
export {
  RubricSpecSchema,
  RubricCriterionSchema,
  type RubricSpec,
  type RubricCriterion,
} from "./rubric";
export {
  ExplanationSchema,
  type Explanation,
} from "./explainer";
