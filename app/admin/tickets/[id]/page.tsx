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

type TicketReply = {
  id: string;
  ticket_id: string;
  body: string;
  sent_to: string;
  sent_by: string;
  created_at: string;
};

type TimelineItem = {
  id: string;
  type: "customer" | "admin";
  body: string;
  created_at: string;
  authorLabel: string;
  metaLabel: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getStatusStyle(status: TicketStatus) {
  if (status === "open") {
    return { background: "#dcfce7", color: "#15803d" };
  }

  if (status === "in_progress") {
    return { background: "#fef3c7", color: "#b45309" };
  }

  return { background: "#e2e8f0", color: "#475569" };
}

function getStatusLabel(status: TicketStatus) {
  if (status === "in_progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, name, email, subject, message, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  if (!ticket) {
    notFound();
  }

  const repliesResult = await supabase
    .from("support_ticket_replies")
    .select("id, ticket_id, body, sent_to, sent_by, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const replies =
    repliesResult.error == null
      ? ((repliesResult.data ?? []) as TicketReply[])
      : [];

  const typedTicket = ticket as Ticket;
  const returnTo = `/admin/tickets/${typedTicket.id}`;

  const customerTimelineItem: TimelineItem = {
    id: `customer-${typedTicket.id}`,
    type: "customer",
    body: typedTicket.message,
    created_at: typedTicket.created_at,
    authorLabel: `${typedTicket.name} (${typedTicket.email})`,
    metaLabel: "Customer message",
  };

  const replyTimelineItems: TimelineItem[] = replies.map((reply) => ({
    id: reply.id,
    type: "admin" as const,
    body: reply.body,
    created_at: reply.created_at,
    authorLabel: reply.sent_by,
    metaLabel: `Reply sent to ${reply.sent_to}`,
  }));

  const timeline: TimelineItem[] = [
    customerTimelineItem,
    ...replyTimelineItems,
  ].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime(),
  );

  return (
    <main className="page-shell">
      <div className="container" style={{ display: "grid", gap: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 13,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#2563eb",
                margin: 0,
              }}
            >
              Boostle Support
            </p>

            <h1 style={{ margin: 0, fontSize: 34 }}>Ticket Detail</h1>
          </div>

          <Link
            href="/admin"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "#eef4ff",
              color: "#2563eb",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Back to dashboard
          </Link>
        </div>

        <section className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 28,
                    lineHeight: 1.15,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {typedTicket.subject}
                </h2>

                <span
                  style={{
                    ...getStatusStyle(typedTicket.status),
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {getStatusLabel(typedTicket.status)}
                </span>
              </div>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "#58677a",
                }}
              >
                From {typedTicket.name} · {typedTicket.email}
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#58677a",
                  fontSize: 14,
                }}
              >
                Submitted {new Date(typedTicket.created_at).toLocaleString()}
              </p>
            </div>

            <form action={updateTicketStatusAction}>
              <input type="hidden" name="ticketId" value={typedTicket.id} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <select
                  name="status"
                  defaultValue={typedTicket.status}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                  }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option>
                </select>

                <button
                  type="submit"
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Update status
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <h2>Reply to customer</h2>

          <form action={sendTicketReplyAction}>
            <input type="hidden" name="ticketId" value={typedTicket.id} />
            <input type="hidden" name="toEmail" value={typedTicket.email} />
            <input type="hidden" name="subject" value={typedTicket.subject} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <textarea
              name="replyBody"
              placeholder="Write reply..."
              required
              style={{
                width: "100%",
                minHeight: 120,
                marginTop: 10,
                padding: 10,
              }}
            />

            <button
              type="submit"
              style={{
                marginTop: 10,
                background: "#2563eb",
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
              }}
            >
              Send reply
            </button>
          </form>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <h2>Ticket history</h2>

          {timeline.map((item) => (
            <div
              key={item.id}
              style={{
                marginTop: 12,
                padding: 16,
                borderRadius: 12,
                background:
                  item.type === "customer" ? "#f8fafc" : "#eef4ff",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700 }}>
                {item.metaLabel}
              </p>

              <p style={{ fontSize: 13 }}>{item.authorLabel}</p>

              <p style={{ marginTop: 8 }}>{item.body}</p>

              <p style={{ fontSize: 12, color: "#58677a" }}>
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}