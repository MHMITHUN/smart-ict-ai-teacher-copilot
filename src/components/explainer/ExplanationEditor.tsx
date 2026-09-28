"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Plus, Save } from "lucide-react";
import {
  saveExplanationEditsAction,
  type ExplanationSaveState,
} from "@/app/actions/explanations";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import type { Explanation } from "@/lib/ai/schemas";

/**
 * Editor for every explanation field (spec 20.6). The uncertaintyNote —
 * when present — is rendered PROMINENTLY at the top (honesty first), and
 * can be edited or cleared: an emptied note is dropped, a filled one stays
 * visible until a teacher resolves it. No references field exists by
 * design; the prompt forbids fabricating them.
 */

export function ExplanationEditor({
  artifactId,
  initialContent,
}: {
  artifactId: string;
  initialContent: Explanation;
}) {
  const [content, setContent] = useState<Explanation>(initialContent);
  const [stepsText, setStepsText] = useState(
    initialContent.stepByStep.join("\n"),
  );
  const [uncertaintyText, setUncertaintyText] = useState(
    initialContent.uncertaintyNote ?? "",
  );
  const [focusStep, setFocusStep] = useState(false);
  const [state, formAction, pending] = useActionState(
    saveExplanationEditsAction,
    {} as ExplanationSaveState,
  );

  function buildPayload(): Explanation {
    const stepByStep = stepsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const payload: Explanation = {
      ...content,
      stepByStep:
        stepByStep.length > 0 ? stepByStep : ["(step placeholder — edit me)"],
    };
    const note = uncertaintyText.trim();
    if (note) payload.uncertaintyNote = note;
    else delete payload.uncertaintyNote;
    return payload;
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={artifactId} />
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify(buildPayload())}
      />

      {state.error && (
        <Alert tone="danger" title="Could not save">
          {state.error}
        </Alert>
      )}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      {/* Uncertainty first — honesty is the headline, not the footnote. */}
      <Field
        label="Uncertainty note"
        name="expl-uncertainty-edit"
        hint={
          content.uncertaintyNote
            ? "The model flagged uncertainty here. Verify before classroom use — or clear the note once resolved."
            : "Empty — the model reported no uncertainty. Add one if you spot something to verify."
        }
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={2}
            value={uncertaintyText}
            onChange={(event) => setUncertaintyText(event.target.value)}
            className="border-warning/40 bg-warning/5"
          />
        )}
      </Field>
      {uncertaintyText.trim() && (
        <Alert tone="warning" title="Verify before classroom use">
          <span className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            {uncertaintyText.trim()}
          </span>
        </Alert>
      )}

      <Field label="Simple explanation" name="expl-simple-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={4}
            value={content.simpleExplanation}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                simpleExplanation: event.target.value,
              }))
            }
            required
          />
        )}
      </Field>

      <Field label="Analogy" name="expl-analogy-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={2}
            value={content.analogy}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                analogy: event.target.value,
              }))
            }
            required
          />
        )}
      </Field>

      <Field
        label="Step-by-step breakdown"
        name="expl-steps-edit"
        hint="One step per line."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={Math.min(10, Math.max(3, content.stepByStep.length + 1))}
            value={stepsText}
            ref={
              focusStep
                ? (el) => {
                    el?.focus();
                  }
                : undefined
            }
            onFocus={() => setFocusStep(false)}
            onChange={(event) => setStepsText(event.target.value)}
          />
        )}
      </Field>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          setStepsText(
            (current) =>
              `${current}${current.endsWith("\n") || current === "" ? "" : "\n"}`,
          );
          setFocusStep(true);
        }}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add step
      </Button>

      <Field label="Common mistake" name="expl-mistake-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={2}
            value={content.commonMistake}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                commonMistake: event.target.value,
              }))
            }
            required
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-4">
        <legend className="px-1 text-sm font-medium text-fg">
          Practice question
        </legend>
        <Field label="Question" name="expl-practice-q">
          {(aria) => (
            <Textarea
              id={aria.id}
              rows={2}
              value={content.practiceQuestion.question}
              onChange={(event) =>
                setContent((current) => ({
                  ...current,
                  practiceQuestion: {
                    ...current.practiceQuestion,
                    question: event.target.value,
                  },
                }))
              }
              required
            />
          )}
        </Field>
        <Field label="Answer" name="expl-practice-a">
          {(aria) => (
            <Input
              id={aria.id}
              value={content.practiceQuestion.answer}
              onChange={(event) =>
                setContent((current) => ({
                  ...current,
                  practiceQuestion: {
                    ...current.practiceQuestion,
                    answer: event.target.value,
                  },
                }))
              }
              required
            />
          )}
        </Field>
      </fieldset>

      <Button
        type="submit"
        loading={pending}
        variant="secondary"
        className="w-fit"
      >
        {!pending && <Save className="size-4" aria-hidden="true" />}
        {pending ? "Saving..." : "Save edits"}
      </Button>
    </form>
  );
}
