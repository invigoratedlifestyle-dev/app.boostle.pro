"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type TicketStatus = "open" | "in_progress" | "closed";

type SupportTicketRecord = {
  id: string;
  subject: string;
  email: string;
  public_thread_id: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isTicketStatus(value: string): value is TicketStatus {
  return value === "open" || value === "in_progress" || value === "closed";
}

function buildReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReplyHtml(message: string) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827;">
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    </div>
  `.trim();
}

export async function updateTicketStatusAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");

  if (!ticketId || !isTicketStatus(status)) {
    redirect(returnTo);
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tickets/${ticketId}`);
  redirect(returnTo);
}

export async function sendTicketReplyAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const replyBody = String(formData.get("replyBody") ?? "").trim();

  if (!ticketId || !replyBody) {
    throw new Error("Missing required reply fields.");
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const supportFromEmail =
    process.env.SUPPORT_FROM_EMAIL || process.env.SUPPORT_AUTO_REPLY_FROM_EMAIL;

  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!supportFromEmail) {
    throw new Error("Missing SUPPORT_FROM_EMAIL or SUPPORT_AUTO_REPLY_FROM_EMAIL.");
  }

  const supabase = getSupabaseAdmin();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, subject, email, public_thread_id")
    .eq("id", ticketId)
    .single<SupportTicketRecord>();

  if (ticketError) {
    throw new Error(`Failed to load ticket: ${ticketError.message}`);
  }

  if (!ticket) {
    throw new Error("Ticket not found.");
  }

  if (!ticket.email) {
    throw new Error("Ticket is missing customer email.");
  }

  if (!ticket.public_thread_id) {
    throw new Error("Ticket is missing public_thread_id.");
  }

  const replyToEmail = `reply+${ticket.public_thread_id}@boostle.pro`;
  const outboundSubject = buildReplySubject(ticket.subject || "(No subject)");
  const replyHtml = buildReplyHtml(replyBody);

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Boostle Support <${supportFromEmail}>`,
      to: [ticket.email],
      subject: outboundSubject,
      text: replyBody,
      html: replyHtml,
      reply_to: replyToEmail,
    }),
    cache: "no-store",
  });

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text();
    throw new Error(`Resend error: ${errorText}`);
  }

  const emailJson = (await emailResponse.json()) as {
    id?: string;
  };

  const providerMessageId = emailJson.id ?? null;

  const { error: replyInsertError } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      direction: "outbound",
      sender_name: "Boostle Support",
      sender_email: supportFromEmail,
      body_text: replyBody,
      body_html: replyHtml,
      provider_message_id: providerMessageId,
      attachments_json: [],
    });

  if (replyInsertError) {
    throw new Error(
      `Reply email sent, but saving reply history failed: ${replyInsertError.message}`,
    );
  }

  const { error: statusError } = await supabase
    .from("support_tickets")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (statusError) {
    throw new Error(statusError.message);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tickets/${ticketId}`);
  redirect(`/admin/tickets/${ticketId}?sent=1`);
}