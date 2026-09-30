/**
 * Authoritative auth guard for everything under `/dashboard` — a Node.js
 * Server Component (the App Router default runtime for a route segment
 * like this one, unless it opts into `export const runtime = "edge"`,
 * which this file does not), so it can call the DB-backed session store
 * directly. `middleware.ts` already redirected the no-cookie case cheaply
 * at the edge; this catches everything that layer can't: an expired
 * session, a cookie value that doesn't match any session, or a session
 * whose user has since been removed.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/authentication/cookies";
import { getSessionStore } from "@/lib/authentication/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? getSessionStore().resolveUser(token) : null;

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
