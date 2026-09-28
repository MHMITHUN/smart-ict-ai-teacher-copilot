"use client";

import { useActionState } from "react";
import { Sparkles, Info } from "lucide-react";
import {
  generateExplanationAction,
  type ExplainerFormState,
} from "@/app/actions/explanations";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { EXPLAINER_AUDIENCES } from "@/lib/validation/artifacts";

/**
 * AI Explainer form (spec 20.6). Teacher mode is the default audience:
 * the draft is for YOUR review first; approving it is the teacher-reviewed
 * state. No references are requested or rendered — the prompt forbids
 * them outright.
 */
export function ExplainerForm({ mockMode }: { mockMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    generateExplanationAction,
    {} as ExplainerFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert tone="danger" title="Generation failed">
          {state.error}
        </Alert>
      )}

      <Field
        label="The student's question"
        name="expl-question"
        error={state.fieldErrors?.question}
        hint="Paste it exactly as they asked it."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="question"
            rows={3}
            required
            placeholder="e.g. Why is 13 written as 1101 in binary?"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field
        label="What confused them"
        name="expl-confusion"
        error={state.fieldErrors?.confusion}
        hint="Optional — the exact misunderstanding, if you caught it."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="confusion"
            rows={2}
            placeholder="e.g. They added the digits 1+1+0+1 and got 3"
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic" name="expl-topic" error={state.fieldErrors?.topic}>
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
          label="Audience"
          name="expl-audience"
          error={state.fieldErrors?.audience}
          hint="Teacher mode drafts for you to review first."
        >
          {(aria) => (
            <Select id={aria.id} name="audience" defaultValue="teacher">
              {EXPLAINER_AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {audience === "teacher"
                    ? "teacher (review first)"
                    : "student (simpler wording)"}
                </option>
              ))}
            </Select>
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
