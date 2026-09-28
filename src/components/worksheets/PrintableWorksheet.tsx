"use client";

import { useState } from "react";
import { KeyRound, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import type { PrintableWorksheetModel } from "@/lib/artifacts/worksheet-text";

/**
 * Printable paper view of a worksheet (spec 20.7): clean black-on-white
 * layout, a Name/Class/Date line in the header, numbered questions with
 * answer space, and the answer key on its own page section (teacher copy)
 * — it only prints when the teacher has it visible.
 */
export function PrintableWorksheet({
  model,
  backHref,
}: {
  model: PrintableWorksheetModel;
  backHref: string;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex flex-col gap-6 print:gap-0">
      {/* Toolbar (screen only) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a
          href={backHref}
          className="text-sm font-medium text-accent hover:underline"
        >
          &larr; Back to the worksheet
        </a>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowKey((v) => !v)}
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {showKey ? "Hide answer key" : "Show answer key"}
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      {/* Paper */}
      <article className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-white p-8 text-fg shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 border-b border-fg/20 pb-4">
          <h1 className="text-2xl font-bold">{model.title}</h1>
          <p className="mt-1 text-sm text-fg/70">
            {model.classLevel} · {model.topic}
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-fg/80">
            <p>
              Name:{" "}
              <span className="mr-4 inline-block w-56 border-b border-fg/40" />
              Roll: <span className="inline-block w-20 border-b border-fg/40" />
            </p>
            <p>
              Class:{" "}
              <span className="mr-4 inline-block w-40 border-b border-fg/40" />
              Date: <span className="inline-block w-32 border-b border-fg/40" />
            </p>
          </div>
          {model.learningGoals.length > 0 && (
            <ul className="mt-4 list-disc pl-5 text-xs leading-relaxed text-fg/60">
              {model.learningGoals.map((goal, index) => (
                <li key={index}>{goal}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm leading-relaxed">{model.instructions}</p>
        </header>

        {model.sections.map((section) => (
          <section key={section.heading} className="mb-6">
            <h2 className="mb-3 text-base font-semibold">{section.heading}</h2>
            <ol className="flex flex-col gap-5">
              {section.questions.map((question) => (
                <li key={question.number} className="list-decimal pl-5">
                  <p className="leading-relaxed font-medium">
                    {question.question}
                  </p>
                  <div className="mt-3 flex flex-col gap-4" aria-hidden="true">
                    <div className="border-b border-fg/25" />
                    <div className="border-b border-fg/25" />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {showKey && (
          <section className="mt-10 break-before-page border-t-2 border-dashed border-fg/30 pt-5">
            <h2 className="text-lg font-bold">
              Answer key and marking notes (teacher copy)
            </h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
              {model.answerKey.map((answer, index) => (
                <li key={index}>{answer}</li>
              ))}
            </ol>
            <p className="mt-4 text-sm leading-relaxed text-fg/80">
              <span className="font-semibold">Teacher notes: </span>
              {model.teacherNotes}
            </p>
          </section>
        )}
      </article>
    </div>
  );
}
