"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Root error boundary with a retry button. `reset` re-renders the failed
 * segment; the reset() call is what makes this recoverable.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-warning/10">
        <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-semibold text-fg">Something went wrong</h1>
      <p className="text-sm text-muted">
        This page could not be rendered. Your saved drafts and approved
        materials are safe — the error is in drawing the page.
      </p>
      {error.digest && (
        <p className="text-xs text-muted">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
