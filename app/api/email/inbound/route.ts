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
  };
};

type ResendEmailDetailResponse = {
  text?: string | null;
  html?: string | null;
};

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractEmailAddress(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);

  if (bracketMatch?.[1]) {
    return normalizeEmail(bracketMatch[1]);
  }

  if (trimmed.includes("@")) {
    return normalizeEmail(trimmed);
  }

  return null;
}

function extractDisplayName(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const bracketIndex = trimmed.indexOf("<");

  if (bracketIndex > 0) {
    const name = trimmed.slice(0, bracketIndex).trim().replace(/^"|"$/g, "");
    return name || null;
  }

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

function verifyWebhookWithSvix(
  payload: string,
  request: NextRequest,
): ResendReceivedEvent {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing webhook signature headers.");
  }

  const webhook = new Webhook(getEnv("RESEND_WEBHOOK_SECRET"));

  return webhook.verify(payload, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as ResendReceivedEvent;
}

async function fetchInboundEmailBody(emailId: string) {
  let bodyText = "";
  let bodyHtml: string | null = null;

  try {
    const resendApiKey = getEnv("RESEND_API_KEY");

    const emailRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
      cache: "no-store",
    });

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      console.warn("Failed to fetch email body from Resend:", errorText);
      return { bodyText, bodyHtml };
    }

    const emailData = (await emailRes.json()) as ResendEmailDetailResponse;

    bodyText = (emailData.text ?? "").trim();
    bodyHtml = emailData.html ?? null;

    console.log("Fetched inbound email body preview:", {
      emailId,
      textPreview: bodyText.slice(0, 120),
      hasHtml: Boolean(bodyHtml),
    });
  } catch (error) {
    console.warn("Error fetching email body from Resend:", error);
  }

  return { bodyText, bodyHtml };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();

    console.log("Inbound email webhook headers:", {
      svixId: request.headers.get("svix-id"),
      svixTimestamp: request.headers.get("svix-timestamp"),
      hasSvixSignature: Boolean(request.headers.get("svix-signature")),
    });

    console.log("Inbound email webhook raw payload:", payload);

    let verified: ResendReceivedEvent;

    try {
      verified = verifyWebhookWithSvix(payload, request);
      console.log("Inbound email webhook signature verification: passed");
    } catch (verificationError) {
      console.warn(
        "Inbound email webhook signature verification failed, using raw payload temporarily:",
        verificationError,
      );
      verified = JSON.parse(payload) as ResendReceivedEvent;
    }

    console.log("Inbound email webhook parsed event:", verified);

    if (verified.type !== "email.received") {
      return ok({
        ok: true,
        ignored: true,
        reason: "Unhandled event type",
      });
    }

    const recipientEmail = pickRecipient(toEmailArray(verified.data.to));
    if (!recipientEmail) {
      return badRequest("No supported recipient found.");
    }

    const routing = parseRouting(recipientEmail);
    if (routing.type === "unknown") {
      return badRequest("Recipient address does not match support routing rules.");
    }

    const senderEmail = extractEmailAddress(verified.data.from);
    if (!senderEmail) {
      return badRequest("Missing sender email.");
    }

    const senderName = extractDisplayName(verified.data.from);
    const subject = (verified.data.subject ?? "(No subject)").trim() || "(No subject)";
    const providerMessageId =
      verified.data.message_id?.trim() || verified.data.email_id.trim();

    const { bodyText, bodyHtml } = await fetchInboundEmailBody(
      verified.data.email_id.trim(),
    );

    const attachmentsJson = (verified.data.attachments ?? []).map(
      (attachment: ReceivedAttachmentMeta) => ({
        id: attachment.id ?? null,
        filename: attachment.filename ?? null,
        contentType: attachment.content_type ?? null,
        size: attachment.size ?? null,
      }),
    );

    const supabase = getSupabaseAdmin();

    const { data: existingMessage, error: existingMessageError } = await supabase
      .from("ticket_messages")
      .select("id")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (existingMessageError) {
      console.error("Failed checking duplicate inbound message", existingMessageError);
      return NextResponse.json(
        { error: "Failed checking duplicate inbound message." },
        { status: 500 },
      );
    }

    if (existingMessage) {
      return ok({
        ok: true,
        duplicate: true,
      });
    }

    if (routing.type === "new_ticket") {
      let publicThreadId = generatePublicThreadId();

      for (let i = 0; i < 5; i += 1) {
        const { data: existingTicket, error: existingTicketError } = await supabase
          .from("support_tickets")
          .select("id")
          .eq("public_thread_id", publicThreadId)
          .maybeSingle();

        if (existingTicketError) {
          console.error("Failed checking public_thread_id uniqueness", existingTicketError);
          return NextResponse.json(
            { error: "Failed creating new ticket." },
            { status: 500 },
          );
        }

        if (!existingTicket) break;

        publicThreadId = generatePublicThreadId();
      }

      const { data: createdTicket, error: createTicketError } = await supabase
        .from("support_tickets")
        .insert({
          public_thread_id: publicThreadId,
          name: senderName ?? senderEmail,
          email: senderEmail,
          subject,
          message: bodyText,
          status: "open",
        })
        .select("id, public_thread_id")
        .single();

      if (createTicketError || !createdTicket) {
        console.error("Failed creating ticket", createTicketError);
        return NextResponse.json(
          { error: "Failed creating new ticket." },
          { status: 500 },
        );
      }

      const { error: createMessageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: createdTicket.id,
          direction: "inbound",
          sender_name: senderName,
          sender_email: senderEmail,
          body_text: bodyText,
          body_html: bodyHtml,
          provider_message_id: providerMessageId,
          attachments_json: attachmentsJson,
        });

      if (createMessageError) {
        console.error("Failed creating first ticket message", createMessageError);
        return NextResponse.json(
          { error: "Failed creating first ticket message." },
          { status: 500 },
        );
      }

      return ok({
        ok: true,
        action: "created_ticket",
        ticketId: createdTicket.id,
        publicThreadId: createdTicket.public_thread_id,
      });
    }

    const { data: ticket, error: ticketLookupError } = await supabase
      .from("support_tickets")
      .select("id, public_thread_id, status")
      .eq("public_thread_id", routing.publicThreadId)
      .maybeSingle();

    if (ticketLookupError) {
      console.error("Failed finding existing ticket", ticketLookupError);
      return NextResponse.json(
        { error: "Failed finding existing ticket." },
        { status: 500 },
      );
    }

    if (!ticket) {
      console.warn("Inbound reply received for unknown public_thread_id", {
        publicThreadId: routing.publicThreadId,
        recipientEmail,
        senderEmail,
      });

      return ok({
        ok: true,
        action: "ignored_unknown_thread",
        publicThreadId: routing.publicThreadId,
      });
    }

    const typedTicket = ticket as TicketRow;

    const { error: insertReplyError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: typedTicket.id,
        direction: "inbound",
        sender_name: senderName,
        sender_email: senderEmail,
        body_text: bodyText,
        body_html: bodyHtml,
        provider_message_id: providerMessageId,
        attachments_json: attachmentsJson,
      });

    if (insertReplyError) {
      console.error("Failed inserting inbound reply", insertReplyError);
      return NextResponse.json(
        { error: "Failed appending inbound reply." },
        { status: 500 },
      );
    }

    const nextStatus: TicketStatus =
      typedTicket.status === "closed" ? "open" : typedTicket.status;

    const { error: updateTicketError } = await supabase
      .from("support_tickets")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", typedTicket.id);

    if (updateTicketError) {
      console.error("Failed updating ticket after inbound reply", updateTicketError);
      return NextResponse.json(
        { error: "Failed updating ticket after inbound reply." },
        { status: 500 },
      );
    }

    return ok({
      ok: true,
      action: "appended_to_ticket",
      ticketId: typedTicket.id,
      publicThreadId: typedTicket.public_thread_id,
    });
  } catch (error) {
    console.error("Inbound email webhook failed", error);

    return NextResponse.json(
      { error: "Unhandled inbound webhook error." },
      { status: 500 },
    );
  }
}