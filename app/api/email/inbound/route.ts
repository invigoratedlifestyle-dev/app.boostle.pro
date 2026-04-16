import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
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
  download_url?: string;
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
    payload?: string;
  };
};

type ResendReceivedEmailResponse = {
  text?: string | null;
  html?: string | null;
  subject?: string | null;
  from?: string | null;
  to?: string[] | null;
  cc?: string[] | null;
  bcc?: string[] | null;
  attachments?: ReceivedAttachmentMeta[] | null;
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

function getResendClient() {
  return new Resend(getEnv("RESEND_API_KEY"));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractEmailAddress(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const match = trimmed.match(/<([^>]+)>/);

  if (match?.[1]) {
    return normalizeEmail(match[1]);
  }

  if (trimmed.includes("@")) {
    return normalizeEmail(trimmed);
  }

  return null;
}

function extractDisplayName(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const index = trimmed.indexOf("<");

  if (index > 0) {
    const name = trimmed.slice(0, index).trim().replace(/^"|"$/g, "");
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
  const webhook = new Webhook(getEnv("RESEND_WEBHOOK_SECRET"));

  return webhook.verify(payload, {
    "svix-id": request.headers.get("svix-id")!,
    "svix-timestamp": request.headers.get("svix-timestamp")!,
    "svix-signature": request.headers.get("svix-signature")!,
  }) as ResendReceivedEvent;
}

function trimQuotedReply(text: string): string {
  if (!text) return "";

  const normalized = text.replace(/\r\n/g, "\n");

  const patterns = [
    /\nOn .* wrote:/i,
    /\nFrom: .*/i,
    /\nSent: .*/i,
    /\nTo: .*/i,
    /\nSubject: .*/i,
    /\n---+.*/i,
  ];

  let trimmed = normalized;

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match && typeof match.index === "number") {
      trimmed = trimmed.slice(0, match.index);
    }
  }

  const lines = trimmed.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    const currentLine = line.trim();

    if (currentLine.startsWith(">") || currentLine.startsWith("|")) {
      continue;
    }

    cleanLines.push(line);
  }

  return cleanLines.join("\n").trim();
}

async function fetchReceivedEmailContent(
  emailId: string,
): Promise<{ bodyText: string; bodyHtml: string | null }> {
  try {
    const resend = getResendClient();
    const result = await resend.emails.receiving.get(emailId);

    const data = (result as { data?: ResendReceivedEmailResponse; error?: unknown })
      .data;

    const rawText = (data?.text ?? "").trim();
    const rawHtml = data?.html ?? null;

    const bodyText = trimQuotedReply(rawText);

    console.log("Received email API body fetch:", {
      emailId,
      hasText: Boolean(bodyText),
      hasHtml: Boolean(rawHtml),
      textPreview: bodyText.slice(0, 120),
    });

    return {
      bodyText,
      bodyHtml: rawHtml,
    };
  } catch (error) {
    console.warn("Failed to fetch received email content from Resend API", {
      emailId,
      error,
    });

    return {
      bodyText: "",
      bodyHtml: null,
    };
  }
}

function extractFallbackInboundBody(event: ResendReceivedEvent) {
  const directText = (event.data.text ?? event.data.body ?? "").trim();
  const directHtml = event.data.html ?? null;

  if (directText || directHtml) {
    const cleanedText = trimQuotedReply(directText);

    console.log("Inbound body extracted from webhook fallback fields:", {
      hasText: Boolean(cleanedText),
      hasHtml: Boolean(directHtml),
      textPreview: cleanedText.slice(0, 120),
    });

    return {
      bodyText: cleanedText,
      bodyHtml: directHtml,
    };
  }

  console.warn("No body fields found in webhook fallback payload");
  return {
    bodyText: "",
    bodyHtml: null,
  };
}

function isInternalSenderEmail(email: string | null) {
  if (!email) return false;

  return (
    email === "support@boostle.pro" ||
    /^reply\+[a-z0-9_-]+@boostle\.pro$/i.test(email) ||
    email.endsWith("@boostle.pro")
  );
}

function extractCustomerIdentityFromBody(input: {
  bodyText: string;
  bodyHtml: string | null;
}) {
  const combined = [input.bodyText, input.bodyHtml ?? ""].filter(Boolean).join("\n");

  const emailMatch = combined.match(
    /email:\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  );

  const nameMatch = combined.match(/name:\s*(.+)/i);

  return {
    email: emailMatch?.[1] ? normalizeEmail(emailMatch[1]) : null,
    name: nameMatch?.[1]?.trim() ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();

    console.log("Inbound email webhook headers:", {
      svixId: request.headers.get("svix-id"),
      svixTimestamp: request.headers.get("svix-timestamp"),
      hasSvixSignature: Boolean(request.headers.get("svix-signature")),
    });

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

    console.log("Inbound email webhook parsed event:", {
      type: verified.type,
      emailId: verified.data?.email_id,
      hasText: Boolean(verified.data?.text),
      hasHtml: Boolean(verified.data?.html),
      hasBody: Boolean(verified.data?.body),
      attachmentsCount: verified.data?.attachments?.length ?? 0,
    });

    if (verified.type !== "email.received") {
      return ok({ ok: true, ignored: true });
    }

    const recipientEmail = pickRecipient(toEmailArray(verified.data.to));
    if (!recipientEmail) {
      return badRequest("No supported recipient");
    }

    const routing = parseRouting(recipientEmail);
    if (routing.type === "unknown") {
      return badRequest("Invalid routing");
    }

    let senderEmail = extractEmailAddress(verified.data.from);
    let senderName = extractDisplayName(verified.data.from);
    const subject =
      (verified.data.subject ?? "(No subject)").trim() || "(No subject)";
    const providerMessageId =
      (verified.data.message_id ?? verified.data.email_id).trim();

    const apiContent = await fetchReceivedEmailContent(verified.data.email_id.trim());
    const fallbackContent = extractFallbackInboundBody(verified);

    const bodyText = apiContent.bodyText || fallbackContent.bodyText;
    const bodyHtml = apiContent.bodyHtml || fallbackContent.bodyHtml;

    if (isInternalSenderEmail(senderEmail)) {
      const recovered = extractCustomerIdentityFromBody({
        bodyText,
        bodyHtml,
      });

      if (recovered.email) {
        senderEmail = recovered.email;
      }

      if (recovered.name) {
        senderName = recovered.name;
      }

      console.log("Recovered customer identity from inbound email body", {
        originalFrom: verified.data.from,
        recoveredEmail: senderEmail,
        recoveredName: senderName,
      });
    }

    if (!senderEmail) {
      return badRequest("Missing sender email");
    }

    const attachmentsJson = (verified.data.attachments ?? []).map(
      (attachment: ReceivedAttachmentMeta) => ({
        id: attachment.id ?? null,
        filename: attachment.filename ?? null,
        contentType: attachment.content_type ?? null,
        size: attachment.size ?? null,
        downloadUrl: attachment.download_url ?? null,
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
      .select("id, public_thread_id, status, email")
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

    const typedTicket = ticket as TicketRow & { email?: string | null };

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

    const ticketUpdate: Record<string, unknown> = {
      status: "open",
      updated_at: new Date().toISOString(),
    };

    if (
      senderEmail &&
      !isInternalSenderEmail(senderEmail) &&
      typedTicket.email !== senderEmail
    ) {
      ticketUpdate.email = senderEmail;
    }

    const { error: updateTicketError } = await supabase
      .from("support_tickets")
      .update(ticketUpdate)
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
      capturedBody: Boolean(bodyText),
      senderEmail,
    });
  } catch (err) {
    console.error("Inbound email webhook failed", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}