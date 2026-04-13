import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSupabaseAdmin() {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getResendClient() {
  return new Resend(getEnv("RESEND_API_KEY"));
}

function getSupportFromEmail() {
  return process.env.SUPPORT_FROM_EMAIL || "support@boostle.pro";
}

function buildReplyToAddress(publicThreadId: string) {
  return `reply+${publicThreadId}@boostle.pro`;
}

function buildOutboundSubject(subject: string) {
  const trimmed = subject.trim();
  if (/^re:/i.test(trimmed)) {
    return trimmed;
  }
  return `Re: ${trimmed}`;
}

function buildTextEmail(message: string) {
  return message.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtmlEmail(message: string) {
  const escaped = escapeHtml(message.trim()).replace(/\n/g, "<br />");

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827;">
      <p>${escaped}</p>
    </div>
  `.trim();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const message = String(body.message ?? "").trim();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Reply message is required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, email, subject, public_thread_id")
      .eq("id", id)
      .maybeSingle();

    if (ticketError) {
      console.error("Failed to load ticket before admin reply:", ticketError);
      return NextResponse.json(
        { ok: false, error: "Failed to load ticket." },
        { status: 500 },
      );
    }

    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: "Ticket not found." },
        { status: 404 },
      );
    }

    const resend = getResendClient();
    const fromEmail = getSupportFromEmail();
    const replyToAddress = buildReplyToAddress(ticket.public_thread_id);
    const outboundSubject = buildOutboundSubject(ticket.subject || "(No subject)");

    const sendResult = await resend.emails.send({
      from: `Boostle Support <${fromEmail}>`,
      to: [ticket.email],
      replyTo: replyToAddress,
      subject: outboundSubject,
      text: buildTextEmail(message),
      html: buildHtmlEmail(message),
    });

    const resendMessageId =
      "data" in sendResult && sendResult.data?.id ? sendResult.data.id : null;

    const resendError =
      "error" in sendResult ? sendResult.error : null;

    if (resendError) {
      console.error("Failed to send admin reply email:", resendError);
      return NextResponse.json(
        { ok: false, error: "Failed to send reply email." },
        { status: 500 },
      );
    }

    const { error: insertError } = await supabase.from("ticket_messages").insert({
      ticket_id: id,
      direction: "outbound",
      sender_name: "Boostle Support",
      sender_email: fromEmail,
      body_text: message,
      body_html: buildHtmlEmail(message),
      provider_message_id: resendMessageId,
      attachments_json: [],
    });

    if (insertError) {
      console.error("Failed to save admin reply:", insertError);
      return NextResponse.json(
        { ok: false, error: "Reply sent but failed to save message." },
        { status: 500 },
      );
    }

    const { error: ticketUpdateError } = await supabase
      .from("support_tickets")
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (ticketUpdateError) {
      console.error(
        "Failed to update ticket status after admin reply:",
        ticketUpdateError,
      );
      return NextResponse.json(
        { ok: false, error: "Reply sent but ticket status update failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      ticketId: id,
      providerMessageId: resendMessageId,
    });
  } catch (error) {
    console.error("Admin reply failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send reply." },
      { status: 500 },
    );
  }
}