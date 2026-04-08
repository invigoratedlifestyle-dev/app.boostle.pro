import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = String(body.password ?? "");
    const expected = process.env.ADMIN_DASHBOARD_PASSWORD;

    if (!expected) {
      throw new Error("Missing ADMIN_DASHBOARD_PASSWORD");
    }

    if (password !== expected) {
      return NextResponse.json(
        { ok: false, error: "Invalid password." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: expected,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}