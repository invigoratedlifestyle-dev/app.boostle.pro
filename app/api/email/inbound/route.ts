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
};

function getEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
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

function extractReplyThreadId(addresses: InboundAddress[]) {
  for (const entry of addresses) {
    const email = extractEmailAddress(entry);

    if (!email) continue;

    const match = email.match(/^reply\+([^@]+)@/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
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

async function parseInboundPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as InboundPayload;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();

    const to = formData.getAll("to");
    const cc = formData.getAll("cc");
    const from = formData.get("from");
    const subject = formData.get("subject");
    const text = formData.get("text");
    const html = formData.get("html");

    return {
      from: typeof from === "string" ? from : undefined,
      to: to.map((value) => String(value)),
      cc: cc.map((value) => String(value)),
      subject: typeof subject === "string" ? subject : undefined,
      text: typeof text === "string" ? text : undefined,
      html: typeof html === "string" ? html : undefined,
    } satisfies InboundPayload;
  }

  throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await parseInboundPayload(request);
    const supabase = getSupabaseAdmin();

    const toAddresses = toAddressList(payload.to);
    const ccAddresses = toAddressList(payload.cc);
    const allRecipientAddresses = [...toAddresses, ...ccAddresses];

    const senderEmail = extractEmailAddress(payload.from);
    const senderName = extractDisplayName(payload.from);
    const threadId = extractReplyThreadId(allRecipientAddresses);

    const rawBody =
      (typeof payload.text === "string" && payload.text.trim()) ||
      (typeof payload.html === "string" && stripHtml(payload.html).trim()) ||
      "";

    const cleanedBody = cleanInboundBody(rawBody);

    console.log("Inbound email received", {
      subject: payload.subject || "",
      senderEmail,
      recipients: allRecipientAddresses
        .map((entry) => extractEmailAddress(entry))
        .filter(Boolean),
      threadId,
      hasBody: Boolean(cleanedBody),
    });

    if (!threadId) {
      console.warn("Inbound email ignored: no reply thread id found", {
        to: allRecipientAddresses,
      });

      return NextResponse.json({ ok: true });
    }

    if (!senderEmail) {
      console.warn("Inbound email ignored: sender email missing or invalid");
      return NextResponse.json({ ok: true });
    }

    if (!cleanedBody) {
      console.warn("Inbound email ignored: empty cleaned body", {
        threadId,
        senderEmail,
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
        senderEmail,
      });

      return NextResponse.json({ ok: true });
    }

    const { error: insertError } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      direction: "inbound",
      sender_name: senderName,
      sender_email: senderEmail,
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
      senderEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Inbound email webhook error", error);
    return NextResponse.json({ ok: true });
  }
}