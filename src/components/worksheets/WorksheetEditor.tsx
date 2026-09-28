"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  saveWorksheetEditsAction,
  type WorksheetSaveState,
} from "@/app/actions/worksheets";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import type { WorksheetSpec, WorksheetSection } from "@/lib/ai/schemas";

/**
 * Structured editor for EVERY worksheet field (spec 20.7): title, goals,
 * instructions, sections with per-question editing, the answer key and
 * teacher notes. Serialized as WorksheetSpec JSON and re-validated in the
 * server action — an invalid worksheet can never be saved. Newly added
 * rows take focus (a11y: list editors announce where you landed).
 */

let uid = 0;
function nextUid(): number {
  uid += 1;
  return uid;
}

interface SectionRow extends WorksheetSection {
  key: number;
  questionKeys: number[];
}

function toSectionRows(content: WorksheetSpec): SectionRow[] {
  return content.sections.map((section) => ({
    ...section,
    key: nextUid(),
    questionKeys: section.questions.map(() => nextUid()),
  }));
}

function blankSection(): SectionRow {
  return {
    key: nextUid(),
    heading: "New section",
    questions: [""],
    questionKeys: [nextUid()],
  };
}

export function WorksheetEditor({
  artifactId,
  initialContent,
}: {
  artifactId: string;
  initialContent: WorksheetSpec;
}) {
  const [title, setTitle] = useState(initialContent.title);
  const [learningGoalsText, setLearningGoalsText] = useState(
    initialContent.learningGoals.join("\n"),
  );
  const [instructions, setInstructions] = useState(initialContent.instructions);
  const [sections, setSections] = useState<SectionRow[]>(() =>
    toSectionRows(initialContent),
  );
  const [answerKeyText, setAnswerKeyText] = useState(
    initialContent.answerKey.join("\n"),
  );
  const [teacherNotes, setTeacherNotes] = useState(initialContent.teacherNotes);
  /** key of the row that should take focus after being added. */
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(
    saveWorksheetEditsAction,
    {} as WorksheetSaveState,
  );

  function claimFocus(key: number): {
    ref: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
    onFocus: () => void;
  } | null {
    if (focusKey !== key) return null;
    return {
      ref: (el) => {
        el?.focus();
      },
      onFocus: () => setFocusKey(null),
    };
  }

  function patchSection(index: number, patch: Partial<SectionRow>) {
    setSections((current) =>
      current.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  }

  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    value: string,
  ) {
    setSections((current) =>
      current.map((section, i) =>
        i === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((question, qi) =>
                qi === questionIndex ? value : question,
              ),
            }
          : section,
      ),
    );
  }

  function addQuestion(sectionIndex: number) {
    const key = nextUid();
    setSections((current) =>
      current.map((section, i) =>
        i === sectionIndex
          ? {
              ...section,
              questions: [...section.questions, ""],
              questionKeys: [...section.questionKeys, key],
            }
          : section,
      ),
    );
    setFocusKey(key);
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    setSections((current) =>
      current.map((section, i) => {
        if (i !== sectionIndex) return section;
        if (section.questions.length <= 1) return section;
        return {
          ...section,
          questions: section.questions.filter((_, qi) => qi !== questionIndex),
          questionKeys: section.questionKeys.filter(
            (_, qi) => qi !== questionIndex,
          ),
        };
      }),
    );
  }

  function addSection() {
    const section = blankSection();
    setSections((current) => [...current, section]);
    setFocusKey(section.key);
  }

  function removeSection(sectionIndex: number) {
    setSections((current) =>
      current.length <= 1
        ? current
        : current.filter((_, i) => i !== sectionIndex),
    );
  }

  function buildPayload(): WorksheetSpec {
    const goals = learningGoalsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return {
      title,
      learningGoals:
        goals.length > 0 ? goals : ["(learning goal placeholder — edit me)"],
      instructions,
      sections: sections.map((section) => ({
        heading: section.heading,
        questions: section.questions.map((question) => question),
      })),
      answerKey: answerKeyText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      teacherNotes,
    };
  }

  const questionCount = sections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );
  const answerCount = buildPayload().answerKey.length;

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

      <Field label="Worksheet title" name="ws-title-edit">
        {(aria) => (
          <Input
            id={aria.id}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        )}
      </Field>

      <Field
        label="Learning goals"
        name="ws-goals-edit"
        hint="One goal per line."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={3}
            value={learningGoalsText}
            onChange={(event) => setLearningGoalsText(event.target.value)}
          />
        )}
      </Field>

      <Field label="Instructions" name="ws-instructions-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={2}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            required
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-fg">
          Sections ({sections.length}) — {questionCount} question
          {questionCount === 1 ? "" : "s"} in total
        </legend>
        {sections.map((section, sectionIndex) => (
          <div
            key={section.key}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                Section {sectionIndex + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted hover:text-danger"
                disabled={sections.length <= 1}
                aria-label={`Remove section ${sectionIndex + 1}`}
                onClick={() => removeSection(sectionIndex)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove section
              </Button>
            </div>

            <Field label="Section heading" name={`ws-${section.key}-heading`}>
              {(aria) => {
                const focus = claimFocus(section.key);
                return (
                  <Input
                    id={aria.id}
                    value={section.heading}
                    ref={
                      focus
                        ? (focus.ref as (el: HTMLInputElement | null) => void)
                        : undefined
                    }
                    onFocus={focus?.onFocus}
                    onChange={(event) =>
                      patchSection(sectionIndex, {
                        heading: event.target.value,
                      })
                    }
                    required
                  />
                );
              }}
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-fg">Questions</legend>
              {section.questions.map((question, questionIndex) => {
                const key = section.questionKeys[questionIndex];
                const focus = claimFocus(key);
                return (
                  <div key={key} className="flex items-start gap-2">
                    <span
                      className="pt-2.5 text-xs font-semibold text-muted"
                      aria-hidden="true"
                    >
                      {questionIndex + 1}.
                    </span>
                    <div className="flex-1">
                      <Textarea
                        aria-label={`Section ${sectionIndex + 1} question ${questionIndex + 1}`}
                        rows={2}
                        value={question}
                        ref={focus ? focus.ref : undefined}
                        onFocus={focus?.onFocus}
                        onChange={(event) =>
                          updateQuestion(
                            sectionIndex,
                            questionIndex,
                            event.target.value,
                          )
                        }
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted hover:text-danger"
                      disabled={section.questions.length <= 1}
                      aria-label={`Remove section ${sectionIndex + 1} question ${questionIndex + 1}`}
                      onClick={() =>
                        removeQuestion(sectionIndex, questionIndex)
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => addQuestion(sectionIndex)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add question
              </Button>
            </fieldset>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={addSection}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add section
        </Button>
      </fieldset>

      <Field
        label={`Answer key (${answerCount} entr${answerCount === 1 ? "y" : "ies"})`}
        name="ws-answerkey-edit"
        hint="One answer per line, in question order."
      >
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={Math.min(10, Math.max(3, answerCount + 1))}
            value={answerKeyText}
            onChange={(event) => setAnswerKeyText(event.target.value)}
            required
          />
        )}
      </Field>

      <Field label="Teacher notes" name="ws-notes-edit">
        {(aria) => (
          <Textarea
            id={aria.id}
            rows={3}
            value={teacherNotes}
            onChange={(event) => setTeacherNotes(event.target.value)}
            required
          />
        )}
      </Field>

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
