import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "boostle_admin_session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!expected) {
    throw new Error("Missing ADMIN_DASHBOARD_PASSWORD");
  }

  return session === expected;
}