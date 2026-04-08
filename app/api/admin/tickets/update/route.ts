import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { id, status, priority, admin_notes } = body;

    if (!id) {
      throw new Error("Missing ticket id");
    }

    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        status,
        priority,
        admin_notes,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}