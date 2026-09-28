"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  LogOut,
  MessageCircleQuestion,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/db/types";
import type { ProviderInfo } from "@/lib/ai/provider";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lesson-planner", label: "Lesson Planner", icon: BookOpen },
  { href: "/quiz-generator", label: "Quiz Generator", icon: ListChecks },
  { href: "/question-bank", label: "Question Bank", icon: LibraryBig },
  { href: "/worksheets", label: "Worksheets", icon: FileText },
  { href: "/rubric-builder", label: "Rubric Builder", icon: ClipboardCheck },
  { href: "/ai-explainer", label: "AI Explainer", icon: MessageCircleQuestion },
  { href: "/analytics", label: "Class Analytics", icon: BarChart3 },
  { href: "/library", label: "Content Library", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({
  user,
  provider,
}: {
  user: PublicUser;
  provider: ProviderInfo;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent">
            <Sparkles className="size-5 text-accent-fg" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-fg">
              AI Teacher Copilot
            </span>
            <span className="text-xs text-muted">Smart ICT Learning</span>
          </div>
        </div>

        <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
          <ProviderChip provider={provider} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-fg">
                {user.name}
              </span>
              <span className="text-xs text-muted">
                {user.role === "ADMIN" ? "Administrator" : "Teacher"}
              </span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile header + horizontal nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="size-4 text-accent-fg" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-fg">
              AI Teacher Copilot
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ProviderChip provider={provider} />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Workspace"
          className="scrollbar-none overflow-x-auto border-t border-border px-2 py-1.5"
        >
          <ul className="flex min-w-max items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
    </>
  );
}

/** Provider status chip: Mock / Gemini / OpenAI — never shows keys. */
function ProviderChip({ provider }: { provider: ProviderInfo }) {
  const tone =
    provider.provider === "mock"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-success/30 bg-success/10 text-success";
  return (
    <span
      title={`AI provider: ${provider.label} (${provider.model})${
        provider.mockMode ? " — sample drafts, no real model is called" : ""
      }`}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          provider.provider === "mock" ? "bg-warning" : "bg-success",
        )}
        aria-hidden="true"
      />
      {provider.label}
    </span>
  );
}
