import { NextResponse } from "next/server";
import {
  sendSupportAutoReplyEmail,
  sendSupportNotificationEmail,
  type SupportRequestPayload,
} from "@/lib/email";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function normalisePayload(body: unknown): SupportRequestPayload | null {
  if (!body || typeof body !== "object") return null;

  const data = body as Record<string, unknown>;

  const payload: SupportRequestPayload = {
    name: String(data.name || "").trim(),
    email: String(data.email || "").trim(),
    storeUrl: String(data.storeUrl || "").trim(),
    appName: String(data.appName || "").trim(),
    subject: String(data.subject || "").trim(),
    category: String(data.category || "").trim(),
    message: String(data.message || "").trim(),
  };

  return payload;
}

function generateTicketId() {
  const date = new Date();

  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `BST-${year}${month}${day}-${random}`;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const requiredFields: Array<keyof SupportRequestPayload> = [
      "name",
      "email",
      "storeUrl",
      "appName",
      "subject",
      "category",
      "message",
    ];

    for (const field of requiredFields) {
      if (!payload[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    if (!isValidEmail(payload.email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (!isValidUrl(payload.storeUrl)) {
      return NextResponse.json(
        { error: "Please enter a valid Shopify store URL." },
        { status: 400 },
      );
    }

    const ticketId = generateTicketId();

    const emailPayload: SupportRequestPayload = {
      ...payload,
      subject: `[${ticketId}] ${payload.subject}`,
      message: `Ticket ID: ${ticketId}\n\n${payload.message}`,
    };

    console.log("New support ticket created:", {
      ticketId,
      name: payload.name,
      email: payload.email,
      storeUrl: payload.storeUrl,
      appName: payload.appName,
      category: payload.category,
      subject: payload.subject,
    });

    await sendSupportNotificationEmail(emailPayload);
    await sendSupportAutoReplyEmail(emailPayload);

    return NextResponse.json({
      ok: true,
      ticketId,
    });
  } catch (error) {
    console.error("Support form submission failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn’t submit your request right now. Please try again or email support@boostle.pro.",
      },
      { status: 500 },
    );
  }
}