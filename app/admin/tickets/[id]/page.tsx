// UPDATED VERSION WITH FULL CONVERSATION TIMELINE

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  sendTicketReplyAction,
  updateTicketStatusAction,
} from "./actions";

type TicketStatus = "open" | "in_progress" | "closed";

type Ticket = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
};

type AdminReply = {
  id: string;
  ticket_id: string;
  body: string;
  sent_to: string;
  sent_by: string;
  created_at: string;
};

type CustomerMessage = {
  id: string;
  ticket_id: string;
  body_text: string;
  sender_email: string;
  sender_name: string | null;
  created_at: string;
};

type TimelineItem =
  | ({ type: "customer" } & CustomerMessage)
  | ({ type: "admin" } & AdminReply);

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Ticket
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();

  // Admin replies
  const { data: adminReplies } = await supabase
    .from("support_ticket_replies")
    .select("*")
    .eq("ticket_id", id);

  // Customer replies (inbound)
  const { data: customerMessages } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .eq("direction", "inbound");

  // Merge timeline
  const timeline: TimelineItem[] = [
    ...(customerMessages || []).map((m) => ({
      ...m,
      type: "customer" as const,
    })),
    ...(adminReplies || []).map((r) => ({
      ...r,
      type: "admin" as const,
    })),
  ].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );

  return (
    <main style={{ padding: 24 }}>
      <h1>{ticket.subject}</h1>

      <p>
        From {ticket.name} · {ticket.email}
      </p>

      <hr style={{ margin: "20px 0" }} />

      {/* TIMELINE */}
      <h2>Conversation</h2>

      <div style={{ display: "grid", gap: 12 }}>
        {timeline.map((item) => {
          if (item.type === "customer") {
            return (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "#f1f5f9",
                }}
              >
                <strong>Customer</strong>
                <div>{item.body_text || "(No content yet)"}</div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              style={{
                padding: 16,
                borderRadius: 12,
                background: "#e0e7ff",
              }}
            >
              <strong>Support</strong>
              <div>{item.body}</div>
            </div>
          );
        })}
      </div>

      <hr style={{ margin: "20px 0" }} />

      {/* Reply form */}
      <form action={sendTicketReplyAction}>
        <input type="hidden" name="ticketId" value={ticket.id} />
        <input type="hidden" name="toEmail" value={ticket.email} />
        <input type="hidden" name="subject" value={ticket.subject} />

        <textarea
          name="replyBody"
          required
          placeholder="Write reply..."
          style={{ width: "100%", minHeight: 120 }}
        />

        <button type="submit">Send reply</button>
      </form>
    </main>
  );
}