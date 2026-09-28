import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileText,
  FolderOpen,
  LibraryBig,
  ListChecks,
  MessageCircleQuestion,
  PencilLine,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getProviderInfo } from "@/lib/ai/provider";
import { getStore } from "@/lib/db";
import { ReviewBadge } from "@/components/artifacts/ReviewBadge";
import { Badge, Card, CardContent } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

const SECTIONS: Array<{
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    href: "/lesson-planner",
    label: "Lesson Planner",
    description:
      "Turn a topic, level and duration into a full draft lesson plan — then edit every part.",
    icon: BookOpen,
  },
  {
    href: "/quiz-generator",
    label: "Quiz Generator",
    description:
      "Generate MCQ, true/false, short answer, fill-in-the-blank and viva quizzes, schema-validated.",
    icon: ListChecks,
  },
  {
    href: "/question-bank",
    label: "Question Bank",
    description:
      "Build, tag, publish and archive questions; add AI-generated or hand-written items.",
    icon: LibraryBig,
  },
  {
    href: "/worksheets",
    label: "Worksheets",
    description:
      "Printable practice sheets with sections, answer keys and teacher notes.",
    icon: FileText,
  },
  {
    href: "/rubric-builder",
    label: "Rubric Builder",
    description:
      "Four-level criteria rubrics with points for any assignment or lab task.",
    icon: ClipboardCheck,
  },
  {
    href: "/ai-explainer",
    label: "AI Explainer",
    description:
      "Simple explanations, analogies and step-by-step breakdowns of student confusions.",
    icon: MessageCircleQuestion,
  },
  {
    href: "/analytics",
    label: "Class Analytics",
    description:
      "Quiz averages, topic performance and most-missed concepts — no invasive tracking.",
    icon: BarChart3,
  },
  {
    href: "/library",
    label: "Content Library",
    description:
      "Every approved artifact in one place, ready to reuse.",
    icon: FolderOpen,
  },
];

interface RecentArtifact {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  status: "draft" | "approved";
  href: string;
}

export default async function DashboardPage() {
  const user = await requireRole(["TEACHER", "ADMIN"]);
  const provider = getProviderInfo();
  const mongoMode = Boolean(process.env.MONGODB_URI);
  const store = await getStore();

  const [lessons, quizzes, worksheets, rubrics, explanations, questions] =
    await Promise.all([
      store.listLessonPlans(),
      store.listQuizzes(),
      store.listWorksheets(),
      store.listRubrics(),
      store.listExplanations(),
      store.listQuestions({ perPage: 1 }),
    ]);

  const typeCounts = [
    { label: "Lesson plans", count: lessons.length, href: "/lesson-planner/saved" },
    { label: "Quizzes", count: quizzes.length, href: "/quiz-generator" },
    { label: "Worksheets", count: worksheets.length, href: "/worksheets" },
    { label: "Rubrics", count: rubrics.length, href: "/rubrics" },
    { label: "Explanations", count: explanations.length, href: "/ai-explainer" },
    { label: "Bank questions", count: questions.total, href: "/question-bank" },
  ];

  const recent: RecentArtifact[] = [
    ...lessons.map<RecentArtifact>((doc) => ({
      id: doc.id,
      type: "Lesson plan",
      title: doc.content.title,
      createdAt: doc.createdAt,
      status: doc.status,
      href: `/lesson-planner?id=${doc.id}`,
    })),
    ...quizzes.map<RecentArtifact>((doc) => ({
      id: doc.id,
      type: "Quiz",
      title: doc.content.title,
      createdAt: doc.createdAt,
      status: doc.status,
      href: `/quiz-generator?id=${doc.id}`,
    })),
    ...worksheets.map<RecentArtifact>((doc) => ({
      id: doc.id,
      type: "Worksheet",
      title: doc.content.title,
      createdAt: doc.createdAt,
      status: doc.status,
      href: `/worksheets?id=${doc.id}`,
    })),
    ...rubrics.map<RecentArtifact>((doc) => ({
      id: doc.id,
      type: "Rubric",
      title: doc.content.title,
      createdAt: doc.createdAt,
      status: doc.status,
      href: `/rubrics?id=${doc.id}`,
    })),
    ...explanations.map<RecentArtifact>((doc) => ({
      id: doc.id,
      type: "Explanation",
      title: doc.question,
      createdAt: doc.createdAt,
      status: doc.status,
      href: `/ai-explainer?id=${doc.id}`,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const drafts = recent.filter((item) => item.status === "draft");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{user.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          AI drafts the material, you make the decisions. Every generated
          artifact starts as a clearly-labeled draft and becomes usable only
          after a teacher reviews and approves it.
        </p>
      </div>

      {/* Review queue + system status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <PencilLine className="size-4 text-warning" aria-hidden="true" />
                Review queue
              </h2>
              <Badge tone={drafts.length > 0 ? "warning" : "success"}>
                {drafts.length} draft{drafts.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {drafts.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted">
                Nothing is waiting on you — every artifact has been reviewed.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  {drafts.length} draft{drafts.length === 1 ? "" : "s"} awaiting
                  your review — AI output is never final until a teacher
                  approves it.
                </p>
                <ul className="flex flex-col gap-1.5">
                  {drafts.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                      >
                        <span className="truncate font-medium text-fg">{item.title}</span>
                        <span className="shrink-0 text-xs text-muted">{item.type}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
                AI generation
              </h2>
              <Badge tone={provider.mockMode ? "warning" : "success"}>
                {provider.label}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              {provider.mockMode
                ? "Running on the deterministic mock provider: drafts are clearly-labeled sample templates. Set GEMINI_API_KEY or OPENAI_API_KEY (see .env.example) for real generation."
                : `Real generation via the ${provider.label} provider (model ${provider.model}). Every response is schema-validated before it reaches you.`}
            </p>
            <p className="font-mono text-xs text-muted">
              provider: {provider.provider} · model: {provider.model} · storage:{" "}
              {mongoMode ? "mongodb" : "demo (in-memory)"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
        <h2 id="stats-heading" className="text-lg font-semibold tracking-tight text-fg">
          Your workspace at a glance
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {typeCounts.map((stat) => (
            <li key={stat.label}>
              <Link
                href={stat.href}
                className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="text-2xl font-semibold tracking-tight text-fg">
                  {stat.count}
                </span>
                <span className="text-xs font-medium text-muted">{stat.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent artifacts */}
      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="recent-heading" className="text-lg font-semibold tracking-tight text-fg">
            Recent artifacts
          </h2>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Content Library
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted">
              Nothing yet — generate your first draft from any tool below.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm transition-colors hover:bg-surface-2/50"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-fg">{item.title}</span>
                    <span className="text-xs text-muted">
                      {item.type} · {formatDate(item.createdAt)}
                    </span>
                  </span>
                  <ReviewBadge status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tool launcher */}
      <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
        <h2 id="tools-heading" className="text-lg font-semibold tracking-tight text-fg">
          Your tools
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className={cn(
                    "flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors",
                    "hover:border-accent/40 hover:bg-surface-2/50",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  )}
                >
                  <Icon className="size-5 text-accent" aria-hidden="true" />
                  <span className="text-sm font-semibold text-fg">{section.label}</span>
                  <span className="text-xs leading-relaxed text-muted">
                    {section.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Review workflow note */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            How the review workflow protects you
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            Every artifact carries two badges: its AI provenance (provider and
            model, or mock) and its review state. Drafts are marked
            &ldquo;AI-generated draft — teacher review required&rdquo; until you
            approve them, which records your account and the time. Mock-mode
            drafts never claim a real model was involved.
          </p>
          <Link
            href="/settings"
            className="mt-1 inline-flex w-fit items-center gap-2 text-sm font-medium text-accent hover:underline"
          >
            <Settings className="size-4" aria-hidden="true" />
            Check provider settings
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
