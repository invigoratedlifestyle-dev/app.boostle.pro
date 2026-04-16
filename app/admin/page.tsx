import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { SupportTicket } from "@/types/support";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusStyle(status: SupportTicket["status"]) {
  switch (status) {
    case "open":
      return {
        background: "#dcfce7",
        color: "#15803d",
        border: "1px solid #86efac",
        label: "Open",
      };
    case "in_progress":
      return {
        background: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fde68a",
        label: "In progress",
      };
    case "waiting_on_customer":
      return {
        background: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fde68a",
        label: "Waiting on customer",
      };
    case "resolved":
      return {
        background: "#ede9fe",
        color: "#6d28d9",
        border: "1px solid #c4b5fd",
        label: "Resolved",
      };
    case "closed":
      return {
        background: "#e2e8f0",
        color: "#475569",
        border: "1px solid #cbd5e1",
        label: "Closed",
      };
    default:
      return {
        background: "#e2e8f0",
        color: "#475569",
        border: "1px solid #cbd5e1",
        label: "Unknown",
      };
  }
}

function getPriorityStyle(priority: SupportTicket["priority"]) {
  switch (priority) {
    case "low":
      return {
        background: "#f8fafc",
        color: "#475569",
        border: "1px solid #cbd5e1",
        label: "Low",
      };
    case "normal":
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
        label: "Normal",
      };
    case "high":
      return {
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fdba74",
        label: "High",
      };
    case "urgent":
      return {
        background: "#fef2f2",
        color: "#dc2626",
        border: "1px solid #fca5a5",
        label: "Urgent",
      };
    default:
      return {
        background: "#f8fafc",
        color: "#475569",
        border: "1px solid #cbd5e1",
        label: "Normal",
      };
  }
}

function getInitials(name: string, email: string) {
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

function getMessagePreview(ticket: SupportTicket) {
  const source =
    typeof ticket.message === "string" && ticket.message.trim()
      ? ticket.message
      : typeof ticket.subject === "string"
        ? ticket.subject
        : "";

  const normalized = source.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "No message preview available.";
  }

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
}

async function getTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data as SupportTicket[];
}

export default async function AdminDashboardPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    redirect("/admin/login");
  }

  const tickets = await getTickets();

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const inProgressCount = tickets.filter(
    (ticket) => ticket.status === "in_progress",
  ).length;
  const urgentCount = tickets.filter(
    (ticket) => ticket.priority === "urgent",
  ).length;
  const waitingCount = tickets.filter(
    (ticket) => ticket.status === "waiting_on_customer",
  ).length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          padding: "40px 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            display: "grid",
            gap: 24,
          }}
        >
          <section
            style={{
              borderRadius: 24,
              padding: 28,
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.96))",
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
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
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: "#ffffff",
                      color: "#475569",
                      border: "1px solid #dbe4f0",
                    }}
                  >
                    Inbox
                  </span>
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: 36,
                    lineHeight: 1.08,
                    letterSpacing: "-0.04em",
                    color: "#0f172a",
                  }}
                >
                  Admin Dashboard
                </h1>

                <p
                  style={{
                    margin: "12px 0 0",
                    color: "#475569",
                    fontSize: 15,
                    maxWidth: 720,
                  }}
                >
                  View, scan, and manage support tickets in a cleaner inbox-style
                  workflow.
                </p>
              </div>

              <div>
                <form action="/api/admin/logout" method="post">
                  <button
                    type="submit"
                    style={{
                      padding: "12px 16px",
                      borderRadius: 14,
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 700,
                      border: "1px solid #dbe4f0",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
                      cursor: "pointer",
                    }}
                  >
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
            }}
          >
            {[
              {
                label: "Total tickets",
                value: tickets.length,
                tone: {
                  background: "#ffffff",
                  accent: "#2563eb",
                },
              },
              {
                label: "Open",
                value: openCount,
                tone: {
                  background: "#ecfdf5",
                  accent: "#15803d",
                },
              },
              {
                label: "In progress",
                value: inProgressCount,
                tone: {
                  background: "#fffbeb",
                  accent: "#b45309",
                },
              },
              {
                label: "Urgent / waiting",
                value: urgentCount + waitingCount,
                tone: {
                  background: "#fff7ed",
                  accent: "#c2410c",
                },
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 22,
                  padding: 20,
                  background: item.tone.background,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </p>

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 34,
                    lineHeight: 1,
                    fontWeight: 800,
                    color: item.tone.accent,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </section>

          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #eef2f7",
                display: "grid",
                gap: 16,
                background:
                  "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 24,
                      letterSpacing: "-0.02em",
                      color: "#0f172a",
                    }}
                  >
                    Ticket inbox
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#64748b",
                      fontSize: 14,
                    }}
                  >
                    A cleaner, more scannable list styled to match the ticket
                    view.
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    width: "fit-content",
                  }}
                >
                  {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {[
                    { label: "All", count: tickets.length, active: true },
                    { label: "Open", count: openCount, active: false },
                    {
                      label: "In progress",
                      count: inProgressCount,
                      active: false,
                    },
                    { label: "Urgent", count: urgentCount, active: false },
                  ].map((filter) => (
                    <span
                      key={filter.label}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                        border: filter.active
                          ? "1px solid #bfdbfe"
                          : "1px solid #e2e8f0",
                        background: filter.active ? "#eff6ff" : "#ffffff",
                        color: filter.active ? "#1d4ed8" : "#475569",
                      }}
                    >
                      {filter.label}
                      <span
                        style={{
                          display: "inline-grid",
                          placeItems: "center",
                          minWidth: 20,
                          height: 20,
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: filter.active ? "#dbeafe" : "#f1f5f9",
                          color: filter.active ? "#1d4ed8" : "#475569",
                          padding: "0 6px",
                        }}
                      >
                        {filter.count}
                      </span>
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    borderRadius: 14,
                    border: "1px solid #dbe4f0",
                    background: "#ffffff",
                    padding: "12px 14px",
                    color: "#94a3b8",
                    fontSize: 14,
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
                    boxSizing: "border-box",
                  }}
                >
                  Search by email, subject, or ticket ID
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 0,
                background:
                  "linear-gradient(180deg, #fcfdff 0%, #f8fafc 100%)",
              }}
            >
              {tickets.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  No tickets yet.
                </div>
              ) : (
                tickets.map((ticket) => {
                  const statusStyle = getStatusStyle(ticket.status);
                  const priorityStyle = getPriorityStyle(ticket.priority);
                  const preview = getMessagePreview(ticket);

                  return (
                    <Link
                      key={ticket.id}
                      href={`/admin/tickets/${ticket.id}`}
                      style={{
                        display: "block",
                        textDecoration: "none",
                        color: "inherit",
                        borderTop: "1px solid #eef2f7",
                      }}
                    >
                      <article
                        style={{
                          padding: 20,
                          background: "#ffffff",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              minWidth: 0,
                              alignItems: "flex-start",
                              gap: 16,
                              flex: 1,
                            }}
                          >
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 16,
                                background: "#dbeafe",
                                color: "#1d4ed8",
                                display: "grid",
                                placeItems: "center",
                                fontWeight: 800,
                                fontSize: 14,
                                border: "1px solid #bfdbfe",
                                boxShadow:
                                  "0 8px 16px rgba(37, 99, 235, 0.08)",
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(ticket.name, ticket.email)}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <span
                                  style={{
                                    padding: "5px 9px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    background: "#f8fafc",
                                    color: "#475569",
                                    border: "1px solid #e2e8f0",
                                  }}
                                >
                                  #{ticket.ticket_number}
                                </span>

                                <span
                                  style={{
                                    ...statusStyle,
                                    padding: "5px 9px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {statusStyle.label}
                                </span>

                                <span
                                  style={{
                                    ...priorityStyle,
                                    padding: "5px 9px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {priorityStyle.label}
                                </span>
                              </div>

                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: 20,
                                  lineHeight: 1.2,
                                  letterSpacing: "-0.02em",
                                  color: "#0f172a",
                                }}
                              >
                                {ticket.subject}
                              </h3>

                              <p
                                style={{
                                  margin: "8px 0 0",
                                  color: "#475569",
                                  fontSize: 14,
                                  fontWeight: 600,
                                }}
                              >
                                {ticket.name} · {ticket.email}
                              </p>

                              <p
                                style={{
                                  margin: "10px 0 0",
                                  color: "#64748b",
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  maxWidth: 780,
                                }}
                              >
                                {preview}
                              </p>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              color: "#64748b",
                              flexShrink: 0,
                              justifyContent: "space-between",
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatDate(ticket.created_at)}
                            </p>

                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#2563eb",
                              }}
                            >
                              Open ticket →
                            </span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .dashboard-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1200px) {
          .dashboard-stats-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}