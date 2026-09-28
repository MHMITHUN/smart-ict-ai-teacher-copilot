import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Honest placeholder for the generator/analytics sections: chunks B/C
 * replace these pages feature by feature. The shell (auth, store, AI
 * provider layer, review workflow) is already real — this page is not a
 * faked feature.
 */
export function SectionPlaceholder({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
      <EmptyState
        icon={icon}
        title="This module is being built"
        description={description}
        action={
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>
        }
      />
      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted">
        <Hammer className="size-3.5" aria-hidden="true" />
        The AI provider layer, database stores and teacher review workflow
        are already in place — this screen ships in the next build milestone.
      </p>
    </div>
  );
}
