import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketStatus = "open" | "in_progress" | "closed";

type TicketRow = {
  id: string;
  public_thread_id: string;
  status: TicketStatus;
};

type ReceivedAttachmentMeta = {
  id?: string;
  filename?: string;
  content_type?: string;
  size?: number;
};

type ResendReceivedEvent = {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    from: string;
    to: string[] | string;
    cc?: string[] | string;
    bcc?: string[] | string;
    subject?: string;
    message_id?: string;
    attachments?: ReceivedAttachmentMeta[];
    text?: string | null;
    html?: string | null;
    body?: string | null;
    raw?: string;
    raw_email?: string;
    rawEmail?: string;
  };
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseAdmin() {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractEmailAddress(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/<([^>]+)>/);
  if (match?.[1]) return normalizeEmail(match[1]);
  if (trimmed.includes("@")) return normalizeEmail(trimmed);
  return null;
}

function extractDisplayName(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const index = trimmed.indexOf("<");
  if (index > 0) return trimmed.slice(0, index).trim().replace(/^"|"$/g, "");
  return null;
}

function parseRouting(recipientEmail: string) {
  const normalized = normalizeEmail(recipientEmail);

  if (normalized === "support@boostle.pro") {
    return { type: "new_ticket" as const };
  }

  const match = normalized.match(/^reply\+([a-z0-9_-]+)@boostle\.pro$/i);

  if (match) {
    return {
      type: "existing_ticket" as const,
      publicThreadId: match[1],
    };
  }

  return { type: "unknown" as const };
}

function toEmailArray(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickRecipient(to: string[]): string | null {
  for (const value of to) {
    const email = extractEmailAddress(value);
    if (!email) continue;

    if (
      email === "support@boostle.pro" ||
      /^reply\+[a-z0-9_-]+@boostle\.pro$/i.test(email)
    ) {
      return email;
    }
  }
  return null;
}

function generatePublicThreadId(length = 8): string {
  return randomBytes(16)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, length);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function ok(data: Record<string, unknown>) {
  return NextResponse.json(data, { status: 200 });
}

function verifyWebhookWithSvix(payload: string, request: NextRequest) {
  const webhook = new Webhook(getEnv("RESEND_WEBHOOK_SECRET"));

  return webhook.verify(payload, {
    "svix-id": request.headers.get("svix-id")!,
    "svix-timestamp": request.headers.get("svix-timestamp")!,
    "svix-signature": request.headers.get("svix-signature")!,
  }) as ResendReceivedEvent;
}

/**
 * 🔥 FINAL FIX — RAW EMAIL PARSER
 */
function extractInboundBody(event: ResendReceivedEvent) {
  let bodyText = "";
  let bodyHtml: string | null = null;

  // Try all possible raw fields
  const raw =
    event.data.raw ||
    event.data.raw_email ||
    event.data.rawEmail ||
    null;

  if (!raw) {
    console.warn("No raw email content found in webhook");
    return { bodyText, bodyHtml };
  }

  try {
    // Split MIME headers from body
    const parts = raw.split(/\r?\n\r?\n/);

    if (parts.length > 1) {
      bodyText = parts.slice(1).join("\n\n").trim();
    }

    console.log("Extracted raw email body:", {
      preview: bodyText.slice(0, 120),
    });
  } catch (err) {
    console.warn("Failed to parse raw email", err);
  }

  return { bodyText, bodyHtml };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();

    let verified: ResendReceivedEvent;

    try {
      verified = verifyWebhookWithSvix(payload, request);
    } catch {
      verified = JSON.parse(payload);
    }

    if (verified.type !== "email.received") {
      return ok({ ok: true, ignored: true });
    }

    const recipientEmail = pickRecipient(toEmailArray(verified.data.to));
    if (!recipientEmail) return badRequest("No supported recipient");

    const routing = parseRouting(recipientEmail);
    if (routing.type === "unknown") {
      return badRequest("Invalid routing");
    }

    const senderEmail = extractEmailAddress(verified.data.from);
    if (!senderEmail) return badRequest("Missing sender email");

    const senderName = extractDisplayName(verified.data.from);
    const subject = verified.data.subject || "(No subject)";
    const providerMessageId =
      verified.data.message_id || verified.data.email_id;

    const { bodyText, bodyHtml } = extractInboundBody(verified);

    const supabase = getSupabaseAdmin();

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, public_thread_id, status")
      .eq("public_thread_id", routing.type === "existing_ticket" ? routing.publicThreadId : "")
      .maybeSingle();

    if (!ticket) {
      return ok({ ok: true, ignored: true });
    }

    await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      direction: "inbound",
      sender_name: senderName,
      sender_email: senderEmail,
      body_text: bodyText,
      body_html: bodyHtml,
      provider_message_id: providerMessageId,
    });

    await supabase
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticket.id);

    return ok({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}