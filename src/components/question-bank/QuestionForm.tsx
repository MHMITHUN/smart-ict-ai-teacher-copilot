"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import {
  createQuestionAction,
  updateQuestionAction,
  type QuestionFormState,
} from "@/app/actions/questions";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Question } from "@/lib/db/types";
import type { QuestionType } from "@/lib/ai/schemas";

const TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: "mcq", label: "MCQ (4 options)" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short answer" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "viva", label: "Viva" },
];

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/**
 * Manual create/edit form for Question Bank questions (spec 20.5) with the
 * full field set. MCQ shows exactly 4 option inputs; true/false uses a
 * fixed select. Everything is zod-validated again in the server action.
 */
export function QuestionForm({ initial }: { initial?: Question }) {
  const editing = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    editing ? updateQuestionAction : createQuestionAction,
    {} as QuestionFormState,
  );
  const [type, setType] = useState<QuestionType>(initial?.type ?? "mcq");
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length === 4 ? initial.options : ["", "", "", ""],
  );

  function setOption(index: number, value: string) {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {initial && <input type="hidden" name="id" value={initial.id} />}

      {state.error && (
        <Alert tone="danger" title="Could not save">
          {state.error}
        </Alert>
      )}

      <Field
        label="Question"
        name="qf-question"
        error={state.fieldErrors?.question}
        hint="The full question text students will read."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="question"
            rows={3}
            defaultValue={initial?.question}
            required
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" name="qf-type" error={state.fieldErrors?.type}>
          {(aria) => (
            <Select
              id={aria.id}
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as QuestionType)}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Difficulty" name="qf-difficulty" error={state.fieldErrors?.difficulty}>
          {(aria) => (
            <Select id={aria.id} name="difficulty" defaultValue={initial?.difficulty ?? "easy"}>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Topic"
          name="qf-topic"
          error={state.fieldErrors?.topic}
          hint="e.g. Number Systems, Database"
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="topic"
              defaultValue={initial?.topic}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>
        <Field
          label="Learning objective"
          name="qf-objective"
          error={state.fieldErrors?.learningObjective}
          hint="What this question measures."
        >
          {(aria) => (
            <Input
              id={aria.id}
              name="learningObjective"
              defaultValue={initial?.learningObjective}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )}
        </Field>
      </div>

      {type === "mcq" && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-4">
          <legend className="px-1 text-sm font-medium text-fg">
            Options (exactly 4, one correct)
          </legend>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-5 text-xs font-semibold text-muted" aria-hidden="true">
                {String.fromCharCode(65 + index)}.
              </span>
              <Input
                name="options"
                aria-label={`Option ${String.fromCharCode(65 + index)}`}
                value={option}
                onChange={(event) => setOption(index, event.target.value)}
                required={index < 2}
              />
            </div>
          ))}
          {state.fieldErrors?.options && (
            <p role="alert" className="text-xs font-medium text-danger">
              {state.fieldErrors.options}
            </p>
          )}
        </fieldset>
      )}

      <Field
        label={type === "true_false" ? "Correct answer" : "Correct answer / model answer"}
        name="qf-answer"
        error={state.fieldErrors?.answer}
        hint={
          type === "mcq"
            ? "Must match one of the 4 options exactly."
            : type === "fill_blank"
              ? "The missing word or phrase."
              : type === "viva"
                ? "A model answer of 2-4 sentences."
                : undefined
        }
      >
        {(aria) =>
          type === "true_false" ? (
            <Select id={aria.id} name="answer" defaultValue={initial?.answer ?? "true"}>
              <option value="true">true</option>
              <option value="false">false</option>
            </Select>
          ) : type === "mcq" ? (
            <Input
              id={aria.id}
              name="answer"
              list="qf-option-list"
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          ) : (
            <Textarea
              id={aria.id}
              name="answer"
              rows={2}
              defaultValue={initial?.answer}
              required
              invalid={aria.invalid}
              aria-describedby={aria["aria-describedby"]}
              aria-invalid={aria["aria-invalid"]}
            />
          )
        }
      </Field>
      {type === "mcq" && (
        <datalist id="qf-option-list">
          {options.filter(Boolean).map((option, index) => (
            <option key={index} value={option} />
          ))}
        </datalist>
      )}

      <Field
        label="Explanation (for the teacher)"
        name="qf-explanation"
        error={state.fieldErrors?.explanation}
        hint="Why the answer is correct — shown in the answer key."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            name="explanation"
            rows={2}
            defaultValue={initial?.explanation}
            required
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Field
        label="Tags"
        name="qf-tags"
        error={state.fieldErrors?.tagsCsv}
        hint="Comma-separated, e.g. SSC, number-conversion"
      >
        {(aria) => (
          <Input
            id={aria.id}
            name="tags"
            defaultValue={initial?.tags.join(", ")}
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {!pending && <Save className="size-4" aria-hidden="true" />}
          {pending ? "Saving..." : editing ? "Save question" : "Create question"}
        </Button>
        <Link
          href="/question-bank"
          className="text-sm font-medium text-muted hover:text-fg hover:underline"
        >
          Cancel
        </Link>
      </div>

      {editing && (
        <p className="text-xs text-muted">
          Editing keeps the original author and creation date; your account is
          recorded as the last editor.
        </p>
      )}
    </form>
  );
}
