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
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
        label: "In progress",
      };
    case "waiting_on_customer":
      return {
        background: "#ede9fe",
        color: "#7c3aed",
        border: "1px solid #c4b5fd",
        label: "Waiting on customer",
      };
    case "resolved":
      return {
        background: "#ecfeff",
        color: "#0f766e",
        border: "1px solid #a5f3fc",
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

function getQueueGroups(tickets: SupportTicket[]) {
  const myTickets = tickets.filter(
    (ticket) => ticket.status === "in_progress" || ticket.status === "open",
  );
  const unassigned = tickets.filter(
    (ticket) => ticket.status !== "closed" && ticket.status !== "resolved",
  );

  return {
    myTickets,
    unassigned,
  };
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

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69)}...`;
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

function SummaryTile({
  label,
  value,
  active = false,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRight: "1px solid #dbe4f0",
        background: active ? "#f8fbff" : "#ffffff",
        boxShadow: active ? "inset 0 -2px 0 #0ea5e9" : "none",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "#475569",
          fontWeight: 500,
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: 18,
          fontWeight: 800,
          color: value === 0 ? "#94a3b8" : "#0f172a",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function QueueSection({
  title,
  count,
  tickets,
}: {
  title: string;
  count: number;
  tickets: SupportTicket[];
}) {
  return (
    <div style={{ borderTop: "1px solid #e5edf5" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e5edf5",
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: "#64748b",
          }}
        >
          ▾
        </span>

        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {title}
        </h3>

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
          {count}
        </span>
      </div>

      {tickets.length === 0 ? (
        <div
          style={{
            padding: "18px",
            fontSize: 14,
            color: "#64748b",
            background: "#ffffff",
          }}
        >
          No tickets in this queue.
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
                display: "grid",
                gridTemplateColumns: "52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px",
                alignItems: "center",
                gap: 0,
                padding: "0 18px",
                minHeight: 60,
                textDecoration: "none",
                color: "inherit",
                background: "#ffffff",
                borderBottom: "1px solid #eef2f7",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: "#94a3b8",
                  fontSize: 14,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    display: "inline-block",
                    background: "#ffffff",
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                }}
              >
                #{ticket.ticket_number}
              </div>

              <div>
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
                  {statusStyle.label}
                </span>
              </div>

              <div
                style={{
                  minWidth: 0,
                  paddingRight: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ticket.subject}
                </p>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "#64748b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {preview}
                </p>
              </div>

              <div
                style={{
                  minWidth: 0,
                  paddingRight: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ticket.name}
                </p>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "#64748b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ticket.email}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    ...priorityStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {priorityStyle.label}
                </span>

                <span
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDate(ticket.created_at)}
                </span>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    redirect("/admin/login");
  }

  const tickets = await getTickets();
  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const unresolvedCount = tickets.filter(
    (ticket) => ticket.status !== "resolved" && ticket.status !== "closed",
  ).length;
  const dueSoonCount = tickets.filter(
    (ticket) => ticket.priority === "urgent",
  ).length;

  const { myTickets, unassigned } = getQueueGroups(tickets);

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
            maxWidth: 1280,
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
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
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                My Queue
              </h1>
            </div>

            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 700,
                  border: "1px solid #dbe4f0",
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
                  cursor: "pointer",
                }}
              >
                Log out
              </button>
            </form>
          </div>

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
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              <SummaryTile label="All Tickets" value={tickets.length} active />
              <SummaryTile label="Unassigned" value={unassigned.length} />
              <SummaryTile label="Unresolved" value={unresolvedCount} />
              <SummaryTile label="Due Soon" value={dueSoonCount} />
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
                display: "grid",
                gridTemplateColumns: "52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px",
                alignItems: "center",
                padding: "12px 18px",
                background: "#f8fafc",
                borderBottom: "1px solid #dbe4f0",
                color: "#475569",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <div />
              <div>#</div>
              <div>Status</div>
              <div>Subject</div>
              <div>Customer</div>
              <div>Priority / Created</div>
            </div>

            <QueueSection
              title="My Tickets"
              count={myTickets.length}
              tickets={myTickets.slice(0, 8)}
            />

            <QueueSection
              title="Unassigned"
              count={unassigned.length}
              tickets={unassigned.slice(0, 12)}
            />
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .queue-hide-table {
            display: none !important;
          }
        }

        @media (max-width: 980px) {
          main section div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          a[style*="grid-template-columns: 52px 110px 170px"] {
            grid-template-columns: 52px 110px minmax(0, 1fr) !important;
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }

          a[style*="grid-template-columns: 52px 110px 170px"] > div:nth-child(3),
          a[style*="grid-template-columns: 52px 110px 170px"] > div:nth-child(5),
          a[style*="grid-template-columns: 52px 110px 170px"] > div:nth-child(6) {
            display: none !important;
          }

          section > div[style*="grid-template-columns: 52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px"] {
            grid-template-columns: 52px 110px minmax(0, 1fr) !important;
          }

          section > div[style*="grid-template-columns: 52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px"] > div:nth-child(3),
          section > div[style*="grid-template-columns: 52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px"] > div:nth-child(5),
          section > div[style*="grid-template-columns: 52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px"] > div:nth-child(6) {
            display: none !important;
          }
        }

        @media (max-width: 640px) {
          main section div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }

        a[style*="grid-template-columns: 52px 110px 170px minmax(220px, 1fr) minmax(160px, 220px) 150px"]:hover {
          background: #f8fbff !important;
        }
      `}</style>
    </main>
  );
}