import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/authentication/cookies";
import { getSessionStore } from "@/lib/authentication/session";

/** `/` never renders anything itself — it's just the authoritative fork
 * between "show the dashboard" and "show the login page" the spec asks
 * for ("When a user opens http://localhost:3001, show a redesigned login
 * page before allowing access to the website"). */
export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? getSessionStore().resolveUser(token) : null;

  redirect(user ? "/dashboard" : "/login");
}
