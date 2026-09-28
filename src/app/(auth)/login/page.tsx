import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getProviderInfo } from "@/lib/ai/provider";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : undefined;
  const provider = getProviderInfo();

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent/10">
            <Sparkles className="size-6 text-accent" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Smart ICT Learning &amp; AI Teacher Copilot
          </h1>
          <p className="text-sm text-muted">
            Your AI-assisted workspace for lesson plans, quizzes, worksheets
            and rubrics. AI drafts — you decide.
          </p>
        </div>
        <LoginForm next={safeNext} />
        <div className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted">
          <p className="font-medium text-fg">
            Demo accounts (password Demo@12345)
          </p>
          <ul className="mt-2 space-y-1 font-mono">
            <li>admin@demo.local — administrator</li>
            <li>teacher@demo.local — teacher</li>
          </ul>
          <p className="mt-2">
            AI generation status: {provider.label} provider
            {provider.mockMode ? " (sample drafts)" : ""}.
          </p>
        </div>
      </div>
    </div>
  );
}
