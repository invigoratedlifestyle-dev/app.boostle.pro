"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type TicketStatus = "open" | "in_progress" | "closed";

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
    .update({ status })
    .eq("id", ticketId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tickets/${ticketId}`);
  redirect(returnTo);
}

export async function sendTicketReplyAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");
  const toEmail = String(formData.get("toEmail") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const replyBody = String(formData.get("replyBody") ?? "").trim();

  if (!ticketId || !toEmail || !subject || !replyBody) {
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

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: supportFromEmail,
      to: [toEmail],
      subject: `Re: ${subject}`,
      text: replyBody,
    }),
    cache: "no-store",
  });

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text();
    throw new Error(`Resend error: ${errorText}`);
  }

  const supabase = getSupabaseAdmin();

  const { error: statusError } = await supabase
    .from("support_tickets")
    .update({ status: "in_progress" })
    .eq("id", ticketId);

  if (statusError) {
    throw new Error(statusError.message);
  }

  const { error: replyInsertError } = await supabase
    .from("support_ticket_replies")
    .insert({
      ticket_id: ticketId,
      body: replyBody,
      sent_to: toEmail,
      sent_by: supportFromEmail,
    });

  if (replyInsertError) {
    console.error("Reply history insert failed:", replyInsertError.message);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tickets/${ticketId}`);
  redirect(returnTo);
}