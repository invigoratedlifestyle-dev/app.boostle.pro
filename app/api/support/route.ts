import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportRequestBody = {
  name?: string;
  email?: string;
  storeUrl?: string;
  appName?: string;
  subject?: string;
  category?: string;
  message?: string;
};

type CreatedTicketRow = {
  id: string;
  public_thread_id?: string | null;
};

type SupportApiResponse = {
  ok: boolean;
  ticketId?: string;
  ticketNumber?: number | null;
  error?: string;
};

type SupabaseLikeError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
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
        autoRefreshToken: false,
        persistSession: false,
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

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function generatePublicThreadId(length = 10): string {
  return randomBytes(16)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, length);
}

function extractEmailAddress(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);

  if (bracketMatch?.[1]) {
    const email = bracketMatch[1].trim();
    return isValidEmail(email) ? normalizeEmail(email) : null;
  }

  return isValidEmail(trimmed) ? normalizeEmail(trimmed) : null;
}

function buildFromAddress(input: string | null, fallbackEmail: string): string {
  const fallback = normalizeEmail(fallbackEmail);

  if (!input) {
    return `Boostle Support <${fallback}>`;
  }

  const trimmed = input.trim();
  const extracted = extractEmailAddress(trimmed);

  if (!extracted) {
    return `Boostle Support <${fallback}>`;
  }

  const nameMatch = trimmed.match(/^(.*?)<[^>]+>$/);
  const displayName = nameMatch?.[1]?.trim().replace(/^"|"$/g, "");

  if (displayName) {
    return `${displayName} <${extracted}>`;
  }

  return extracted;
}

function buildTicketSummaryText(input: {
  ticketLabel: string;
  category: string;
  appName: string;
  subject: string;
  storeUrl: string;
  message: string;
  supportEmail: string;
}) {
  const { ticketLabel, category, appName, subject, storeUrl, message, supportEmail } =
    input;

  return [
    `We’ve received your support request for ${appName}.`,
    "",
    `Ticket: ${ticketLabel}`,
    `Subject: ${subject}`,
    `Category: ${category}`,
    `Store: ${storeUrl}`,
    "",
    "What happens next:",
    "- We’ve logged your request successfully.",
    "- We’ll review the issue and reply as soon as possible.",
    `- You can reply directly to ${supportEmail} if you need to add more detail.`,
    "",
    "Your message:",
    message,
    "",
    "Thanks,",
    "Boostle Support",
  ].join("\n");
}

function buildTicketSummaryHtml(input: {
  customerName: string;
  ticketLabel: string;
  category: string;
  appName: string;
  subject: string;
  storeUrl: string;
  message: string;
  supportEmail: string;
}) {
  const {
    customerName,
    ticketLabel,
    category,
    appName,
    subject,
    storeUrl,
    message,
    supportEmail,
  } = input;

  const safeName = escapeHtml(customerName || "there");
  const safeTicket = escapeHtml(ticketLabel);
  const safeCategory = escapeHtml(category);
  const safeAppName = escapeHtml(appName);
  const safeSubject = escapeHtml(subject);
  const safeStoreUrl = escapeHtml(storeUrl);
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");
  const safeSupportEmail = escapeHtml(supportEmail);

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <div style="background:linear-gradient(180deg,#eff6ff 0%,#ffffff 100%);border:1px solid #dbeafe;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.08);">
        <div style="padding:28px 28px 12px 28px;">
          <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Boostle Support
          </div>

          <h1 style="margin:18px 0 12px 0;font-size:30px;line-height:1.05;letter-spacing:-0.04em;color:#0f172a;">
            We’ve received your request
          </h1>

          <p style="margin:0;font-size:16px;line-height:1.7;color:#334155;">
            Hi ${safeName}, thanks for contacting Boostle. Your support request has been logged and is now in our queue.
          </p>
        </div>

        <div style="padding:20px 28px 8px 28px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;">
            <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
              Ticket details
            </div>

            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;width:120px;">Ticket</td>
                <td style="padding:8px 0;font-size:14px;font-weight:700;color:#0f172a;">${safeTicket}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;">App</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${safeAppName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;">Category</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${safeCategory}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;">Subject</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${safeSubject}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#64748b;">Store</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${safeStoreUrl}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="padding:12px 28px 8px 28px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:18px;padding:18px;">
            <div style="font-size:13px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
              What happens next
            </div>

            <div style="font-size:15px;line-height:1.75;color:#1e293b;">
              We’ll review your request and reply as soon as possible. If you need to add more detail, just reply to
              <a href="mailto:${safeSupportEmail}" style="color:#2563eb;text-decoration:none;font-weight:700;"> ${safeSupportEmail}</a>.
            </div>
          </div>
        </div>

        <div style="padding:12px 28px 28px 28px;">
          <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
            Your message
          </div>

          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;font-size:15px;line-height:1.75;color:#334155;">
            ${safeMessage}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function getMissingColumnFromError(error: unknown): string | null {
  const maybeError = error as SupabaseLikeError | null | undefined;
  const message = maybeError?.message || "";
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

function isUndefinedColumnError(error: unknown, columnName: string): boolean {
  const maybeError = error as SupabaseLikeError | null | undefined;
  const message = maybeError?.message || "";
  const code = maybeError?.code || "";

  return (
    code === "42703" &&
    message.toLowerCase().includes(`column tickets.${columnName}`.toLowerCase())
  );
}

async function insertTicketWithSchemaFallback(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  values: Record<string, unknown>;
}) {
  const { supabase } = input;
  const values = { ...input.values };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("tickets")
      .insert(values)
      .select("id, public_thread_id")
      .single<CreatedTicketRow>();

    if (!error && data) {
      return { data, error: null };
    }

    const missingColumn = getMissingColumnFromError(error);

    if (!missingColumn || !(missingColumn in values)) {
      return { data: null, error };
    }

    console.warn(
      `tickets insert fallback: removing missing column "${missingColumn}" and retrying`,
    );

    delete values[missingColumn];
  }

  return {
    data: null,
    error: {
      message: "Too many schema fallback attempts while creating ticket.",
    } satisfies SupabaseLikeError,
  };
}

async function insertTicketMessageWithSchemaFallback(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  values: Record<string, unknown>;
}) {
  const { supabase } = input;
  const values = { ...input.values };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabase.from("ticket_messages").insert(values);

    if (!error) {
      return { error: null };
    }

    const missingColumn = getMissingColumnFromError(error);

    if (!missingColumn || !(missingColumn in values)) {
      return { error };
    }

    console.warn(
      `ticket_messages insert fallback: removing missing column "${missingColumn}" and retrying`,
    );

    delete values[missingColumn];
  }

  return {
    error: {
      message: "Too many schema fallback attempts while creating ticket message.",
    } satisfies SupabaseLikeError,
  };
}

async function tryReadTicketNumber(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  ticketId: string;
}) {
  const { supabase, ticketId } = input;

  const { data, error } = await supabase
    .from("tickets")
    .select("ticket_number")
    .eq("id", ticketId)
    .single<{ ticket_number?: number | null }>();

  if (error) {
    if (isUndefinedColumnError(error, "ticket_number")) {
      return null;
    }

    console.warn("Could not read ticket_number", error);
    return null;
  }

  return data?.ticket_number ?? null;
}

async function sendSupportNotificationEmail(input: {
  resend: Resend;
  to: string;
  from: string;
  replyTo: string;
  customerName: string;
  customerEmail: string;
  storeUrl: string;
  appName: string;
  subject: string;
  category: string;
  message: string;
  ticketLabel: string;
}) {
  const {
    resend,
    to,
    from,
    replyTo,
    customerName,
    customerEmail,
    storeUrl,
    appName,
    subject,
    category,
    message,
    ticketLabel,
  } = input;

  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

  await resend.emails.send({
    from,
    to,
    replyTo,
    subject: `[${ticketLabel}] ${subject}`,
    text: [
      "New Boostle support request",
      "",
      `Ticket: ${ticketLabel}`,
      `Name: ${customerName}`,
      `Email: ${customerEmail}`,
      `Store URL: ${storeUrl}`,
      `App: ${appName}`,
      `Category: ${category}`,
      `Subject: ${subject}`,
      "",
      "Message:",
      message,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;">
        <h2 style="margin:0 0 16px 0;">New Boostle support request</h2>
        <p><strong>Ticket:</strong> ${escapeHtml(ticketLabel)}</p>
        <p><strong>Name:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
        <p><strong>Store URL:</strong> ${escapeHtml(storeUrl)}</p>
        <p><strong>App:</strong> ${escapeHtml(appName)}</p>
        <p><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <div style="padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
          ${safeMessage}
        </div>
      </div>
    `,
  });
}

async function sendCustomerConfirmationEmail(input: {
  resend: Resend;
  to: string;
  from: string;
  replyTo: string;
  customerName: string;
  ticketLabel: string;
  category: string;
  appName: string;
  subject: string;
  storeUrl: string;
  message: string;
  supportEmail: string;
}) {
  const {
    resend,
    to,
    from,
    replyTo,
    customerName,
    ticketLabel,
    category,
    appName,
    subject,
    storeUrl,
    message,
    supportEmail,
  } = input;

  await resend.emails.send({
    from,
    to,
    replyTo,
    subject: `We received your Boostle support request (${ticketLabel})`,
    text: buildTicketSummaryText({
      ticketLabel,
      category,
      appName,
      subject,
      storeUrl,
      message,
      supportEmail,
    }),
    html: buildTicketSummaryHtml({
      customerName,
      ticketLabel,
      category,
      appName,
      subject,
      storeUrl,
      message,
      supportEmail,
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SupportRequestBody;

    const name = sanitizeText(body.name);
    const email = normalizeEmail(sanitizeText(body.email));
    const storeUrl = sanitizeText(body.storeUrl);
    const appName = sanitizeText(body.appName) || "Boostle";
    const subject = sanitizeText(body.subject);
    const category = sanitizeText(body.category) || "General";
    const message = sanitizeText(body.message);

    if (!name || !email || !storeUrl || !subject || !message) {
      return NextResponse.json<SupportApiResponse>(
        {
          ok: false,
          error: "Please complete all required fields.",
        },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json<SupportApiResponse>(
        {
          ok: false,
          error: "Please enter a valid email address.",
        },
        { status: 400 },
      );
    }

    if (!isValidHttpUrl(storeUrl)) {
      return NextResponse.json<SupportApiResponse>(
        {
          ok: false,
          error: "Please enter a valid Shopify store URL.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    let publicThreadId = generatePublicThreadId();

    for (let i = 0; i < 5; i += 1) {
      const { data: existingTicket, error: existingTicketError } = await supabase
        .from("tickets")
        .select("id")
        .eq("public_thread_id", publicThreadId)
        .maybeSingle();

      if (existingTicketError) {
        console.error("Failed checking public_thread_id uniqueness", existingTicketError);

        return NextResponse.json<SupportApiResponse>(
          {
            ok: false,
            error: "Failed creating support ticket.",
          },
          { status: 500 },
        );
      }

      if (!existingTicket) break;

      publicThreadId = generatePublicThreadId();
    }

    const ticketInsertValues: Record<string, unknown> = {
      public_thread_id: publicThreadId,
      customer_name: name,
      customer_email: email,
      store_url: storeUrl,
      app_name: appName,
      subject,
      category,
      status: "open",
      source: "web",
    };

    const { data: createdTicket, error: createTicketError } =
      await insertTicketWithSchemaFallback({
        supabase,
        values: ticketInsertValues,
      });

    if (createTicketError || !createdTicket) {
      console.error("Failed creating ticket", createTicketError);

      return NextResponse.json<SupportApiResponse>(
        {
          ok: false,
          error: "Failed creating support ticket.",
        },
        { status: 500 },
      );
    }

    const ticketMessageValues: Record<string, unknown> = {
      ticket_id: createdTicket.id,
      source: "web",
      sender_type: "customer",
      sender_name: name,
      sender_email: email,
      body_text: message,
      body_html: null,
    };

    const { error: createMessageError } = await insertTicketMessageWithSchemaFallback({
      supabase,
      values: ticketMessageValues,
    });

    if (createMessageError) {
      console.error("Failed creating ticket message", createMessageError);

      return NextResponse.json<SupportApiResponse>(
        {
          ok: false,
          error: "Ticket created, but failed saving the message body.",
        },
        { status: 500 },
      );
    }

    const ticketNumber = await tryReadTicketNumber({
      supabase,
      ticketId: createdTicket.id,
    });

    const resend = new Resend(getEnv("RESEND_API_KEY"));
    const supportEmail =
      getOptionalEnv("SUPPORT_EMAIL") ||
      getOptionalEnv("NEXT_PUBLIC_SUPPORT_EMAIL") ||
      "support@boostle.pro";

    const fromAddress = buildFromAddress(
      getOptionalEnv("SUPPORT_FROM_EMAIL"),
      supportEmail,
    );

    const ticketLabel = ticketNumber
      ? `Ticket #${ticketNumber}`
      : `Ticket ${createdTicket.public_thread_id || createdTicket.id}`;

    try {
      await sendSupportNotificationEmail({
        resend,
        to: supportEmail,
        from: fromAddress,
        replyTo: email,
        customerName: name,
        customerEmail: email,
        storeUrl,
        appName,
        subject,
        category,
        message,
        ticketLabel,
      });
    } catch (error) {
      console.error("Failed sending internal support notification", error);
    }

    try {
      await sendCustomerConfirmationEmail({
        resend,
        to: email,
        from: fromAddress,
        replyTo: supportEmail,
        customerName: name,
        ticketLabel,
        category,
        appName,
        subject,
        storeUrl,
        message,
        supportEmail,
      });
    } catch (error) {
      console.error("Failed sending customer confirmation email", error);
    }

    return NextResponse.json<SupportApiResponse>({
      ok: true,
      ticketId: createdTicket.id,
      ticketNumber,
    });
  } catch (error) {
    console.error("Support route error", error);

    return NextResponse.json<SupportApiResponse>(
      {
        ok: false,
        error: "Something went wrong while submitting your request.",
      },
      { status: 500 },
    );
  }
}