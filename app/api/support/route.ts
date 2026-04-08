import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  CreateSupportTicketInput,
  SupportApiResponse,
  SupportTicket,
} from "@/types/support";

function validatePayload(body: unknown): CreateSupportTicketInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  const data = body as Record<string, unknown>;

  const name = String(data.name ?? "").trim();
  const email = String(data.email ?? "").trim();
  const subject = String(data.subject ?? "").trim();
  const message = String(data.message ?? "").trim();

  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");
  if (!subject) throw new Error("Subject is required.");
  if (!message) throw new Error("Message is required.");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  return { name, email, subject, message };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = validatePayload(body);

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
        status: "open",
        priority: "normal",
        source: "website",
      })
      .select("id, ticket_number")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const response: SupportApiResponse = {
      ok: true,
      ticketId: data.id,
      ticketNumber: data.ticket_number,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    const response: SupportApiResponse = {
      ok: false,
      error: message,
    };

    return NextResponse.json(response, { status: 400 });
  }
}