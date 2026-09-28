"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { saveLessonEditsAction, type LessonSaveState } from "@/app/actions/lessons";
import { Alert, Button, Field, Input, Label, Textarea } from "@/components/ui";
import type { LessonPlan } from "@/lib/ai/schemas";

/**
 * Structured editor for EVERY LessonPlan field (spec 20.3): the teacher can
 * rewrite anything before approving. The whole spec is serialized as JSON in
 * a hidden input and re-validated with LessonPlanSchema in the server action.
 */
export function LessonEditor({
  artifactId,
  initialContent,
}: {
  artifactId: string;
  initialContent: LessonPlan;
}) {
  const [content, setContent] = useState<LessonPlan>(initialContent);
  const [state, formAction, pending] = useActionState(
    saveLessonEditsAction,
    {} as LessonSaveState,
  );

  function patch(patchFields: Partial<LessonPlan>) {
    setContent((current) => ({ ...current, ...patchFields }));
  }

  function setObjective(index: number, value: string) {
    setContent((current) => {
      const objectives = [...current.learningObjectives];
      objectives[index] = value;
      return { ...current, learningObjectives: objectives };
    });
  }

  function removeObjective(index: number) {
    setContent((current) => ({
      ...current,
      learningObjectives:
        current.learningObjectives.length > 1
          ? current.learningObjectives.filter((_, i) => i !== index)
          : current.learningObjectives,
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={artifactId} />
      <input type="hidden" name="payload" value={JSON.stringify(content)} />

      {state.error && <Alert tone="danger" title="Could not save">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <Field label="Lesson title" name="lesson-title-edit">
        {(aria) => (
          <Input
            id={aria.id}
            value={content.title}
            onChange={(event) => patch({ title: event.target.value })}
            required
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-fg">Learning objectives</legend>
        <p className="text-xs text-muted">
          One measurable objective per row. Objectives drive the assessment.
        </p>
        {content.learningObjectives.map((objective, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2.5 text-xs font-medium text-muted" aria-hidden="true">
              {index + 1}.
            </span>
            <Input
              aria-label={`Objective ${index + 1}`}
              value={objective}
              onChange={(event) => setObjective(index, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 shrink-0 text-muted hover:text-danger"
              aria-label={`Remove objective ${index + 1}`}
              disabled={content.learningObjectives.length <= 1}
              onClick={() => removeObjective(index)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setContent((current) => ({
              ...current,
              learningObjectives: [...current.learningObjectives, ""],
            }))
          }
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add objective
        </Button>
      </fieldset>

      <Field label="Warm-up (3-5 minutes)" name="lesson-warmup-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={3}
            value={content.warmUp}
            onChange={(event) => patch({ warmUp: event.target.value })}
            required
          />
        )}
      </Field>

      <Field
        label="Concept explanation"
        name="lesson-concept-edit"
        hint="The core teaching input — classroom language, with a worked example."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={8}
            value={content.conceptExplanation}
            onChange={(event) => patch({ conceptExplanation: event.target.value })}
            required
          />
        )}
      </Field>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Classroom activity" name="lesson-activity-edit">
          {(aria) => (
            <Textarea
              id={aria.id}
              rows={4}
              value={content.activity}
              onChange={(event) => patch({ activity: event.target.value })}
              required
            />
          )}
        </Field>
        <Field label="Practice" name="lesson-practice-edit">
          {(aria) => (
            <Textarea
              id={aria.id}
              rows={4}
              value={content.practice}
              onChange={(event) => patch({ practice: event.target.value })}
              required
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Assessment" name="lesson-assessment-edit">
          {(aria) => (
            <Textarea
              id={aria.id}
              rows={3}
              value={content.assessment}
              onChange={(event) => patch({ assessment: event.target.value })}
              required
            />
          )}
        </Field>
        <Field label="Homework" name="lesson-homework-edit">
          {(aria) => (
            <Textarea
              id={aria.id}
              rows={3}
              value={content.homework}
              onChange={(event) => patch({ homework: event.target.value })}
              required
            />
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2/50 p-4">
        <legend className="px-1 text-sm font-medium text-fg">Differentiation</legend>
        {(
          [
            ["support", "Support (struggling students)"],
            ["core", "Core (standard path)"],
            ["stretch", "Stretch (advanced students)"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <Textarea
              aria-label={label}
              rows={2}
              value={content.differentiation[key]}
              onChange={(event) =>
                patch({
                  differentiation: {
                    ...content.differentiation,
                    [key]: event.target.value,
                  },
                })
              }
              required
            />
          </div>
        ))}
      </fieldset>

      <Button type="submit" loading={pending} variant="secondary" className="w-fit">
        {!pending && <Save className="size-4" aria-hidden="true" />}
        {pending ? "Saving..." : "Save edits"}
      </Button>
    </form>
  );
}
