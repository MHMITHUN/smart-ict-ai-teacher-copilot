"use client";

import { useActionState } from "react";
import { Sparkles, Info } from "lucide-react";
import {
  generateLessonPlanAction,
  type LessonFormState,
} from "@/app/actions/lessons";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  ASSESSMENT_STYLES,
  CLASS_LEVELS,
} from "@/lib/validation/artifacts";

/** Two-pane Lesson Planner: the generation form (left pane). */
export function LessonGeneratorForm({ mockMode }: { mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    generateLessonPlanAction,
    {} as LessonFormState,
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
        name="lesson-topic"
        error={state.fieldErrors?.topic}
        hint="e.g. Number Systems, Computer Network, HTML basics"
      >
        {(aria) => (
          <Input
            id={aria.id}
            name="topic"
            required
            placeholder="e.g. Number Systems"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class level" name="lesson-level" error={state.fieldErrors?.classLevel}>
          {(aria) => (
            <Select
              id={aria.id}
              name="classLevel"
              defaultValue="HSC"
              invalid={aria.invalid}
              aria-invalid={aria["aria-invalid"]}
            >
              {CLASS_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Duration (minutes)"
          name="lesson-duration"
          error={state.fieldErrors?.durationMin}
          hint="5 - 240 minutes"
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="durationMin"
              type="number"
              min={5}
              max={240}
              step={5}
              defaultValue={40}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>
      </div>

      <Field
        label="Learning objectives"
        name="lesson-objectives"
        error={state.fieldErrors?.objectivesText}
        hint="Optional — one objective per line. The AI drafts the rest."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="objectives"
            rows={3}
            placeholder={"Students will be able to convert decimal to binary\nStudents will be able to verify a conversion"}
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field
        label="Prior knowledge"
        name="lesson-prior"
        error={state.fieldErrors?.priorKnowledge}
        hint="What the class already knows."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="priorKnowledge"
            rows={2}
            placeholder="e.g. Decimal arithmetic; place values"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field label="Assessment style" name="lesson-assessment" error={state.fieldErrors?.assessmentStyle}>
        {(aria) => (
          <Select id={aria.id} name="assessmentStyle" defaultValue="Exit ticket">
            {ASSESSMENT_STYLES.map((style) => (
              <option key={style} value={style}>
                {style}
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
        {pending ? "Drafting lesson..." : "Generate draft"}
      </Button>
    </form>
  );
}
