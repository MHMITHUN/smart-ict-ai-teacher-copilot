"use client";

import { useRef, useState } from "react";
import { Check, Copy, TextSelect } from "lucide-react";
import { Alert, Button } from "@/components/ui";

/**
 * Copy-to-document view (spec 20.7): the worksheet as select-all-friendly
 * plain text. One click selects the whole sheet (or copies it), and manual
 * Ctrl+A works inside the focused block too — pasting into Word or Google
 * Docs keeps one-question-per-line.
 */
export function WorksheetCopyView({
  text,
  backHref,
}: {
  text: string;
  backHref: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  function selectAll() {
    const pre = preRef.current;
    if (!pre) return;
    const range = document.createRange();
    range.selectNodeContents(pre);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    setCopied(false);
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      selectAll(); // clipboard blocked -> at least select for Ctrl+C
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={backHref}
          className="text-sm font-medium text-accent hover:underline"
        >
          &larr; Back to the worksheet
        </a>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={selectAll}>
            <TextSelect className="size-4" aria-hidden="true" />
            Select all
          </Button>
          <Button type="button" onClick={copyAll}>
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy text"}
          </Button>
        </div>
      </div>

      <Alert tone="info" title="Copy into your own document">
        This plain-text version keeps the structure (sections, numbered
        questions, answer key). Paste it into Word or Google Docs and apply your
        school&apos;s formatting.
      </Alert>

      <pre
        ref={preRef}
        tabIndex={0}
        aria-label="Worksheet as plain text"
        className="rounded-xl border border-border bg-surface p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap text-fg shadow-sm"
      >
        {text}
      </pre>
    </div>
  );
}
