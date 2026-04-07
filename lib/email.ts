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

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error("Missing RESEND_API_KEY environment variable.");
}

const resend = new Resend(resendApiKey);

const supportToEmail = process.env.SUPPORT_TO_EMAIL || "support@boostle.pro";
const supportFromEmail =
  process.env.SUPPORT_FROM_EMAIL || "Boostle Support <support@boostle.pro>";
const autoReplyFromEmail =
  process.env.SUPPORT_AUTO_REPLY_FROM_EMAIL ||
  "Boostle Support <support@boostle.pro>";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendSupportNotificationEmail(
  payload: SupportRequestPayload,
) {
  const safe = {
    name: escapeHtml(payload.name),
    email: escapeHtml(payload.email),
    storeUrl: escapeHtml(payload.storeUrl),
    appName: escapeHtml(payload.appName),
    subject: escapeHtml(payload.subject),
    category: escapeHtml(payload.category),
    message: escapeHtml(payload.message).replaceAll("\n", "<br />"),
  };

  return resend.emails.send({
    from: supportFromEmail,
    to: supportToEmail,
    replyTo: payload.email,
    subject: `New support request: ${payload.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #122033; line-height: 1.6;">
        <h2 style="margin-bottom: 16px;">New Boostle support request</h2>

        <p><strong>Name:</strong> ${safe.name}</p>
        <p><strong>Email:</strong> ${safe.email}</p>
        <p><strong>Store URL:</strong> ${safe.storeUrl}</p>
        <p><strong>App:</strong> ${safe.appName}</p>
        <p><strong>Category:</strong> ${safe.category}</p>
        <p><strong>Subject:</strong> ${safe.subject}</p>

        <div style="margin-top: 20px;">
          <strong>Message:</strong>
          <div style="margin-top: 8px; padding: 16px; border: 1px solid #dbe4f0; border-radius: 12px; background: #f8fbff;">
            ${safe.message}
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendSupportAutoReplyEmail(
  payload: SupportRequestPayload,
) {
  const safeName = escapeHtml(payload.name);
  const safeSubject = escapeHtml(payload.subject);

  return resend.emails.send({
    from: autoReplyFromEmail,
    to: payload.email,
    subject: `We received your support request: ${payload.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #122033; line-height: 1.6;">
        <h2 style="margin-bottom: 16px;">Thanks for contacting Boostle Support</h2>

        <p>Hi ${safeName},</p>

        <p>
          We’ve received your support request and will get back to you by email as soon as possible.
        </p>

        <p><strong>Your subject:</strong> ${safeSubject}</p>

        <p>
          If you need to add more details, just reply to this email and we’ll keep everything together.
        </p>

        <p>Thanks,<br />Boostle Support</p>
      </div>
    `,
  });
}