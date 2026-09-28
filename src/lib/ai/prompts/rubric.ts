import { ROLE_FRAME, JSON_CONTRACT, INTEGRITY_RULES, formatInputBlock } from "./shared";

/** Teacher inputs for rubric generation (spec 20.8). */
export interface RubricPromptInput {
  /** The assignment or task being assessed. */
  assignmentTitle: string;
  classLevel: string;
  /** Desired number of criteria (default 4 if unset). */
  criteriaCount?: number;
  /** Target total points (the criteria points must sum to it). */
  totalPoints?: number;
}

const FIELD_CONTRACT = `Return a JSON object with EXACTLY these fields:
{
  "title": string — rubric title including the assignment,
  "criteria": array of criterion objects (use the requested count):
  {
    "criterion": string — what is being judged, e.g. "Correctness of conversions",
    "excellent": string — what excellent work looks like,
    "good": string — what good work looks like,
    "developing": string — what developing work looks like,
    "beginning": string — what beginning work looks like,
    "points": integer — points for this criterion (all criteria points must sum to totalPoints)
  },
  "totalPoints": integer — the sum of all criterion points
}`;

const MINI_EXAMPLE = `Worked mini-example (shape only — adapt fully to the inputs, never copy it literally):
{"title":"Lab Report Rubric: Number Conversion Lab","criteria":[{"criterion":"Correctness of conversions","excellent":"All conversions correct and verified.","good":"1-2 minor slips, method correct.","developing":"Several errors, method partly correct.","beginning":"Most conversions incorrect.","points":40},{"criterion":"Presentation of working","excellent":"Working shown step by step, easy to follow.","good":"Working mostly shown.","developing":"Working patchy.","beginning":"Answers only.","points":10}],"totalPoints":50}`;

export function buildRubricPrompt(input: RubricPromptInput): string {
  return [
    ROLE_FRAME,
    "",
    "TASK: Generate a grading rubric for the following assignment.",
    "",
    "TEACHER INPUTS:",
    formatInputBlock(input),
    "",
    FIELD_CONTRACT,
    "",
    MINI_EXAMPLE,
    "",
    JSON_CONTRACT,
    INTEGRITY_RULES,
  ].join("\n");
}
