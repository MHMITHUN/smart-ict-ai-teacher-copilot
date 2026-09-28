import { requireRole } from "@/lib/auth/guards";
import { getProviderInfo } from "@/lib/ai/provider";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";

/**
 * The whole workspace is login-gated (spec 20.1): teacher + admin roles
 * only, no public area. Server actions and pages under this layout can
 * rely on an authenticated user.
 */
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["TEACHER", "ADMIN"]);
  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
  const provider = getProviderInfo();

  return (
    <div className="min-h-screen">
      <WorkspaceSidebar user={publicUser} provider={provider} />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <DemoBanner />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
