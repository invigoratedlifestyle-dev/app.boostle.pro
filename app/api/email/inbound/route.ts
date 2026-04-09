import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostmarkAddress = {
  Email?: string;
  Name?: string;
  MailboxHash?: string;
};

type PostmarkAttachment = {
  Name?: string;
  ContentType?: string;
  ContentLength?: number;
};

type PostmarkInboundPayload = {
  From?: string;
  FromName?: string;
  FromFull?: PostmarkAddress;
  To?: string;
  ToFull?: PostmarkAddress[];
  Cc?: string;
  CcFull?: PostmarkAddress[];
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MessageID?: string;
  Attachments?: PostmarkAttachment[];
};

type TicketRow = {
  id: string;
  public_thread_id: string;
  status: "open" | "pending" | "closed";
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

function generatePublicThreadId(length = 8): string {
  return randomBytes(16)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, length);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractEmailFromString(input: string | undefined | null): string | null {
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

function pickRecipient(payload: PostmarkInboundPayload): string | null {
  const toFull = payload.ToFull ?? [];

  for (const recipient of toFull) {
    const email = recipient.Email ? normalizeEmail(recipient.Email) : null;
    if (!email) continue;

    if (
      email === "support@boostle.pro" ||
      /^reply\+[a-z0-9_-]+@boostle\.pro$/i.test(email)
    ) {
      return email;
    }
  }

  return extractEmailFromString(payload.To);
}

function parseRouting(recipientEmail: string) {
  const normalized = normalizeEmail(recipientEmail);

  if (normalized === "support@boostle.pro") {
    return {
      type: "new_ticket" as const,
    };
  }

  const match = normalized.match(/^reply\+([a-z0-9_-]+)@boostle\.pro$/i);

  if (match) {
    return {
      type: "existing_ticket" as const,
      publicThreadId: match[1],
    };
  }

  return {
    type: "unknown" as const,
  };
}

function getSenderEmail(payload: PostmarkInboundPayload): string | null {
  if (payload.FromFull?.Email) {
    return normalizeEmail(payload.FromFull.Email);
  }

  return extractEmailFromString(payload.From);
}

function getSenderName(payload: PostmarkInboundPayload): string | null {
  const fromFullName = payload.FromFull?.Name?.trim();
  if (fromFullName) return fromFullName;

  const fromName = payload.FromName?.trim();
  if (fromName) return fromName;

  return null;
}

function getSafeTextBody(payload: PostmarkInboundPayload): string {
  const stripped = payload.StrippedTextReply?.trim();
  if (stripped) return stripped;

  const text = payload.TextBody?.trim();
  if (text) return text;

  const html = payload.HtmlBody?.trim();
  if (html) return html;

  return "";
}

function parseAttachments(payload: PostmarkInboundPayload) {
  const attachments = payload.Attachments ?? [];

  return attachments.map((attachment) => ({
    name: attachment.Name ?? null,
    contentType: attachment.ContentType ?? null,
    contentLength: attachment.ContentLength ?? null,
  }));
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function ok(data: Record<string, unknown>) {
  return NextResponse.json(data, { status: 200 });
}

function verifyBasicAuth(request: NextRequest): boolean {
  const username = process.env.POSTMARK_INBOUND_BASIC_AUTH_USERNAME;
  const password = process.env.POSTMARK_INBOUND_BASIC_AUTH_PASSWORD;

  if (!username && !password) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return false;
  }

  const encoded = authHeader.slice("Basic ".length).trim();

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const [providedUsername, ...rest] = decoded.split(":");
    const providedPassword = rest.join(":");

    return (
      providedUsername === (username ?? "") &&
      providedPassword === (password ?? "")
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyBasicAuth(request)) {
      return unauthorized();
    }

    const payload = (await request.json()) as PostmarkInboundPayload;

    const senderEmail = getSenderEmail(payload);
    const senderName = getSenderName(payload);
    const recipientEmail = pickRecipient(payload);
    const subject = (payload.Subject ?? "(No subject)").trim() || "(No subject)";
    const bodyText = getSafeTextBody(payload);
    const bodyHtml = payload.HtmlBody?.trim() || null;
    const providerMessageId = payload.MessageID?.trim() || null;
    const attachments = parseAttachments(payload);

    if (!senderEmail) {
      return badRequest("Missing sender email.");
    }

    if (!recipientEmail) {
      return badRequest("Missing recipient email.");
    }

    const routing = parseRouting(recipientEmail);

    if (routing.type === "unknown") {
      return badRequest("Recipient address does not match support routing rules.");
    }

    const supabase = getSupabaseAdmin();

    if (providerMessageId) {
      const { data: existingMessage, error: existingMessageError } = await supabase
        .from("ticket_messages")
        .select("id")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();

      if (existingMessageError) {
        console.error("Failed checking duplicate provider_message_id", existingMessageError);
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
    }

    if (routing.type === "new_ticket") {
      let publicThreadId = generatePublicThreadId();

      for (let i = 0; i < 5; i += 1) {
        const { data: existingTicket, error: existingTicketError } = await supabase
          .from("tickets")
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

        if (!existingTicket) {
          break;
        }

        publicThreadId = generatePublicThreadId();
      }

      const { data: createdTicket, error: createTicketError } = await supabase
        .from("tickets")
        .insert({
          public_thread_id: publicThreadId,
          customer_name: senderName,
          customer_email: senderEmail,
          subject,
          status: "open",
          source: "email",
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

      const { error: createMessageError } = await supabase.from("ticket_messages").insert({
        ticket_id: createdTicket.id,
        direction: "inbound",
        sender_name: senderName,
        sender_email: senderEmail,
        body_text: bodyText,
        body_html: bodyHtml,
        provider_message_id: providerMessageId,
        attachments_json: attachments,
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
      .from("tickets")
      .select("id, public_thread_id, status")
      .eq("public_thread_id", routing.publicThreadId)
      .maybeSingle<TicketRow>();

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

    const { error: insertReplyError } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      direction: "inbound",
      sender_name: senderName,
      sender_email: senderEmail,
      body_text: bodyText,
      body_html: bodyHtml,
      provider_message_id: providerMessageId,
      attachments_json: attachments,
    });

    if (insertReplyError) {
      console.error("Failed inserting inbound reply", insertReplyError);
      return NextResponse.json(
        { error: "Failed appending inbound reply." },
        { status: 500 },
      );
    }

    const nextStatus = ticket.status === "closed" || ticket.status === "pending" ? "open" : ticket.status;

    const { error: updateTicketError } = await supabase
      .from("tickets")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

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
      ticketId: ticket.id,
      publicThreadId: ticket.public_thread_id,
    });
  } catch (error) {
    console.error("Inbound email webhook failed", error);

    return NextResponse.json(
      { error: "Unhandled inbound webhook error." },
      { status: 500 },
    );
  }
}