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

type InboundTicketMessage = {
  id: string;
  ticket_id: string;
  direction: "inbound";
  sender_name: string | null;
  sender_email: string;
  body_text: string | null;
  created_at: string;
};

type ConversationItem =
  | {
      id: string;
      type: "admin_reply";
      created_at: string;
      body: string;
      sent_to: string;
      sent_by: string;
    }
  | {
      id: string;
      type: "customer_reply";
      created_at: string;
      body: string | null;
      sender_name: string | null;
      sender_email: string;
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
  if (status === "in_progress") {
    return "In progress";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function cleanQuotedReply(text: string | null | undefined) {
  if (!text) return "";

  const normalized = text.replace(/\r\n/g, "\n");

  const patterns = [
    /\nOn .* wrote:/i,
    /\nFrom: .*/i,
    /\nSent: .*/i,
    /\nTo: .*/i,
    /\nSubject: .*/i,
    /\n---+.*/i,
  ];

  let trimmed = normalized;

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match && typeof match.index === "number") {
      trimmed = trimmed.slice(0, match.index);
    }
  }

  const lines = trimmed.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    const currentLine = line.trim();

    if (currentLine.startsWith(">") || currentLine.startsWith("|")) {
      continue;
    }

    cleanLines.push(line);
  }

  return cleanLines.join("\n").trim();
}

export default async function AdminTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const replySent = resolvedSearchParams.sent === "1";

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

  if (repliesResult.error) {
    throw new Error(repliesResult.error.message);
  }

  const inboundMessagesResult = await supabase
    .from("ticket_messages")
    .select("id, ticket_id, direction, sender_name, sender_email, body_text, created_at")
    .eq("ticket_id", id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: true });

  if (inboundMessagesResult.error) {
    throw new Error(inboundMessagesResult.error.message);
  }

  const replies = (repliesResult.data ?? []) as TicketReply[];
  const inboundMessages = (inboundMessagesResult.data ?? []) as InboundTicketMessage[];

  const conversation: ConversationItem[] = [
    ...replies.map((reply) => ({
      id: reply.id,
      type: "admin_reply" as const,
      created_at: reply.created_at,
      body: reply.body,
      sent_to: reply.sent_to,
      sent_by: reply.sent_by,
    })),
    ...inboundMessages.map((message) => ({
      id: message.id,
      type: "customer_reply" as const,
      created_at: message.created_at,
      body: cleanQuotedReply(message.body_text),
      sender_name: message.sender_name,
      sender_email: message.sender_email,
    })),
  ].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

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

        {replySent ? (
          <div
            className="card"
            style={{
              padding: 16,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
            }}
          >
            Reply sent successfully and added to ticket history.
          </div>
        ) : null}

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
                    font: "inherit",
                  }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option>
                </select>

                <button
                  type="submit"
                  style={{
                    appearance: "none",
                    border: 0,
                    cursor: "pointer",
                    borderRadius: 12,
                    padding: "12px 16px",
                    fontWeight: 700,
                    background: "#2563eb",
                    color: "#ffffff",
                    font: "inherit",
                  }}
                >
                  Update status
                </button>
              </div>
            </form>
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
              Customer message
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#58677a",
              }}
            >
              Original ticket message from the customer.
            </p>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
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
              This sends an email reply to the customer and moves the ticket to In
              progress.
            </p>
          </div>

          <form
            action={sendTicketReplyAction}
            style={{ display: "grid", gap: 16 }}
          >
            <input type="hidden" name="ticketId" value={typedTicket.id} />
            <input type="hidden" name="toEmail" value={typedTicket.email} />
            <input type="hidden" name="subject" value={typedTicket.subject} />

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              <label
                htmlFor="replyBody"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#122033",
                }}
              >
                Reply message
              </label>

              <textarea
                id="replyBody"
                name="replyBody"
                placeholder="Write your reply to the customer..."
                required
                style={{
                  width: "100%",
                  minHeight: 150,
                  resize: "vertical",
                  border: "1px solid #dbe4f0",
                  background: "#ffffff",
                  color: "#122033",
                  borderRadius: 12,
                  padding: "14px 14px",
                  outline: "none",
                  boxSizing: "border-box",
                  font: "inherit",
                  lineHeight: 1.6,
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="submit"
                style={{
                  appearance: "none",
                  border: 0,
                  cursor: "pointer",
                  borderRadius: 12,
                  padding: "14px 18px",
                  fontWeight: 700,
                  background: "#2563eb",
                  color: "#ffffff",
                  font: "inherit",
                }}
              >
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
              Ticket history
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#58677a",
              }}
            >
              Replies sent to and received for this ticket.
            </p>
          </div>

          {conversation.length === 0 ? (
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
              {conversation.map((item) =>
                item.type === "admin_reply" ? (
                  <div
                    key={`admin-${item.id}`}
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      background: "#eef4ff",
                      border: "1px solid #dbe4f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#122033",
                          }}
                        >
                          Reply sent to {item.sent_to}
                        </p>

                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 13,
                            color: "#58677a",
                          }}
                        >
                          From {item.sent_by}
                        </p>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#58677a",
                        }}
                      >
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.7,
                        color: "#122033",
                      }}
                    >
                      {item.body}
                    </div>
                  </div>
                ) : (
                  <div
                    key={`customer-${item.id}`}
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#122033",
                          }}
                        >
                          Reply received from{" "}
                          {item.sender_name
                            ? `${item.sender_name} (${item.sender_email})`
                            : item.sender_email}
                        </p>

                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 13,
                            color: "#58677a",
                          }}
                        >
                          Customer reply
                        </p>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#58677a",
                        }}
                      >
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.7,
                        color: "#122033",
                      }}
                    >
                      {item.body?.trim() ? item.body : "(No message body captured)"}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}