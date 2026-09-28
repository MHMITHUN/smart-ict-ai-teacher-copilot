import type { Metadata } from "next";
import { FolderOpen, Search } from "lucide-react";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { AIBadge } from "@/components/artifacts/AIBadge";
import {
  buildLibraryEntries,
  countLibraryEntriesByType,
  filterLibraryEntries,
  LIBRARY_TYPE_LABELS,
  LIBRARY_TYPE_PLURAL_LABELS,
  LIBRARY_TYPES,
  type LibraryArtifactType,
} from "@/lib/library/entries";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Table,
  TableBody,
  TD,
  TH,
  TableHead,
  TableRow,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Content Library",
};

export const dynamic = "force-dynamic";

/**
 * Content Library (spec 20.2): a unified, read-only listing of every
 * APPROVED artifact — the "safe to reuse" surface. Drafts stay in their
 * generators until a teacher reviews them (spec 20.10), so they never
 * appear here. Filter by type, search across title/topic.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  await requireRole(["TEACHER", "ADMIN"]);
  const { type, q } = await searchParams;
  const store = await getStore();

  const activeType = LIBRARY_TYPES.includes(type as LibraryArtifactType)
    ? (type as LibraryArtifactType)
    : undefined;

  const entries = buildLibraryEntries({
    lessons: await store.listLessonPlans(),
    quizzes: await store.listQuizzes(),
    worksheets: await store.listWorksheets(),
    rubrics: await store.listRubrics(),
    explanations: await store.listExplanations(),
  });
  const counts = countLibraryEntriesByType(entries);
  const filtered = filterLibraryEntries(entries, {
    type: activeType,
    search: q,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Content Library
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Everything you have approved, in one read-only place —{" "}
          {entries.length} artifact{entries.length === 1 ? "" : "s"} across
          lessons, quizzes, worksheets, rubrics and explanations. Drafts wait in
          their generators until you review them; only teacher-approved work is
          reusable here.
        </p>
      </div>

      {/* Type filter chips (link-driven) + search (GET form, plain markup). */}
      <div className="flex flex-col gap-3">
        <nav
          aria-label="Filter by artifact type"
          className="flex flex-wrap gap-2"
        >
          <TypeChip
            href={chipHref(undefined, q)}
            active={!activeType}
            label={`All (${counts.all})`}
          />
          {LIBRARY_TYPES.map((libraryType) => (
            <TypeChip
              key={libraryType}
              href={chipHref(libraryType, q)}
              active={activeType === libraryType}
              label={`${LIBRARY_TYPE_PLURAL_LABELS[libraryType]} (${counts[libraryType]})`}
            />
          ))}
        </nav>

        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
        >
          {activeType && <input type="hidden" name="type" value={activeType} />}
          <div className="flex flex-1 flex-col gap-1.5 sm:max-w-md">
            <label htmlFor="library-search" className="sr-only">
              Search the library
            </label>
            <input
              id="library-search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search title or topic (e.g. binary, Network, rubric)"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          <Button type="submit" variant="secondary">
            <Search className="size-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title={
                entries.length === 0
                  ? "Nothing approved yet"
                  : "No artifacts match"
              }
              description={
                entries.length === 0
                  ? "Generate a lesson, quiz, worksheet, rubric or explanation in its tool, review it and approve — it will appear here ready to reuse."
                  : "Try a different search or type filter."
              }
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TH>Type</TH>
                  <TH>Title</TH>
                  <TH>Topic</TH>
                  <TH>Approved</TH>
                  <TH>Source</TH>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TD>
                      <span className="inline-flex rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                        {LIBRARY_TYPE_LABELS[entry.type]}
                      </span>
                    </TD>
                    <TD>
                      <a
                        href={entry.href}
                        className="font-medium text-accent hover:underline"
                      >
                        {entry.title}
                      </a>
                      <span className="block text-xs text-muted">
                        {entry.subtitle}
                      </span>
                    </TD>
                    <TD>{entry.topic}</TD>
                    <TD>
                      {entry.approvedAt ? formatDate(entry.approvedAt) : "—"}
                    </TD>
                    <TD>
                      <AIBadge
                        provider={entry.provider}
                        className="whitespace-nowrap"
                      />
                    </TD>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function chipHref(type: LibraryArtifactType | undefined, q?: string): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (q?.trim()) params.set("q", q.trim());
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

function TypeChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {label}
    </a>
  );
}
