import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  LibraryBig,
  ListPlus,
  Pencil,
  Plus,
} from "lucide-react";
import { getStore } from "@/lib/db";
import type { Difficulty, QuestionType } from "@/lib/ai/schemas";
import type { QuestionBankStatus } from "@/lib/db/types";
import {
  appendQuestionToQuizAction,
  archiveQuestionAction,
  bulkArchiveQuestionsAction,
  bulkPublishQuestionsAction,
  duplicateQuestionAction,
  publishQuestionAction,
  restoreQuestionAction,
} from "@/app/actions/questions";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableEmpty,
  TableHead,
  TableRow,
  TD,
  TH,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Question Bank",
};

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "MCQ",
  true_false: "True/False",
  short_answer: "Short answer",
  fill_blank: "Fill blank",
  viva: "Viva",
};

function StatusBadge({ status }: { status: QuestionBankStatus }) {
  if (status === "published") {
    return <Badge tone="success">published</Badge>;
  }
  if (status === "archived") {
    return <Badge tone="neutral">archived</Badge>;
  }
  return <Badge tone="warning">draft</Badge>;
}

function pageHref(params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  search.set("page", String(page));
  return `/question-bank?${search.toString()}`;
}

/**
 * Question Bank (spec 20.5): filterable, paginated (15/page) table with the
 * full lifecycle — create, edit, duplicate, publish, archive, bulk ops,
 * add-to-quiz — plus published-only JSON/CSV export.
 */
export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    topic?: string;
    difficulty?: string;
    type?: string;
    status?: string;
    page?: string;
    addtoquiz?: string;
    created?: string;
    updated?: string;
    added?: string;
    quiz?: string;
  }>;
}) {
  const sp = await searchParams;
  const store = await getStore();

  const status = (["draft", "published", "archived"] as const).find(
    (candidate) => candidate === sp.status,
  );
  const difficulty: Difficulty | undefined = ["easy", "medium", "hard"].includes(sp.difficulty ?? "")
    ? (sp.difficulty as Difficulty)
    : undefined;
  const type: QuestionType | undefined = [
    "mcq",
    "true_false",
    "short_answer",
    "fill_blank",
    "viva",
  ].includes(sp.type ?? "")
    ? (sp.type as QuestionType)
    : undefined;
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const filter = {
    search: sp.q || undefined,
    topic: sp.topic || undefined,
    difficulty,
    type,
    status,
    perPage: 15,
  };
  let result = await store.listQuestions({ ...filter, page: requestedPage });
  // A page number past the end (e.g. after filtering) lands back on the last page.
  if (result.items.length === 0 && requestedPage > result.totalPages && result.total > 0) {
    result = await store.listQuestions({ ...filter, page: result.totalPages });
  }
  const page = result.page;

  // "Add to quiz" picker (opened via ?addtoquiz=<questionId>).
  const pickerQuestion = sp.addtoquiz ? await store.getQuestion(sp.addtoquiz) : null;
  const quizzes = pickerQuestion ? await store.listQuizzes() : [];

  const filterParams: Record<string, string | undefined> = {
    q: sp.q,
    topic: sp.topic,
    difficulty: sp.difficulty,
    type: sp.type,
    status: sp.status,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Question Bank</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {result.total} question{result.total === 1 ? "" : "s"}
            {status ? ` · ${status}` : " · active (archived hidden)"}. Publish before
            exporting; archived questions are excluded from listings and exports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/questions/export?format=json"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            title="Export published questions as JSON"
          >
            <Download className="size-4" aria-hidden="true" />
            JSON
          </a>
          <a
            href="/api/questions/export?format=csv"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            title="Export published questions as CSV"
          >
            <FileText className="size-4" aria-hidden="true" />
            CSV
          </a>
          <Link
            href="/question-bank/new"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="size-4" aria-hidden="true" />
            New question
          </Link>
        </div>
      </div>

      {sp.created && (
        <Alert tone="success" title="Question created">
          It starts as a draft — publish it when you are happy, then it can be
          exported and added to quizzes.
        </Alert>
      )}
      {sp.updated && <Alert tone="success">Question updated.</Alert>}
      {sp.added && (
        <Alert tone={sp.added === "1" ? "success" : "info"} title="Add to quiz">
          {sp.added === "1"
            ? `Question appended to “${sp.quiz ?? "the quiz"}”. Open the quiz to review it.`
            : `That question was already in “${sp.quiz ?? "the quiz"}” — nothing duplicated.`}
        </Alert>
      )}

      {/* Filters (GET form — the table re-renders from the URL). Plain
          markup: this page is a server component, so no client render-props. */}
      <form
        method="get"
        className="grid items-end gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-5"
      >
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="filter-q" className="sr-only">
            Search
          </label>
          <input
            id="filter-q"
            name="q"
            defaultValue={sp.q}
            placeholder="Search question text, topic or tags"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-topic" className="sr-only">
            Topic
          </label>
          <input
            id="filter-topic"
            name="topic"
            defaultValue={sp.topic}
            placeholder="Topic"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-difficulty" className="sr-only">
            Difficulty
          </label>
          <select
            id="filter-difficulty"
            name="difficulty"
            defaultValue={sp.difficulty ?? ""}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Any difficulty</option>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-type" className="sr-only">
            Type
          </label>
          <select
            id="filter-type"
            name="type"
            defaultValue={sp.type ?? ""}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Any type</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={sp.status ?? ""}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Active (excludes archived)</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="flex items-center gap-2 md:col-span-4">
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
          <Link
            href="/question-bank"
            className="text-sm font-medium text-muted hover:text-fg hover:underline"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Add-to-quiz picker */}
      {pickerQuestion && (
        <Card>
          <CardHeader>
            <CardTitle>Add to quiz</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            <p className="text-sm text-muted">
              Pick the quiz that receives:{' '}
              <span className="font-medium text-fg">{pickerQuestion.question}</span>
            </p>
            {quizzes.length === 0 ? (
              <p className="text-sm text-muted">
                No quizzes yet — generate one in the Quiz Generator first.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {quizzes.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-fg">
                        {quiz.content.title}
                      </span>
                      <span className="text-xs text-muted">
                        {quiz.content.questions.length} questions · {quiz.classLevel} ·{" "}
                        {quiz.status}
                      </span>
                    </span>
                    <form action={appendQuestionToQuizAction}>
                      <input type="hidden" name="questionId" value={pickerQuestion.id} />
                      <input type="hidden" name="quizId" value={quiz.id} />
                      <Button type="submit" variant="outline" size="sm">
                        <ListPlus className="size-3.5" aria-hidden="true" />
                        Append
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/question-bank"
              className="w-fit text-sm font-medium text-muted hover:text-fg hover:underline"
            >
              Cancel
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Bulk table: ONE form; row buttons use bound server actions via
          formAction (submitter name/value pairs never reach FormData with
          server actions, so ids travel through .bind). */}
      <form action={bulkArchiveQuestionsAction}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" size="sm" formAction={bulkArchiveQuestionsAction}>
            <Archive className="size-3.5" aria-hidden="true" />
            Archive selected
          </Button>
          <Button type="submit" variant="outline" size="sm" formAction={bulkPublishQuestionsAction}>
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Publish selected
          </Button>
          <span className="text-xs text-muted">
            Select questions with the checkboxes, then apply a bulk action.
          </span>
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            title="No questions match"
            description="Adjust the filters, or create a question — AI-generated quizzes can also send their questions here."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TH className="w-10">
                  <span className="sr-only">Select</span>
                </TH>
                <TH>Question</TH>
                <TH>Type</TH>
                <TH>Difficulty</TH>
                <TH>Topic</TH>
                <TH>Tags</TH>
                <TH>Status</TH>
                <TH>Source</TH>
                <TH className="text-right">Actions</TH>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.items.map((question) => (
                <TableRow key={question.id}>
                  <TD>
                    <input
                      type="checkbox"
                      name="ids"
                      value={question.id}
                      aria-label={`Select: ${question.question.slice(0, 60)}`}
                      className="size-4 rounded border-border accent-accent"
                    />
                  </TD>
                  <TD className="max-w-72">
                    <span className="line-clamp-2" title={question.question}>
                      {question.question}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      updated {formatDate(question.updatedAt)}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-muted">
                    {TYPE_LABELS[question.type]}
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{question.difficulty}</TD>
                  <TD className="whitespace-nowrap text-muted">{question.topic}</TD>
                  <TD>
                    <span className="flex max-w-40 flex-wrap gap-1">
                      {question.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                      {question.tags.length > 3 && (
                        <Badge tone="neutral">+{question.tags.length - 3}</Badge>
                      )}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={question.status} />
                  </TD>
                  <TD>
                    <Badge tone={question.source === "ai" ? "accent" : "neutral"}>
                      {question.source === "ai" ? "AI" : "Manual"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Link
                        href={`/question-bank/${question.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        formAction={duplicateQuestionAction.bind(null, question.id)}
                        title="Duplicate as a new draft"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        Duplicate
                      </Button>
                      {question.status === "draft" && (
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          formAction={publishQuestionAction.bind(null, question.id)}
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          Publish
                        </Button>
                      )}
                      {question.status !== "archived" ? (
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-muted hover:text-danger"
                          formAction={archiveQuestionAction.bind(null, question.id)}
                        >
                          <Archive className="size-3.5" aria-hidden="true" />
                          Archive
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          formAction={restoreQuestionAction.bind(null, question.id)}
                        >
                          <ArchiveRestore className="size-3.5" aria-hidden="true" />
                          Restore
                        </Button>
                      )}
                      <Link
                        href={pageHref({ ...filterParams, addtoquiz: question.id }, 1)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                        title="Append this question to a quiz"
                      >
                        <ListPlus className="size-3.5" aria-hidden="true" />
                        To quiz
                      </Link>
                    </div>
                  </TD>
                </TableRow>
              ))}
              {result.items.length === 0 && (
                <TableEmpty colSpan={9}>No questions match the filters.</TableEmpty>
              )}
            </TableBody>
          </Table>
        )}
      </form>

      {/* Pagination (15/page, spec 20.5) */}
      <nav
        aria-label="Question bank pages"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm text-muted">
          Page {page} of {result.totalPages} · {result.total} question
          {result.total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(filterParams, page - 1)}
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted opacity-50">
              Previous
            </span>
          )}
          {page < result.totalPages ? (
            <Link
              href={pageHref(filterParams, page + 1)}
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted opacity-50">
              Next
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
