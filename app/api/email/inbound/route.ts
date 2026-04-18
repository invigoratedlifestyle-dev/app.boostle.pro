import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InboundAddress =
  | string
  | {
      email?: string;
      address?: string;
      name?: string;
    };

type InboundPayload = {
  from?: string | { email?: string; address?: string; name?: string };
  to?: InboundAddress | InboundAddress[];
  cc?: InboundAddress | InboundAddress[];
  subject?: string;
  text?: string;
  html?: string;
  envelope?: {
    to?: InboundAddress | InboundAddress[];
    cc?: InboundAddress | InboundAddress[];
  };
  headers?: {
    to?: InboundAddress | InboundAddress[];
    cc?: InboundAddress | InboundAddress[];
  };
  [key: string]: unknown;
};

function getEnv(name: string): string {
  const value = process.env[name]?.trim();

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
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function extractEmailAddress(input: unknown): string | null {
  if (!input) return null;

  if (typeof input === "object" && input !== null) {
    const maybeAddress =
      "email" in input && typeof input.email === "string"
        ? input.email
        : "address" in input && typeof input.address === "string"
          ? input.address
          : null;

    return maybeAddress && isValidEmail(maybeAddress)
      ? normalizeEmail(maybeAddress)
      : null;
  }

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);

  if (bracketMatch?.[1]) {
    const email = bracketMatch[1].trim();
    return isValidEmail(email) ? normalizeEmail(email) : null;
  }

  const fallbackMatch = trimmed.match(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
  );

  if (fallbackMatch?.[1]) {
    const email = fallbackMatch[1].trim();
    return isValidEmail(email) ? normalizeEmail(email) : null;
  }

  return isValidEmail(trimmed) ? normalizeEmail(trimmed) : null;
}

function extractDisplayName(input: unknown): string | null {
  if (!input) return null;

  if (typeof input === "object" && input !== null) {
    if ("name" in input && typeof input.name === "string" && input.name.trim()) {
      return input.name.trim();
    }

    return null;
  }

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  const match = trimmed.match(/^(.*?)<[^>]+>$/);

  if (!match?.[1]) {
    return null;
  }

  const name = match[1].trim().replace(/^"|"$/g, "");
  return name || null;
}

function toAddressList(input: unknown): InboundAddress[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input as InboundAddress];
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function cleanInboundBody(input: string) {
  if (!input) return "";

  const normalized = input.replace(/\r\n/g, "\n").trim();

  if (!normalized) return "";

  const lines = normalized.split("\n");
  const cleanLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const currentLine = line.trim();
    const nextLine = (lines[i + 1] ?? "").trim();

    const isQuoteHeaderStart =
      /^On .+<.+@.+>$/.test(currentLine) ||
      /^On .+wrote:$/i.test(currentLine) ||
      /^From:\s.+/i.test(currentLine) ||
      /^Sent:\s.+/i.test(currentLine) ||
      /^To:\s.+/i.test(currentLine) ||
      /^Cc:\s.+/i.test(currentLine) ||
      /^Subject:\s.+/i.test(currentLine) ||
      /^-{-}.*Original Message.*-{-}$/i.test(currentLine) ||
      /^_{2,}$/.test(currentLine) ||
      /^-{3,}$/.test(currentLine);

    const isTwoLineQuoteHeader =
      /^On .+<.+@.+>$/.test(currentLine) && /^wrote:$/i.test(nextLine);

    if (isQuoteHeaderStart || isTwoLineQuoteHeader) {
      break;
    }

    if (currentLine.startsWith(">") || currentLine.startsWith("|")) {
      continue;
    }

    cleanLines.push(line);
  }

  return cleanLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectRecipientCandidates(payload: Record<string, unknown>): string[] {
  const values: string[] = [];

  const pushValue = (value: unknown) => {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        pushValue(item);
      }
      return;
    }

    if (typeof value === "string") {
      values.push(value);
      return;
    }

    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;

      if (typeof record.email === "string") {
        values.push(record.email);
      }

      if (typeof record.address === "string") {
        values.push(record.address);
      }

      if (typeof record.to === "string") {
        values.push(record.to);
      }

      if (typeof record.cc === "string") {
        values.push(record.cc);
      }

      if (typeof record.raw === "string") {
        values.push(record.raw);
      }

      if (Array.isArray(record.to)) {
        pushValue(record.to);
      }

      if (Array.isArray(record.cc)) {
        pushValue(record.cc);
      }
    }
  };

  pushValue(payload.to);
  pushValue(payload.cc);

  if (typeof payload.envelope === "object" && payload.envelope !== null) {
    const envelope = payload.envelope as Record<string, unknown>;
    pushValue(envelope.to);
    pushValue(envelope.cc);
    pushValue(envelope.raw);
  }

  if (typeof payload.headers === "object" && payload.headers !== null) {
    const headers = payload.headers as Record<string, unknown>;
    pushValue(headers.to);
    pushValue(headers.cc);
    pushValue(headers.raw);
  }

  return values;
}

function extractReplyThreadIdFromCandidates(candidates: string[]) {
  for (const candidate of candidates) {
    const match = String(candidate).match(/reply\+([^@>\s]+)@/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractReplyThreadIdFromRawBody(raw: string) {
  if (!raw) return null;

  const match = raw.match(/reply\+([^@"'>\s]+)@/i);
  return match?.[1] ?? null;
}

async function parseInboundPayload(request: NextRequest): Promise<{
  payload: InboundPayload;
  rawBody: string;
}> {
  const contentType = request.headers.get("content-type") || "";
  const rawBody = await request.text();

  if (contentType.includes("application/json")) {
    return {
      payload: JSON.parse(rawBody) as InboundPayload,
      rawBody,
    };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);

    const to = params.getAll("to");
    const cc = params.getAll("cc");
    const from = params.get("from");
    const subject = params.get("subject");
    const text = params.get("text");
    const html = params.get("html");
    const envelope = params.get("envelope");
    const headers = params.get("headers");

    let parsedEnvelope: Record<string, unknown> | undefined;
    let parsedHeaders: Record<string, unknown> | undefined;

    if (typeof envelope === "string" && envelope.trim()) {
      try {
        parsedEnvelope = JSON.parse(envelope) as Record<string, unknown>;
      } catch {
        parsedEnvelope = { raw: envelope };
      }
    }

    if (typeof headers === "string" && headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers) as Record<string, unknown>;
      } catch {
        parsedHeaders = { raw: headers };
      }
    }

    return {
      rawBody,
      payload: {
        from: from || undefined,
        to,
        cc,
        subject: subject || undefined,
        text: text || undefined,
        html: html || undefined,
        envelope: parsedEnvelope,
        headers: parsedHeaders,
      } satisfies InboundPayload,
    };
  }

  throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
}

export async function POST(request: NextRequest) {
  try {
    const { payload, rawBody } = await parseInboundPayload(request);
    const supabase = getSupabaseAdmin();

    const toAddresses = toAddressList(payload.to);
    const ccAddresses = toAddressList(payload.cc);
    const allRecipientAddresses = [...toAddresses, ...ccAddresses];

    const senderEmail = extractEmailAddress(payload.from);
    const senderName = extractDisplayName(payload.from);

    const payloadRecord = payload as Record<string, unknown>;
    const recipientCandidates = collectRecipientCandidates(payloadRecord);

    const addressBasedThreadId = extractReplyThreadIdFromCandidates(
      allRecipientAddresses
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }

          return entry.email || entry.address || "";
        })
        .filter(Boolean),
    );

    const candidateBasedThreadId =
      extractReplyThreadIdFromCandidates(recipientCandidates);

    const rawBodyThreadId = extractReplyThreadIdFromRawBody(rawBody);

    const threadId =
      addressBasedThreadId || candidateBasedThreadId || rawBodyThreadId;

    const rawBodyPreview = rawBody.slice(0, 500);

    const rawBodyTextMatch = rawBody.match(/(?:^|[&"\s])text=([^&]+)/i);
    const decodedRawText = rawBodyTextMatch?.[1]
      ? decodeURIComponent(rawBodyTextMatch[1].replace(/\+/g, " "))
      : "";

    const rawBodyHtmlMatch = rawBody.match(/(?:^|[&"\s])html=([^&]+)/i);
    const decodedRawHtml = rawBodyHtmlMatch?.[1]
      ? decodeURIComponent(rawBodyHtmlMatch[1].replace(/\+/g, " "))
      : "";

    const rawBodyFromMatch = rawBody.match(/(?:^|[&"\s])from=([^&]+)/i);
    const rawBodyFrom = rawBodyFromMatch?.[1]
      ? decodeURIComponent(rawBodyFromMatch[1].replace(/\+/g, " "))
      : "";

    const senderEmailFromRaw = senderEmail || extractEmailAddress(rawBodyFrom);

    const rawBodyContent =
      decodedRawText.trim() ||
      (decodedRawHtml.trim() ? stripHtml(decodedRawHtml).trim() : "") ||
      "";

    const rawBodyRecipients = Array.from(
      new Set(
        Array.from(
          rawBody.matchAll(/[a-zA-Z0-9._%+-]*reply\+[^@\s"'<>]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi),
        ).map((match) => match[0]),
      ),
    );

    const rawBodyFallbackBody = rawBodyContent || rawBody;

    const rawBodyBasedBody = cleanInboundBody(rawBodyFallbackBody);

    const payloadBody =
      (typeof payload.text === "string" && payload.text.trim()) ||
      (typeof payload.html === "string" && stripHtml(payload.html).trim()) ||
      "";

    const cleanedBody = cleanInboundBody(payloadBody || rawBodyBasedBody);

    console.log("Inbound email received", {
      subject: payload.subject || "",
      senderEmail: senderEmailFromRaw,
      recipients: allRecipientAddresses
        .map((entry) => extractEmailAddress(entry))
        .filter(Boolean),
      recipientCandidates,
      rawBodyRecipients,
      payloadKeys: Object.keys(payloadRecord),
      addressBasedThreadId,
      candidateBasedThreadId,
      rawBodyThreadId,
      rawBodyPreview,
      threadId,
      hasBody: Boolean(cleanedBody),
    });

    if (!threadId) {
      console.warn("Inbound email ignored: no reply thread id found", {
        to: allRecipientAddresses,
        recipientCandidates,
        rawBodyRecipients,
      });

      return NextResponse.json({ ok: true });
    }

    if (!senderEmailFromRaw) {
      console.warn("Inbound email ignored: sender email missing or invalid");
      return NextResponse.json({ ok: true });
    }

    if (!cleanedBody) {
      console.warn("Inbound email ignored: empty cleaned body", {
        threadId,
        senderEmail: senderEmailFromRaw,
      });

      return NextResponse.json({ ok: true });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, status, email, public_thread_id")
      .eq("public_thread_id", threadId)
      .maybeSingle();

    if (ticketError) {
      console.error("Failed finding support ticket for inbound email", {
        threadId,
        error: ticketError,
      });

      return NextResponse.json({ ok: true });
    }

    if (!ticket) {
      console.warn("Inbound email ignored: no matching support ticket found", {
        threadId,
        senderEmail: senderEmailFromRaw,
      });

      return NextResponse.json({ ok: true });
    }

    const { error: insertError } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      direction: "inbound",
      sender_name: senderName,
      sender_email: senderEmailFromRaw,
      body_text: cleanedBody,
    });

    if (insertError) {
      console.error("Failed inserting inbound ticket message", {
        ticketId: ticket.id,
        error: insertError,
      });

      return NextResponse.json({ ok: true });
    }

    const { error: updateError } = await supabase
      .from("support_tickets")
      .update({ status: "open" })
      .eq("id", ticket.id);

    if (updateError) {
      console.error("Failed updating support ticket status after inbound email", {
        ticketId: ticket.id,
        error: updateError,
      });
    }

    console.log("Inbound email linked to support ticket", {
      ticketId: ticket.id,
      threadId,
      senderEmail: senderEmailFromRaw,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Inbound email webhook error", error);
    return NextResponse.json({ ok: true });
  }
}