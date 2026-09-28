"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { saveQuizEditsAction, type QuizSaveState } from "@/app/actions/quizzes";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { QuizSpec, QuizQuestion, QuestionType, Difficulty } from "@/lib/ai/schemas";

const TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: "mcq", label: "MCQ (4 options)" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short answer" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "viva", label: "Viva" },
];

const DIFFICULTY_OPTIONS: Difficulty[] = ["easy", "medium", "hard"];

function blankQuestion(): QuizQuestion {
  return {
    prompt: "",
    type: "short_answer",
    answer: "",
    explanation: "",
    difficulty: "medium",
  };
}

/**
 * Structured editor for EVERY quiz field (spec 20.4): title, instructions
 * and a full per-question editor (prompt, type, options, answer,
 * explanation, difficulty, remove). Serialized as QuizSpec JSON and
 * re-validated in the server action — an invalid question can never be saved.
 */
export function QuizEditor({
  artifactId,
  initialContent,
}: {
  artifactId: string;
  initialContent: QuizSpec;
}) {
  const [content, setContent] = useState<QuizSpec>(initialContent);
  const [state, formAction, pending] = useActionState(
    saveQuizEditsAction,
    {} as QuizSaveState,
  );

  function patch(patchFields: Partial<QuizSpec>) {
    setContent((current) => ({ ...current, ...patchFields }));
  }

  function updateQuestion(index: number, patchQuestion: Partial<QuizQuestion>) {
    setContent((current) => ({
      ...current,
      questions: current.questions.map((question, i) =>
        i === index ? { ...question, ...patchQuestion } : question,
      ),
    }));
  }

  function changeQuestionType(index: number, type: QuestionType) {
    setContent((current) => ({
      ...current,
      questions: current.questions.map((question, i) => {
        if (i !== index) return question;
        const next: QuizQuestion = { ...question, type };
        if (type === "mcq") {
          next.options =
            question.options && question.options.length === 4
              ? question.options
              : ["", "", "", ""];
        } else {
          delete next.options;
        }
        if (type === "true_false" && !["true", "false"].includes(question.answer.toLowerCase())) {
          next.answer = "true";
        }
        return next;
      }),
    }));
  }

  function removeQuestion(index: number) {
    setContent((current) =>
      current.questions.length <= 1
        ? current
        : { ...current, questions: current.questions.filter((_, i) => i !== index) },
    );
  }

  function setOption(index: number, optionIndex: number, value: string) {
    setContent((current) => ({
      ...current,
      questions: current.questions.map((question, i) =>
        i === index && question.options
          ? {
              ...question,
              options: question.options.map((option, oi) =>
                oi === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={artifactId} />
      <input type="hidden" name="payload" value={JSON.stringify(content)} />

      {state.error && <Alert tone="danger" title="Could not save">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <Field label="Quiz title" name="quiz-title-edit">
        {(aria) => (
          <Input
            id={aria.id}
            value={content.title}
            onChange={(event) => patch({ title: event.target.value })}
            required
          />
        )}
      </Field>

      <Field label="Student instructions" name="quiz-instructions-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={2}
            value={content.instructions}
            onChange={(event) => patch({ instructions: event.target.value })}
            required
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-fg">
          Questions ({content.questions.length})
        </legend>
        {content.questions.map((question, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Question {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted hover:text-danger"
                disabled={content.questions.length <= 1}
                aria-label={`Remove question ${index + 1}`}
                onClick={() => removeQuestion(index)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </Button>
            </div>

            <Field label="Question prompt" name={`q-${index}-prompt`}>
              {(aria) => (
                <Textarea
                  id={aria.id}
                  rows={2}
                  value={question.prompt}
                  onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                  required
                />
              )}
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" name={`q-${index}-type`}>
                {(aria) => (
                  <Select
                    id={aria.id}
                    value={question.type}
                    onChange={(event) =>
                      changeQuestionType(index, event.target.value as QuestionType)
                    }
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Difficulty" name={`q-${index}-difficulty`}>
                {(aria) => (
                  <Select
                    id={aria.id}
                    value={question.difficulty}
                    onChange={(event) =>
                      updateQuestion(index, { difficulty: event.target.value as Difficulty })
                    }
                  >
                    {DIFFICULTY_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            {question.type === "mcq" && question.options && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium text-fg">Options (exactly 4)</legend>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-semibold text-muted" aria-hidden="true">
                      {String.fromCharCode(65 + optionIndex)}.
                    </span>
                    <Input
                      aria-label={`Question ${index + 1} option ${String.fromCharCode(65 + optionIndex)}`}
                      value={option}
                      onChange={(event) => setOption(index, optionIndex, event.target.value)}
                    />
                  </div>
                ))}
                <Field
                  label="Correct answer"
                  name={`q-${index}-answer`}
                  hint="Pick the option that is correct."
                >
                  {(aria) => {
                    const options = question.options ?? [];
                    return (
                      <Select
                        id={aria.id}
                        value={options.includes(question.answer) ? question.answer : ""}
                        onChange={(event) => updateQuestion(index, { answer: event.target.value })}
                      >
                        <option value="" disabled>
                          Select the correct option...
                        </option>
                        {options.map((option, optionIndex) => (
                          <option key={optionIndex} value={option}>
                            {String.fromCharCode(65 + optionIndex)}. {option || "(empty)"}
                          </option>
                        ))}
                      </Select>
                    );
                  }}
                </Field>
              </fieldset>
            )}

            {question.type === "true_false" && (
              <Field label="Correct answer" name={`q-${index}-tf`}>
                {(aria) => (
                  <Select
                    id={aria.id}
                    value={question.answer.toLowerCase() === "false" ? "false" : "true"}
                    onChange={(event) => updateQuestion(index, { answer: event.target.value })}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Select>
                )}
              </Field>
            )}

            {question.type !== "mcq" && question.type !== "true_false" && (
              <Field
                label="Model answer"
                name={`q-${index}-answer`}
                hint={
                  question.type === "fill_blank"
                    ? "The missing word or phrase."
                    : question.type === "viva"
                      ? "A model answer of 2-4 sentences."
                      : "The expected answer."
                }
              >
                {(aria) => (
                  <Textarea
                    id={aria.id}
                    rows={2}
                    value={question.answer}
                    onChange={(event) => updateQuestion(index, { answer: event.target.value })}
                    required
                  />
                )}
              </Field>
            )}

            <Field label="Explanation (for the teacher)" name={`q-${index}-explanation`}>
              {(aria) => (
                <Textarea
                  id={aria.id}
                  rows={2}
                  value={question.explanation}
                  onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
                  required
                />
              )}
            </Field>
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
              questions: [...current.questions, blankQuestion()],
            }))
          }
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add question
        </Button>
      </fieldset>

      <Button type="submit" loading={pending} variant="secondary" className="w-fit">
        {!pending && <Save className="size-4" aria-hidden="true" />}
        {pending ? "Saving..." : "Save edits"}
      </Button>
    </form>
  );
}
