"use client";

import { useActionState } from "react";
import { Sparkles, Info } from "lucide-react";
import {
  generateWorksheetAction,
  type WorksheetFormState,
} from "@/app/actions/worksheets";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  CLASS_LEVELS,
  WORKSHEET_DIFFICULTY_MIXES,
} from "@/lib/validation/artifacts";

/** Two-pane Worksheet Generator: the generation form (left pane). */
export function WorksheetGeneratorForm({ mockMode }: { mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    generateWorksheetAction,
    {} as WorksheetFormState,
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
        name="ws-topic"
        error={state.fieldErrors?.topic}
        hint="e.g. Number Systems, Logic Gates, SQL basics"
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

      <Field
        label="Class level"
        name="ws-level"
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
          label="Sections wanted"
          name="ws-sections"
          error={state.fieldErrors?.sectionCount}
          hint="1 to 5 (recall / practice / challenge)"
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="sectionCount"
              type="number"
              min={1}
              max={5}
              defaultValue={3}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>

        <Field
          label="Difficulty mix"
          name="ws-difficulty"
          error={state.fieldErrors?.difficultyMix}
        >
          {(aria) => (
            <Select id={aria.id} name="difficultyMix" defaultValue="balanced">
              {WORKSHEET_DIFFICULTY_MIXES.map((mix) => (
                <option key={mix} value={mix}>
                  {mix}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field
        label="Learning goals"
        name="ws-goals"
        error={state.fieldErrors?.learningGoalsText}
        hint="Optional — one goal per line; the draft echoes them."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="learningGoals"
            rows={3}
            placeholder={
              "e.g. Convert decimal to binary\nVerify answers with place values"
            }
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
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
        {pending ? "Generating draft..." : "Generate draft"}
      </Button>
    </form>
  );
}
