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
    return {
      background: "#dcfce7",
      color: "#15803d",
    };
  }

  if (status === "in_progress") {
    return {
      background: "#fef3c7",
      color: "#b45309",
    };
  }

  return {
    background: "#e2e8f0",
    color: "#475569",
  };
}

function getStatusLabel(status: TicketStatus) {
  if (status === "in_progress") {
    return "In progress";
  }

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

  return (
    <main className="page-shell">
      <div className="container" style={{ display: "grid", gap: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
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
                margin: "0 0 6px",
              }}
            >
              Boostle Support
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 34,
                letterSpacing: "-0.03em",
              }}
            >
              Ticket Detail
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        </div>

        <section
          className="card"
          style={{
            padding: 24,
            display: "grid",
            gap: 20,
          }}
        >
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
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #dbe4f0",
                    background: "#fff",
                    color: "#122033",
                  }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option>
                </select>

                <button
                  type="submit"
                  className="button button-primary"
                >
                  Update status
                </button>
              </div>
            </form>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontWeight: 700,
              }}
            >
              Customer message
            </p>

            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.7,
                color: "#122033",
              }}
            >
              {typedTicket.message}
            </div>
          </div>
        </section>

        <section
          className="card"
          style={{
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                letterSpacing: "-0.02em",
              }}
            >
              Reply to customer
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#58677a",
              }}
            >
              This sends an email reply to the customer and moves the ticket to
              In progress.
            </p>
          </div>

          <form
            action={sendTicketReplyAction}
            style={{ display: "grid", gap: 16 }}
          >
            <input type="hidden" name="ticketId" value={typedTicket.id} />
            <input type="hidden" name="toEmail" value={typedTicket.email} />
            <input type="hidden" name="subject" value={typedTicket.subject} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="field">
              <label className="label" htmlFor="replyBody">
                Reply message
              </label>

              <textarea
                id="replyBody"
                name="replyBody"
                className="textarea"
                placeholder="Write your reply to the customer..."
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="button button-primary">
                Send reply
              </button>
            </div>
          </form>
        </section>

        <section
          className="card"
          style={{
            padding: 24,
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                letterSpacing: "-0.02em",
              }}
            >
              Reply history
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#58677a",
              }}
            >
              Sent replies recorded against this ticket.
            </p>
          </div>

          {replies.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#58677a",
              }}
            >
              No replies yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#58677a",
                    }}
                  >
                    Sent {new Date(reply.created_at).toLocaleString()} · To{" "}
                    {reply.sent_to}
                  </p>

                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      color: "#58677a",
                    }}
                  >
                    From {reply.sent_by}
                  </p>

                  <div
                    style={{
                      marginTop: 12,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.7,
                      color: "#122033",
                    }}
                  >
                    {reply.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}