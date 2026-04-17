import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  sendTicketReplyAction,
  updateTicketStatusAction,
} from "../../../admin/tickets/[id]/actions";
import { revalidatePath } from "next/cache";

type TicketStatus = "open" | "in_progress" | "closed";

type Ticket = {
  id: string;
  ticket_number?: number | null;
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

type TicketNote = {
  id: string;
  ticket_id: string;
  body: string;
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

function getTabHref(
  ticketId: string,
  tab: "conversation" | "notes",
  replySent: boolean,
) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", tab);

  if (replySent) {
    searchParams.set("sent", "1");
  }

  return `/dashboard/tickets/${ticketId}?${searchParams.toString()}`;
}

function getTabStyle(isActive: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    border: isActive ? "1px solid #bfdbfe" : "1px solid #dbe4f0",
    background: isActive ? "#eff6ff" : "#ffffff",
    color: isActive ? "#1d4ed8" : "#475569",
    boxShadow: isActive
      ? "0 6px 14px rgba(37, 99, 235, 0.08)"
      : "0 4px 12px rgba(15, 23, 42, 0.04)",
  } as const;
}

function parseOriginalRequestDetails(message: string) {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let summary = "";
  const details: Array<{ label: string; value: string }> = [];
  const extraLines: string[] = [];

  for (const line of lines) {
    const colonIndex = line.indexOf(":");

    if (colonIndex > 0) {
      const label = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (label && value) {
        details.push({ label, value });
        continue;
      }
    }

    if (!summary) {
      summary = line;
    } else {
      extraLines.push(line);
    }
  }

  return {
    summary,
    details,
    extraText: extraLines.join("\n").trim(),
  };
}

export default async function AdminTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sent?: string; tab?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const replySent = resolvedSearchParams.sent === "1";
  const activeTab =
    resolvedSearchParams.tab === "notes" ? "notes" : "conversation";

  const supabase = getSupabaseAdmin();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select(
      `
        id,
        ticket_number,
        name,
        email,
        subject,
        message,
        status,
        created_at
      `,
    )
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

  const notesResult = await supabase
    .from("support_ticket_notes")
    .select("id, ticket_id, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false });

  if (notesResult.error) {
    throw new Error(notesResult.error.message);
  }

  const messages = (messagesResult.data ?? []) as TicketMessage[];
  const notes = (notesResult.data ?? []) as TicketNote[];

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

  async function addTicketNoteAction(formData: FormData) {
    "use server";

    const body = String(formData.get("body") ?? "").trim();

    if (!body) {
      throw new Error("Note cannot be empty.");
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("support_ticket_notes").insert({
      ticket_id: id,
      body,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/tickets/${id}`);
    redirect(`/dashboard/tickets/${id}?tab=notes`);
  }

  const typedTicket = ticket as Ticket;
  const returnTo = `/dashboard/tickets/${typedTicket.id}`;
  const statusStyle = getStatusStyle(typedTicket.status);
  const originalMessageBody = cleanQuotedReply(typedTicket.message);
  const originalRequest = parseOriginalRequestDetails(originalMessageBody);

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
                  Ticket #
                  {typedTicket.ticket_number ?? typedTicket.id.slice(0, 8)}
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
              href="/dashboard"
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
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={getTabHref(typedTicket.id, "conversation", replySent)}
              style={getTabStyle(activeTab === "conversation")}
            >
              Conversation
            </Link>

            <Link
              href={getTabHref(typedTicket.id, "notes", replySent)}
              style={getTabStyle(activeTab === "notes")}
            >
              Notes
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.9fr) minmax(320px, 0.9fr)",
              gap: 18,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              {activeTab === "conversation" ? (
                <>
                  <section
                    style={{
                      background:
                        "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
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
                          Initial ticket details
                        </h2>

                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          Original submission
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        Submitted {formatDateTime(typedTicket.created_at)}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: 16,
                        display: "grid",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "56px minmax(0, 1fr)",
                          gap: 14,
                          alignItems: "start",
                        }}
                      >
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background:
                              "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
                            color: "#1d4ed8",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: 16,
                            border: "1px solid #bfdbfe",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
                          }}
                        >
                          {getInitials(typedTicket.name, typedTicket.email)}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: 18,
                                fontWeight: 800,
                                color: "#0f172a",
                              }}
                            >
                              {typedTicket.subject}
                            </h3>

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
                              Customer request
                            </span>
                          </div>

                          <p
                            style={{
                              margin: "8px 0 0",
                              color: "#64748b",
                              fontSize: 13,
                            }}
                          >
                            Submitted by {typedTicket.name} · {typedTicket.email}
                          </p>
                        </div>
                      </div>

                      {originalRequest.summary ? (
                        <div
                          style={{
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#122033",
                            fontSize: 14,
                            lineHeight: 1.7,
                            fontWeight: 600,
                          }}
                        >
                          {originalRequest.summary}
                        </div>
                      ) : null}

                      {originalRequest.details.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 12,
                          }}
                        >
                          {originalRequest.details.map((detail) => (
                            <div
                              key={`${detail.label}-${detail.value}`}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                boxShadow:
                                  "0 4px 10px rgba(15, 23, 42, 0.03)",
                              }}
                            >
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
                                {detail.label}
                              </p>

                              <p
                                style={{
                                  margin: "7px 0 0",
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  fontWeight: 700,
                                  color: "#0f172a",
                                  wordBreak: "break-word",
                                }}
                              >
                                {detail.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {originalRequest.extraText ? (
                        <div
                          style={{
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                            color: "#122033",
                            fontSize: 14,
                          }}
                        >
                          {originalRequest.extraText}
                        </div>
                      ) : null}

                      {!originalRequest.summary &&
                      originalRequest.details.length === 0 &&
                      !originalRequest.extraText ? (
                        <div
                          style={{
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                            color: "#122033",
                            fontSize: 14,
                          }}
                        >
                          {originalMessageBody || "(No message body captured)"}
                        </div>
                      ) : null}
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
                          {conversation.length}
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
                      <input
                        type="hidden"
                        name="ticketId"
                        value={typedTicket.id}
                      />

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
                          Sends an email reply and moves this ticket to In
                          progress.
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
                </>
              ) : (
                <>
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
                          Notes
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
                          {notes.length}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        Internal only
                      </span>
                    </div>

                    <form
                      action={addTicketNoteAction}
                      style={{ display: "grid", gap: 0 }}
                    >
                      <div style={{ padding: 14 }}>
                        <label
                          htmlFor="noteBody"
                          style={{
                            display: "block",
                            marginBottom: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#122033",
                          }}
                        >
                          Add note
                        </label>

                        <textarea
                          id="noteBody"
                          name="body"
                          placeholder="Write an internal note..."
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
                          Notes stay private and are not part of the customer
                          conversation.
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
                          Add note
                        </button>
                      </div>
                    </form>
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
                        gap: 16,
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
                        Note history
                      </h2>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        Newest first
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
                      {notes.length === 0 ? (
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
                          No internal notes yet.
                        </div>
                      ) : (
                        notes.map((note) => (
                          <article
                            key={note.id}
                            style={{
                              background: "#fffdf7",
                              border: "1px solid #fcd34d",
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
                                  Internal note
                                </p>

                                <span
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fcd34d",
                                  }}
                                >
                                  Private
                                </span>
                              </div>

                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: "#64748b",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatDateTime(note.created_at)}
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
                              {note.body.trim()
                                ? note.body
                                : "(No note body captured)"}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </>
              )}
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