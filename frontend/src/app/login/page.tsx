import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/authentication/cookies";
import { getSessionStore } from "@/lib/authentication/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in — OmniCard SDUI Admin",
};

/** Only ever redirects to a same-site path (`/dashboard/...`) — never to an
 * arbitrary `from` value, which would make this an open redirect if someone
 * crafted a `/login?from=https://evil.example` link. */
function safeRedirectTarget(from: string | undefined): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const redirectTo = safeRedirectTarget(from);

  // Already signed in with a valid session — no reason to show the login
  // form again (satisfies "refresh after login" staying on the dashboard,
  // and a bookmarked /login link not re-prompting a signed-in user).
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && getSessionStore().resolveUser(token)) {
    redirect(redirectTo);
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — hidden below lg, matches the portal's slate design
          language rather than introducing a new palette. */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <span className="text-lg font-bold">O</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">OmniCard</span>
        </div>
        <div className="relative max-w-sm">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Server-driven UI, managed in one place.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Draft, validate, and publish the OmniCard home screen — with full revision history and role-based
            publishing controls.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} OmniCard. Internal tool.</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-1 items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                <span className="text-lg font-bold">O</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-900">OmniCard</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to the OmniCard admin portal.</p>

            <div className="mt-6">
              <LoginForm redirectTo={redirectTo} />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Accounts are provisioned by an administrator. Contact your admin if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
