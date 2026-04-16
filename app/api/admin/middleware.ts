import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "boostle_admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/dashboard");
  const isAdminLoginPage = pathname === "/dashboard/login";

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  if (isAdminLoginPage) {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!expected || session !== expected) {
    const loginUrl = new URL("/dashboard/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};