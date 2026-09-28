import { redirect } from "next/navigation";

/**
 * The whole app lives behind the login-gated workspace — there is no public
 * area, so the root simply sends everyone to the dashboard (which the
 * workspace layout guards with requireRole).
 */
export default function RootPage() {
  redirect("/dashboard");
}
