import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ShieldCheck, TrendingDown } from "lucide-react";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import {
  classAveragePct,
  completionRate,
  difficultyDistribution,
  mostMissedConcepts,
  quizAverageTrend,
  topicPerformance,
} from "@/lib/analytics/aggregates";
import {
  DifficultyBarChart,
  TopicBarChart,
  TrendLineChart,
} from "@/components/analytics/AnalyticsCharts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TD,
  TH,
  TableHead,
  TableRow,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Class Analytics",
};

export const dynamic = "force-dynamic";

/**
 * Class Analytics (spec 20.9): AGGREGATED CLASS-LEVEL VIEW ONLY — quiz
 * averages, topic performance, completion and most-missed concepts from
 * seeded QuizResult rows. There is deliberately no individual-student
 * page: the point is teaching insight, not surveillance.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  await requireRole(["TEACHER", "ADMIN"]);
  const { classId } = await searchParams;
  const store = await getStore();

  const classes = await store.listClassGroups();
  const activeClassId = classId && classes.some((c) => c.id === classId)
    ? classId
    : (classes[0]?.id ?? "");
  const results = activeClassId ? await store.listQuizResults(activeClassId) : [];
  const bankPage = await store.listQuestions({ perPage: 100 });

  const activeClass = classes.find((c) => c.id === activeClassId);
  const trend = quizAverageTrend(results);
  const topics = topicPerformance(results);
  const missed = mostMissedConcepts(results);
  const completion = completionRate(results);
  const average = classAveragePct(results);
  const difficulties = difficultyDistribution(bankPage.items);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Class Analytics</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Aggregate teaching insight from recorded quiz results — averages,
          topic performance, completion and the concepts your classes are
          missing. No individual student is tracked or shown anywhere.
        </p>
      </div>

      <div
        className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm"
        role="note"
      >
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <p>
          <span className="font-semibold text-fg">
            Aggregated class-level view only.
          </span>{" "}
          These figures describe the whole class, never a named student —
          that is a deliberate design limit (spec 20.9), not a missing
          feature.
        </p>
      </div>

      {/* Class filter (GET form — server component, plain markup). */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="class-filter" className="text-xs font-medium text-muted">
            Class
          </label>
          <select
            id="class-filter"
            name="classId"
            defaultValue={activeClassId}
            className="h-10 w-56 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {classes.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.studentCount} students)
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Update view
        </Button>
        {activeClass && (
          <p className="text-xs text-muted">
            {activeClass.subject} · demo data: fictional students, fixed
            Feb-Sep 2026 dates.
          </p>
        )}
      </form>

      {results.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={classes.length === 0 ? "No classes to report on yet" : "No results recorded for this class"}
          description={
            classes.length === 0
              ? "Demo mode seeds three classes with fictional results. With MONGODB_URI set, classes start empty until results are recorded."
              : "Once quiz results are recorded for this class, averages, trends and most-missed concepts appear here."
          }
        />
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Class average" value={`${average}%`} hint={`${results.length} attempts recorded`} />
            <StatCard
              label="Quiz completion"
              value={`${completion.ratePct}%`}
              hint={`${completion.covered} of ${completion.expected} expected sittings covered (${completion.students} students x ${completion.topicsAdministered} topics)`}
            />
            <StatCard
              label="Topics administered"
              value={String(completion.topicsAdministered)}
              hint={topics.map((row) => row.topic).join(", ")}
            />
            <StatCard
              label="Needs attention"
              value={String(missed.filter((row) => row.needsAttention).length)}
              hint="topics averaging under 60%"
            />
          </div>

          {/* Trend + topic performance */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quiz average trend</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-4">
                <TrendLineChart data={trend} />
                <p className="text-xs leading-relaxed text-muted">
                  Monthly average % across every administered quiz. Dips point
                  to the month&apos;s topic, not to students — pair with the
                  topic chart below.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Topic performance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-4">
                <TopicBarChart data={topics} />
                <Table>
                  <TableHead>
                    <TableRow>
                      <TH>Topic</TH>
                      <TH>Average</TH>
                      <TH>Attempts</TH>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topics.map((row) => (
                      <TableRow key={row.topic}>
                        <TD>{row.topic}</TD>
                        <TD>
                          <span
                            className={cn(
                              "font-semibold",
                              row.averagePct >= 70
                                ? "text-success"
                                : row.averagePct >= 60
                                  ? "text-warning"
                                  : "text-danger",
                            )}
                          >
                            {row.averagePct}%
                          </span>
                        </TD>
                        <TD>{row.attempts}</TD>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Most-missed + difficulty distribution */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="size-4 text-danger" aria-hidden="true" />
                  Most-missed concepts
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TH>Topic</TH>
                      <TH>Avg score</TH>
                      <TH>Status</TH>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {missed.map((row) => (
                      <TableRow key={row.topic}>
                        <TD>{row.topic}</TD>
                        <TD>{row.averagePct}%</TD>
                        <TD>
                          {row.needsAttention ? (
                            <Badge tone="danger">Below 60% — reteach</Badge>
                          ) : (
                            <Badge tone="success">On track</Badge>
                          )}
                        </TD>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs leading-relaxed text-muted">
                  Ordered weakest-first. Rows under 60% are flagged for
                  re-teaching — revisit them in the Lesson Planner.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Question bank difficulty mix</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-4">
                <DifficultyBarChart data={difficulties} />
                <p className="text-xs leading-relaxed text-muted">
                  Difficulty distribution of the bank questions (archived
                  excluded). A healthy bank leans easy/medium for class quizzes
                  and keeps a hard tail for challenges —{" "}
                  <Link href="/question-bank" className="font-medium text-accent hover:underline">
                    open the Question Bank
                  </Link>{" "}
                  to rebalance.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-fg">{value}</span>
        {hint && <span className="text-xs leading-relaxed text-muted">{hint}</span>}
      </CardContent>
    </Card>
  );
}
