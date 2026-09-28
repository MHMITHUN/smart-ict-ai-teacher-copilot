import type { Metadata } from "next";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { Badge, Card, CardContent } from "@/components/ui";
import { requireRole } from "@/lib/auth/guards";
import { getProviderInfo } from "@/lib/ai/provider";
import { getEnvStatus } from "@/lib/settings/env-status";
import { DisplayNameForm } from "@/components/settings/DisplayNameForm";

export const metadata: Metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

/**
 * Settings: display-name update and HONEST environment status. Secrets are
 * never shown or editable here — the page only reports whether each key is
 * PRESENT (a boolean), plus where the values themselves live (.env.local,
 * managed outside the app).
 */
export default async function SettingsPage() {
  const user = await requireRole(["TEACHER", "ADMIN"]);
  const provider = getProviderInfo();
  const mongoMode = Boolean(process.env.MONGODB_URI);
  const envStatus = getEnvStatus();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Settings</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Your account and an honest view of how this deployment is
          configured. Secrets are managed in the environment (a local
          <span className="font-mono"> .env.local</span> file or your hosting
          provider&apos;s dashboard) — never in this page.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold text-fg">Your account</h2>
          <DisplayNameForm currentName={user.name} />
          <dl className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd className="font-medium text-fg">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Role</dt>
              <dd className="font-medium text-fg">
                {user.role === "ADMIN" ? "Administrator" : "Teacher"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">AI provider</h2>
            <Badge tone={provider.mockMode ? "warning" : "success"}>
              {provider.label}
            </Badge>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Provider</dt>
              <dd className="font-mono text-fg">{provider.provider}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Model</dt>
              <dd className="font-mono text-fg">{provider.model}</dd>
            </div>
          </dl>
          <p className="text-sm leading-relaxed text-muted">
            {provider.mockMode
              ? "No API key is configured, so generation uses the deterministic mock provider: drafts are honest, clearly-labeled sample templates. Set GEMINI_API_KEY or OPENAI_API_KEY in the environment for real generation (see .env.example)."
              : "Generation runs server-side against the configured provider. API keys never reach the browser; every response is zod-validated before use, with one repair retry on validation failure."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <KeyRound className="size-4 text-accent" aria-hidden="true" />
            Environment status
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            Which configuration keys are PRESENT in this deployment — values
            are never read into the interface. Change them in{" "}
            <span className="font-mono">.env.local</span> (see{" "}
            <span className="font-mono">.env.example</span>) and restart the
            server.
          </p>
          <ul className="flex flex-col gap-2">
            {envStatus.map((item) => (
              <li
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-mono text-sm text-fg">{item.key}</span>
                  <span className="text-xs leading-relaxed text-muted">{item.note}</span>
                </div>
                {item.present ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    present
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                    <XCircle className="size-3" aria-hidden="true" />
                    not set
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">Storage</h2>
            <Badge tone={mongoMode ? "success" : "warning"}>
              {mongoMode ? "MongoDB" : "Demo (in-memory)"}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            {mongoMode
              ? `Persisted to MongoDB (database ${process.env.MONGODB_DB_NAME || "ai_teacher_copilot"}).`
              : "No MONGODB_URI is set, so the app runs on the in-memory demo store: seeded lazily, resets on server restart. Set MONGODB_URI (see .env.example) for persistence."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
