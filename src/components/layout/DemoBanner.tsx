import { Info } from "lucide-react";
import { getProviderInfo } from "@/lib/ai/provider";

/**
 * Honest demo-mode labels (spec section 36 + 20.1): never pretend.
 * - Mock AI provider: sample drafts, clearly labeled, with the fix.
 * - DemoStore (no MONGODB_URI): data resets on restart.
 */
export function DemoBanner() {
  const provider = getProviderInfo();
  const demoStore = !process.env.MONGODB_URI;

  const messages: string[] = [];
  if (provider.mockMode) {
    messages.push(
      "Mock mode: sample AI drafts. Set GEMINI_API_KEY or OPENAI_API_KEY (see .env.example) for real generation.",
    );
  }
  if (demoStore) {
    messages.push(
      "Demo storage: data resets on restart. Set MONGODB_URI (see .env.example) for persistence.",
    );
  }
  if (messages.length === 0) return null;

  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10">
      {messages.map((message) => (
        <p
          key={message}
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-xs text-warning sm:px-6"
        >
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ))}
    </div>
  );
}
