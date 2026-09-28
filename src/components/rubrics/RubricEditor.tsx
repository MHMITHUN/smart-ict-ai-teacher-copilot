"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  saveRubricEditsAction,
  type RubricSaveState,
} from "@/app/actions/rubrics";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import type { RubricSpec, RubricCriterion } from "@/lib/ai/schemas";

/**
 * Editable rubric table (spec 20.8): one row per criterion with the four
 * performance-level descriptions (Excellent / Good / Developing /
 * Beginning) and points. The total is ALWAYS the live sum of the points
 * column (auto total) — the server recomputes it again on save, so a
 * stored rubric can never disagree with its own criteria.
 */

let uid = 0;
function nextUid(): number {
  uid += 1;
  return uid;
}

interface CriterionRow extends RubricCriterion {
  key: number;
}

function blankCriterion(): CriterionRow {
  return {
    key: nextUid(),
    criterion: "",
    excellent: "",
    good: "",
    developing: "",
    beginning: "",
    points: 10,
  };
}

const LEVELS = [
  { field: "excellent" as const, label: "Excellent" },
  { field: "good" as const, label: "Good" },
  { field: "developing" as const, label: "Developing" },
  { field: "beginning" as const, label: "Beginning" },
];

export function RubricEditor({
  artifactId,
  initialContent,
}: {
  artifactId: string;
  initialContent: RubricSpec;
}) {
  const [title, setTitle] = useState(initialContent.title);
  const [criteria, setCriteria] = useState<CriterionRow[]>(() =>
    initialContent.criteria.map((criterion) => ({
      ...criterion,
      key: nextUid(),
    })),
  );
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(
    saveRubricEditsAction,
    {} as RubricSaveState,
  );

  const autoTotal = criteria.reduce(
    (sum, criterion) => sum + criterion.points,
    0,
  );

  function updateCriterion(index: number, patch: Partial<RubricCriterion>) {
    setCriteria((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  /** Update one performance-level cell (excellent/good/developing/beginning). */
  function setLevel(
    index: number,
    field: (typeof LEVELS)[number]["field"],
    value: string,
  ) {
    setCriteria((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addCriterion() {
    const row = blankCriterion();
    setCriteria((current) => [...current, row]);
    setFocusKey(row.key);
  }

  function removeCriterion(index: number) {
    setCriteria((current) =>
      current.length <= 1 ? current : current.filter((_, i) => i !== index),
    );
  }

  function buildPayload(): RubricSpec {
    const rows = criteria.map(({ key, ...criterion }) => {
      void key; // key is bookkeeping for React lists only
      return criterion;
    });
    return { title, criteria: rows, totalPoints: autoTotal };
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

      <Field label="Rubric title" name="rubric-title-edit">
        {(aria) => (
          <Input
            id={aria.id}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-fg">
          Criteria ({criteria.length}) — points are yours to edit; the total
          updates automatically.
        </legend>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th
                  scope="col"
                  className="w-[15%] pr-3 pb-2 font-semibold text-fg"
                >
                  Criterion
                </th>
                {LEVELS.map((level) => (
                  <th
                    key={level.field}
                    scope="col"
                    className="w-[17%] pr-3 pb-2 font-semibold text-fg"
                  >
                    {level.label}
                  </th>
                ))}
                <th scope="col" className="w-[9%] pb-2 font-semibold text-fg">
                  Points
                </th>
                <th scope="col" className="w-10 pb-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((row, index) => (
                <tr
                  key={row.key}
                  className="border-b border-border/60 align-top"
                  aria-label={`Criterion ${index + 1}`}
                >
                  <td className="py-3 pr-3">
                    <Textarea
                      aria-label={`Criterion ${index + 1} name`}
                      rows={3}
                      value={row.criterion}
                      ref={
                        focusKey === row.key
                          ? (el) => {
                              el?.focus();
                            }
                          : undefined
                      }
                      onFocus={() => setFocusKey(null)}
                      onChange={(event) =>
                        updateCriterion(index, {
                          criterion: event.target.value,
                        })
                      }
                      required
                    />
                  </td>
                  {LEVELS.map((level) => (
                    <td key={level.field} className="py-3 pr-3">
                      <Textarea
                        aria-label={`Criterion ${index + 1} ${level.label} description`}
                        rows={3}
                        value={row[level.field]}
                        onChange={(event) =>
                          setLevel(index, level.field, event.target.value)
                        }
                        required
                      />
                    </td>
                  ))}
                  <td className="py-3 pr-3">
                    <Input
                      aria-label={`Criterion ${index + 1} points`}
                      type="number"
                      min={1}
                      max={200}
                      value={row.points}
                      onChange={(event) =>
                        updateCriterion(index, {
                          points: Math.max(
                            1,
                            Math.round(Number(event.target.value) || 1),
                          ),
                        })
                      }
                      required
                    />
                  </td>
                  <td className="py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted hover:text-danger"
                      disabled={criteria.length <= 1}
                      aria-label={`Remove criterion ${index + 1}`}
                      onClick={() => removeCriterion(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={5}
                  className="pt-3 text-right font-semibold text-fg"
                >
                  Auto total
                </td>
                <td className="pt-3">
                  <output
                    aria-live="polite"
                    className="block rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-center font-semibold text-accent"
                  >
                    {autoTotal}
                  </output>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={addCriterion}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add criterion
        </Button>
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
