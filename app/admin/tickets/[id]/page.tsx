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

type TicketMessage = {
  id: string;
  ticket_id: string;
  direction: "inbound" | "outbound";
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
      body: string | null;
      sender_email: string;
      sender_name: string | null;
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
    return {
      background: "#dcfce7",
      color: "#15803d",
      border: "1px solid #86efac",
    };
  }

  if (status === "in_progress") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  return {
    background: "#e2e8f0",
    color: "#475569",
    border: "1px solid #cbd5e1",
  };
}

function getStatusLabel(status: TicketStatus) {
  if (status === "in_progress") {
    return "In progress";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getInitials(name: string | null | undefined, email: string) {
  const safeName = (name ?? "").trim();

  if (safeName) {
    const parts = safeName.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return email.slice(0, 2).toUpperCase();
}

function cleanQuotedReply(text: string | null | undefined) {
  if (!text) return "";

  const normalized = text.replace(/\r\n/g, "\n").trim();

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

  return cleanLines.join("\n").trim();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMessageMeta(item: ConversationItem) {
  if (item.type === "admin_reply") {
    return {
      label: "Agent reply",
      chipText: "Outbound email",
      chipStyle: {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      },
      rowStyle: {
        background: "#f8fbff",
        border: "1px solid #d9e8ff",
      },
      avatarStyle: {
        background: "#2563eb",
        color: "#ffffff",
        border: "1px solid #2563eb",
      },
    };
  }

  return {
    label: "Customer reply",
    chipText: "Inbound email",
    chipStyle: {
      background: "#ecfeff",
      color: "#0f766e",
      border: "1px solid #a5f3fc",
    },
    rowStyle: {
      background: "#ffffff",
      border: "1px solid #e2e8f0",
    },
    avatarStyle: {
      background: "#f8fafc",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
    },
  };
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

  const messagesResult = await supabase
    .from("ticket_messages")
    .select(
      "id, ticket_id, direction, sender_name, sender_email, body_text, created_at",
    )
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message);
  }

  const messages = (messagesResult.data ?? []) as TicketMessage[];

  const conversation: ConversationItem[] = messages.map((message) => {
    if (message.direction === "outbound") {
      return {
        id: message.id,
        type: "admin_reply" as const,
        created_at: message.created_at,
        body: message.body_text,
        sender_email: message.sender_email,
        sender_name: message.sender_name,
      };
    }

    return {
      id: message.id,
      type: "customer_reply" as const,
      created_at: message.created_at,
      body: cleanQuotedReply(message.body_text),
      sender_name: message.sender_name,
      sender_email: message.sender_email,
    };
  });

  const typedTicket = ticket as Ticket;
  const returnTo = `/admin/tickets/${typedTicket.id}`;
  const statusStyle = getStatusStyle(typedTicket.status);
  const originalMessageBody = cleanQuotedReply(typedTicket.message);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f6fa",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          padding: "28px 24px 40px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1440,
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 800,
                    color: "#2563eb",
                  }}
                >
                  Boostle Support
                </p>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #dbe4f0",
                  }}
                >
                  Ticket #{typedTicket.id.slice(0, 8)}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {typedTicket.subject}
                </h1>

                <span
                  style={{
                    ...statusStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStatusLabel(typedTicket.status)}
                </span>
              </div>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                {typedTicket.name} · {typedTicket.email} · Submitted{" "}
                {formatDateTime(typedTicket.created_at)}
              </p>
            </div>

            <Link
              href="/admin"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                textDecoration: "none",
                border: "1px solid #dbe4f0",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
              }}
            >
              Back to dashboard
            </Link>
          </div>

          {replySent ? (
            <div
              style={{
                borderRadius: 12,
                padding: "12px 14px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Reply sent successfully and added to ticket history.
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.9fr) minmax(320px, 0.9fr)",
              gap: 18,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              <section
                style={{
                  background: "#ffffff",
                  border: "1px solid #dbe4f0",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    padding: "12px 14px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #dbe4f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      Conversation
                    </h2>

                    <span
                      style={{
                        display: "inline-grid",
                        placeItems: "center",
                        minWidth: 22,
                        height: 22,
                        padding: "0 7px",
                        borderRadius: 999,
                        background: "#ffffff",
                        border: "1px solid #dbe4f0",
                        color: "#64748b",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {conversation.length + 1}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                    }}
                  >
                    Ticket timeline
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 14,
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px minmax(0, 1fr)",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        fontSize: 13,
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {getInitials(typedTicket.name, typedTicket.email)}
                    </div>

                    <article
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 800,
                                color: "#0f172a",
                              }}
                            >
                              {typedTicket.name}
                            </p>

                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                background: "#ecfeff",
                                color: "#0f766e",
                                border: "1px solid #a5f3fc",
                              }}
                            >
                              Original request
                            </span>
                          </div>

                          <p
                            style={{
                              margin: "5px 0 0",
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            {typedTicket.email}
                          </p>
                        </div>

                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: "#64748b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDateTime(typedTicket.created_at)}
                        </p>
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.7,
                          color: "#122033",
                          fontSize: 14,
                        }}
                      >
                        {originalMessageBody || "(No message body captured)"}
                      </div>
                    </article>
                  </div>

                  {conversation.length === 0 ? (
                    <div
                      style={{
                        padding: "16px 14px",
                        borderRadius: 12,
                        background: "#ffffff",
                        border: "1px dashed #cbd5e1",
                        color: "#64748b",
                        fontSize: 14,
                      }}
                    >
                      No replies yet.
                    </div>
                  ) : (
                    conversation.map((item) => {
                      const meta = getMessageMeta(item);
                      const displayName =
                        item.sender_name?.trim() || item.sender_email;

                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "44px minmax(0, 1fr)",
                            gap: 12,
                            alignItems: "start",
                          }}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 800,
                              fontSize: 13,
                              ...meta.avatarStyle,
                            }}
                          >
                            {getInitials(item.sender_name, item.sender_email)}
                          </div>

                          <article
                            style={{
                              ...meta.rowStyle,
                              borderRadius: 12,
                              padding: 14,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 12,
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 14,
                                      fontWeight: 800,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {displayName}
                                  </p>

                                  <span
                                    style={{
                                      ...meta.chipStyle,
                                      padding: "4px 8px",
                                      borderRadius: 999,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {meta.chipText}
                                  </span>
                                </div>

                                <p
                                  style={{
                                    margin: "5px 0 0",
                                    fontSize: 12,
                                    color: "#64748b",
                                  }}
                                >
                                  {meta.label} · {item.sender_email}
                                </p>
                              </div>

                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: "#64748b",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatDateTime(item.created_at)}
                              </p>
                            </div>

                            <div
                              style={{
                                marginTop: 12,
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.7,
                                color: "#122033",
                                fontSize: 14,
                              }}
                            >
                              {item.body?.trim()
                                ? item.body
                                : "(No message body captured)"}
                            </div>
                          </article>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section
                style={{
                  background: "#ffffff",
                  border: "1px solid #dbe4f0",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "12px 14px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #dbe4f0",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    Reply to customer
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Public reply
                    </span>

                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "#64748b",
                        border: "1px solid #dbe4f0",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Email channel
                    </span>
                  </div>
                </div>

                <form
                  action={sendTicketReplyAction}
                  style={{ display: "grid", gap: 0 }}
                >
                  <input type="hidden" name="ticketId" value={typedTicket.id} />

                  <div style={{ padding: 14 }}>
                    <label
                      htmlFor="replyBody"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#122033",
                      }}
                    >
                      Message
                    </label>

                    <textarea
                      id="replyBody"
                      name="replyBody"
                      placeholder="Write your reply to the customer..."
                      required
                      style={{
                        width: "100%",
                        minHeight: 120,
                        resize: "vertical",
                        border: "1px solid #dbe4f0",
                        background: "#ffffff",
                        color: "#122033",
                        borderRadius: 12,
                        padding: "12px 14px",
                        outline: "none",
                        boxSizing: "border-box",
                        font: "inherit",
                        fontSize: 14,
                        lineHeight: 1.65,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderTop: "1px solid #eef2f7",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      background: "#ffffff",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      Sends an email reply and moves this ticket to In progress.
                    </p>

                    <button
                      type="submit"
                      style={{
                        appearance: "none",
                        border: 0,
                        cursor: "pointer",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontWeight: 800,
                        background: "#0f172a",
                        color: "#ffffff",
                        font: "inherit",
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                      }}
                    >
                      Send reply
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <aside style={{ display: "grid", gap: 18 }}>
              <section
                style={{
                  background: "#ffffff",
                  border: "1px solid #dbe4f0",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
                  position: "sticky",
                  top: 24,
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #dbe4f0",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    Ticket details
                  </h2>
                </div>

                <div style={{ padding: 14, display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#64748b",
                        }}
                      >
                        Requester
                      </p>

                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {typedTicket.name}
                      </p>

                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#475569",
                          fontSize: 13,
                          wordBreak: "break-word",
                        }}
                      >
                        {typedTicket.email}
                      </p>
                    </div>

                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#64748b",
                        }}
                      >
                        Ticket ID
                      </p>

                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: 13,
                          wordBreak: "break-all",
                        }}
                      >
                        {typedTicket.id}
                      </p>
                    </div>

                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#64748b",
                        }}
                      >
                        Created
                      </p>

                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {formatDateTime(typedTicket.created_at)}
                      </p>
                    </div>
                  </div>

                  <form action={updateTicketStatusAction}>
                    <input type="hidden" name="ticketId" value={typedTicket.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />

                    <div style={{ display: "grid", gap: 10 }}>
                      <label
                        htmlFor="status"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#122033",
                        }}
                      >
                        Status
                      </label>

                      <select
                        id="status"
                        name="status"
                        defaultValue={typedTicket.status}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 10,
                          border: "1px solid #dbe4f0",
                          background: "#fff",
                          color: "#122033",
                          font: "inherit",
                          fontSize: 14,
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
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 800,
                          background: "#0f172a",
                          color: "#ffffff",
                          font: "inherit",
                          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                        }}
                      >
                        Update status
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          main div[style*="grid-template-columns: minmax(0, 1.9fr) minmax(320px, 0.9fr)"] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          textarea {
            min-height: 100px !important;
          }
        }
      `}</style>
    </main>
  );
}