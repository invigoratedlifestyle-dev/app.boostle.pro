import { Resend } from "resend";

export type SupportRequestPayload = {
  name: string;
  email: string;
  storeUrl: string;
  appName: string;
  subject: string;
  category: string;
  message: string;
};

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

const supportToEmail = process.env.SUPPORT_TO_EMAIL || "support@boostle.pro";
const supportFromEmail =
  process.env.SUPPORT_FROM_EMAIL || "Boostle <support@boostle.pro>";
const autoReplyFromEmail =
  process.env.SUPPORT_AUTO_REPLY_FROM_EMAIL ||
  "Boostle <support@boostle.pro>";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendSupportNotificationEmail(
  payload: SupportRequestPayload,
) {
  const resend = getResend();

  return resend.emails.send({
    from: supportFromEmail,
    to: supportToEmail,
    replyTo: payload.email,
    subject: `Support: ${payload.subject}`,
    html: `
      <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>Store:</strong> ${escapeHtml(payload.storeUrl)}</p>
      <p><strong>App:</strong> ${escapeHtml(payload.appName)}</p>
      <p><strong>Category:</strong> ${escapeHtml(payload.category)}</p>
      <p><strong>Message:</strong><br>${escapeHtml(payload.message)}</p>
    `,
  });
}

export async function sendSupportAutoReplyEmail(
  payload: SupportRequestPayload,
) {
  const resend = getResend();

  return resend.emails.send({
    from: autoReplyFromEmail,
    to: payload.email,
    subject: `We received your request`,
    html: `
      <p>Hi ${escapeHtml(payload.name)},</p>
      <p>We’ve received your support request and will reply shortly.</p>
      <p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
    `,
  });
}