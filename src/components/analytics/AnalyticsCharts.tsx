"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DifficultySlice,
  TopicRow,
  TrendPoint,
} from "@/lib/analytics/aggregates";

/**
 * Recharts wrappers for Class Analytics (spec 20.9). Colors come from the
 * workspace palette (@theme tokens in globals.css): violet accent for the
 * primary series, green/amber/red for good/warning/weak performance. Every
 * chart also exists as a table on the page — color is never the only
 * signal (WCAG AA).
 */

const ACCENT = "#6d28d9";
const SUCCESS = "#15803d";
const WARNING = "#b45309";
const DANGER = "#b91c1c";
const MUTED = "#645d75";
const GRID = "#e6e4ef";

const AXIS_STYLE = { fontSize: 12, fill: MUTED } as const;

function barColor(row: { averagePct: number }): string {
  if (row.averagePct >= 70) return SUCCESS;
  if (row.averagePct >= 60) return WARNING;
  return DANGER;
}

/** Monthly quiz average trend (0-100%). */
export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  return (
    <div
      role="img"
      aria-label={`Line chart of the monthly class quiz average, from ${data[0]?.label ?? ""} (${data[0]?.averagePct ?? 0}%) to ${data[data.length - 1]?.label ?? ""} (${data[data.length - 1]?.averagePct ?? 0}%).`}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <Tooltip
            formatter={(value) => [`${String(value)}%`, "Class average"]}
          />
          <Line
            type="monotone"
            dataKey="averagePct"
            stroke={ACCENT}
            strokeWidth={2}
            dot={{ r: 3, fill: ACCENT }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Average % per topic (strongest first); red bars flag the weak ones. */
export function TopicBarChart({ data }: { data: TopicRow[] }) {
  return (
    <div
      role="img"
      aria-label={`Bar chart of average score per topic, strongest first: ${data
        .map((row) => `${row.topic} ${row.averagePct}%`)
        .join(", ")}.`}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="topic"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={48}
          />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <Tooltip formatter={(value) => [`${String(value)}%`, "Average"]} />
          <Bar
            dataKey="averagePct"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((row) => (
              <Cell key={row.topic} fill={barColor(row)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bank-question difficulty distribution (counts per level). */
export function DifficultyBarChart({ data }: { data: DifficultySlice[] }) {
  return (
    <div
      role="img"
      aria-label={`Bar chart of question-bank difficulty: ${data
        .map((slice) => `${slice.difficulty} ${slice.count}`)
        .join(", ")}.`}
      className="h-56 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: -24 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="difficulty"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip formatter={(value) => [String(value), "Questions"]} />
          <Bar
            dataKey="count"
            fill={MUTED}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
