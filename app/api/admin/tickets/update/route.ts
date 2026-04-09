import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support";

const validStatuses: SupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
];

const validPriorities: SupportTicketPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export async function POST(request: Request) {
  try {
    const authed = await isAdminAuthenticated();

    if (!authed) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      id?: string;
      status?: string;
      priority?: string;
      admin_notes?: string | null;
    };

    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim() as SupportTicketStatus;
    const priority = String(
      body.priority ?? "",
    ).trim() as SupportTicketPriority;
    const adminNotes =
      typeof body.admin_notes === "string" ? body.admin_notes.trim() : "";

    if (!id) {
      throw new Error("Missing ticket id.");
    }

    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status.");
    }

    if (!validPriorities.includes(priority)) {
      throw new Error("Invalid priority.");
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        status,
        priority,
        admin_notes: adminNotes || null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      ticket: data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}