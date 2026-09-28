"use client";

import { useActionState } from "react";
import { Sparkles, Info } from "lucide-react";
import {
  generateRubricAction,
  type RubricFormState,
} from "@/app/actions/rubrics";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { CLASS_LEVELS } from "@/lib/validation/artifacts";

/** Rubric Builder: the generation form (left pane, spec 20.8). */
export function RubricGeneratorForm({ mockMode }: { mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    generateRubricAction,
    {} as RubricFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert tone="danger" title="Generation failed">
          {state.error}
        </Alert>
      )}

      <Field
        label="Assignment title"
        name="rubric-title"
        error={state.fieldErrors?.assignmentTitle}
        hint="What the students hand in, e.g. Lab Report: Number Conversion Lab"
      >
        {(aria) => (
          <Input
            id={aria.id}
            name="assignmentTitle"
            required
            placeholder="e.g. Lab Report: Number Conversion Lab"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field label="Topic" name="rubric-topic" error={state.fieldErrors?.topic}>
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

      <Field
        label="Class level"
        name="rubric-level"
        error={state.fieldErrors?.classLevel}
      >
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
          label="Criteria count"
          name="rubric-criteria"
          error={state.fieldErrors?.criteriaCount}
          hint="3 to 6 rows"
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="criteriaCount"
              type="number"
              min={3}
              max={6}
              defaultValue={4}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>

        <Field
          label="Total points"
          name="rubric-points"
          error={state.fieldErrors?.totalPoints}
          hint="Criteria points sum to this."
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="totalPoints"
              type="number"
              min={10}
              max={200}
              step={5}
              defaultValue={50}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>
      </div>

      {mockMode && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Mock mode: drafts are deterministic sample templates, clearly labeled.
          Set GEMINI_API_KEY or OPENAI_API_KEY for real generation.
        </p>
      )}

      <Button type="submit" loading={pending} className="w-fit">
        {!pending && <Sparkles className="size-4" aria-hidden="true" />}
        {pending ? "Generating draft..." : "Generate draft"}
      </Button>
    </form>
  );
}
