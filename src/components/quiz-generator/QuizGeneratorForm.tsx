"use client";

import { useActionState } from "react";
import { Sparkles, Info } from "lucide-react";
import { generateQuizAction, type QuizFormState } from "@/app/actions/quizzes";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  CLASS_LEVELS,
  QUIZ_DIFFICULTIES,
  QUIZ_LANGUAGES,
  QUIZ_TYPES,
} from "@/lib/validation/artifacts";

/** Two-pane Quiz Generator: the generation form (left pane). */
export function QuizGeneratorForm({ mockMode }: { mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    generateQuizAction,
    {} as QuizFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert tone="danger" title="Generation failed">
          {state.error}
        </Alert>
      )}

      <Field
        label="Topic"
        name="quiz-topic"
        error={state.fieldErrors?.topic}
        hint="e.g. Database, C Programming loops, Network topologies"
      >
        {(aria) => (
          <Input
            id={aria.id}
            name="topic"
            required
            placeholder="e.g. Database"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field label="Class level" name="quiz-level" error={state.fieldErrors?.classLevel}>
        {(aria) => (
          <Select id={aria.id} name="classLevel" defaultValue="HSC">
            {CLASS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Number of questions"
          name="quiz-count"
          error={state.fieldErrors?.questionCount}
          hint="3 to 15 questions"
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="questionCount"
              type="number"
              min={3}
              max={15}
              defaultValue={6}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>

        <Field label="Difficulty" name="quiz-difficulty" error={state.fieldErrors?.difficulty}>
          {(aria) => (
            <Select id={aria.id} name="difficulty" defaultValue="medium">
              {QUIZ_DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level === "mixed" ? "mixed (varies per question)" : level}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Quiz type" name="quiz-type" error={state.fieldErrors?.quizType}>
        {(aria) => (
          <Select id={aria.id} name="quizType" defaultValue="MCQ">
            {QUIZ_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Learning objective"
        name="quiz-objective"
        error={state.fieldErrors?.learningObjective}
        hint="Optional — what should this quiz measure?"
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="learningObjective"
            rows={2}
            placeholder="e.g. Students can convert between decimal and binary"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field
        label="Language"
        name="quiz-language"
        error={state.fieldErrors?.language}
        hint="Bangla output uses Bangla instructions and prompts."
      >
        {(aria) => (
          <Select id={aria.id} name="language" defaultValue="English">
            {QUIZ_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {mockMode && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Mock mode: drafts are deterministic sample templates, clearly labeled.
          Set GEMINI_API_KEY or OPENAI_API_KEY for real generation.
        </p>
      )}

      <Button type="submit" loading={pending} className="w-fit">
        {!pending && <Sparkles className="size-4" aria-hidden="true" />}
        {pending ? "Generating quiz..." : "Generate draft"}
      </Button>
    </form>
  );
}
