"use client";

import { useState } from "react";
import { KeyRound, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import type { QuizSpec } from "@/lib/ai/schemas";

/**
 * Printable paper view of a quiz (spec 20.4): clean black-on-white layout,
 * answer-key toggle and a Print button. The toolbar never prints; the answer
 * key prints only when the teacher has it visible.
 */
export function PrintableQuiz({
  title,
  meta,
  content,
  backHref,
}: {
  title: string;
  meta: string;
  content: QuizSpec;
  backHref: string;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex flex-col gap-6 print:gap-0">
      {/* Toolbar (screen only) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href={backHref} className="text-sm font-medium text-accent hover:underline">
          &larr; Back to the quiz
        </a>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowKey((v) => !v)}>
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
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-fg/70">{meta}</p>
          <p className="mt-3 text-sm leading-relaxed">{content.instructions}</p>
          <p className="mt-4 text-sm">
            Name: <span className="inline-block w-56 border-b border-fg/40" /> Roll:{" "}
            <span className="inline-block w-20 border-b border-fg/40" />
          </p>
        </header>

        <ol className="flex list-decimal flex-col gap-6 pl-6">
          {content.questions.map((question, index) => (
            <li key={index}>
              <p className="font-medium leading-relaxed">{question.prompt}</p>
              {question.type === "mcq" && question.options && (
                <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 pl-4">
                  {question.options.map((option, optionIndex) => (
                    <li key={optionIndex} className="text-sm">
                      <span className="font-semibold" aria-hidden="true">
                        {String.fromCharCode(65 + optionIndex)}){" "}
                      </span>
                      {option}
                    </li>
                  ))}
                </ul>
              )}
              {question.type !== "mcq" && question.type !== "true_false" && (
                <div className="mt-3 flex flex-col gap-4" aria-hidden="true">
                  <div className="border-b border-fg/25" />
                  <div className="border-b border-fg/25" />
                </div>
              )}
            </li>
          ))}
        </ol>

        <p className="mt-8 text-right text-sm text-fg/70">Good luck!</p>

        {showKey && (
          <section className="mt-10 break-before-page border-t-2 border-dashed border-fg/30 pt-5">
            <h2 className="text-lg font-bold">Answer key (teacher copy)</h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
              {content.questions.map((question, index) => (
                <li key={index}>
                  <span className="font-semibold">{question.answer}</span>
                  {question.type === "true_false" ? "" : ` — ${question.explanation}`}
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}
