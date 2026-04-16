import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { SupportTicket } from "@/types/support";

type QueueKey = "support" | "developer" | "billing";

const QUEUE_OPTIONS: Array<{ key: QueueKey; label: string }> = [
  { key: "support", label: "Support Queue" },
  { key: "developer", label: "Developer Queue" },
  { key: "billing", label: "Billing Queue" },
];

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

function asRecord(ticket: SupportTicket) {
  return ticket as unknown as Record<string, unknown>;
}

function getStringField(
  ticket: SupportTicket,
  fieldNames: string[],
): string | null {
  const record = asRecord(ticket);

  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeQueueKey(value: string | null | undefined): QueueKey {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "developer" || normalized === "developer queue") {
    return "developer";
  }

  if (normalized === "billing" || normalized === "billing queue") {
    return "billing";
  }

  return "support";
}

function getTicketQueue(ticket: SupportTicket): QueueKey {
  const queueValue = getStringField(ticket, [
    "queue",
    "queue_name",
    "team",
    "department",
  ]);

  return normalizeQueueKey(queueValue);
}

function getTechnician(ticket: SupportTicket) {
  const technicianValue = getStringField(ticket, [
    "technician_name",
    "assigned_to_name",
    "owner_name",
    "assigned_name",
    "technician",
    "assignee_name",
    "assigned_to_email",
    "owner_email",
    "assignee_email",
    "assigned_to",
    "owner",
    "assignee",
  ]);

  return technicianValue ?? "Unassigned";
}

function getQueueLabel(queue: QueueKey) {
  return QUEUE_OPTIONS.find((option) => option.key === queue)?.label ?? "Support Queue";
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
  isLast = false,
}: {
  label: string;
  value: number;
  active?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRight: isLast ? "none" : "1px solid #dbe4f0",
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
          margin: "6px 0 0",
          fontSize: 16,
          fontWeight: 800,
          color: value === 0 ? "#94a3b8" : "#0f172a",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function QueueTable({
  title,
  tickets,
}: {
  title: string;
  tickets: SupportTicket[];
}) {
  return (
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
          alignItems: "center",
          gap: 10,
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
          {title}
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
          {tickets.length}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px",
          alignItems: "center",
          padding: "12px 14px",
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
        <div>Technician</div>
        <div>Priority</div>
        <div>Created</div>
      </div>

      {tickets.length === 0 ? (
        <div
          style={{
            padding: "16px 14px",
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
          const technician = getTechnician(ticket);

          return (
            <Link
              key={ticket.id}
              href={`/admin/tickets/${ticket.id}`}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px",
                alignItems: "center",
                gap: 0,
                padding: "0 14px",
                minHeight: 48,
                textDecoration: "none",
                color: "inherit",
                background: "#ffffff",
                borderBottom: "1px solid #eef2f7",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                }}
              >
                {ticket.status === "open" ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <span>#{ticket.ticket_number}</span>
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
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ticket.subject}
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
                  minWidth: 0,
                  paddingRight: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: technician === "Unassigned" ? "#64748b" : "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {technician}
                </p>
              </div>

              <div>
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
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {formatDate(ticket.created_at)}
              </div>
            </Link>
          );
        })
      )}
    </section>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ queue?: string }>;
}) {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedQueue = normalizeQueueKey(resolvedSearchParams.queue);

  const tickets = await getTickets();

  const ticketsInSelectedQueue = tickets.filter(
    (ticket) => getTicketQueue(ticket) === selectedQueue,
  );

  const unresolvedCount = ticketsInSelectedQueue.filter(
    (ticket) => ticket.status !== "resolved" && ticket.status !== "closed",
  ).length;

  const dueSoonCount = ticketsInSelectedQueue.filter(
    (ticket) => ticket.priority === "urgent",
  ).length;

  const unassignedCount = ticketsInSelectedQueue.filter(
    (ticket) => getTechnician(ticket) === "Unassigned",
  ).length;

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
                Dashboard
              </h1>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <form
                method="get"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <label
                  htmlFor="queue"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  Queue
                </label>

                <select
                  id="queue"
                  name="queue"
                  defaultValue={selectedQueue}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 600,
                    border: "1px solid #dbe4f0",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
                    cursor: "pointer",
                  }}
                >
                  {QUEUE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>

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
                  View queue
                </button>
              </form>

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
              <SummaryTile label="All Tickets" value={ticketsInSelectedQueue.length} active />
              <SummaryTile label="Unassigned" value={unassignedCount} />
              <SummaryTile label="Unresolved" value={unresolvedCount} />
              <SummaryTile label="Due Soon" value={dueSoonCount} isLast />
            </div>
          </section>

          <QueueTable
            title={getQueueLabel(selectedQueue)}
            tickets={ticketsInSelectedQueue}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 1240px) {
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] {
            grid-template-columns: 42px 90px 150px minmax(220px, 1fr) minmax(150px, 200px) minmax(130px, 170px) 110px 130px !important;
          }

          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] {
            grid-template-columns: 42px 90px 150px minmax(220px, 1fr) minmax(150px, 200px) minmax(130px, 170px) 110px 130px !important;
          }
        }

        @media (max-width: 1120px) {
          main section div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 980px) {
          main section div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }

          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] {
            grid-template-columns: 42px 100px 160px minmax(220px, 1fr) 130px !important;
          }

          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(5),
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(6),
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(7) {
            display: none !important;
          }

          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] {
            grid-template-columns: 42px 100px 160px minmax(220px, 1fr) 130px !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }

          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(5),
          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(6),
          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(7) {
            display: none !important;
          }
        }

        @media (max-width: 760px) {
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] {
            grid-template-columns: 42px 100px minmax(220px, 1fr) !important;
          }

          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(3),
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(5),
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(6),
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(7),
          section > div[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(8) {
            display: none !important;
          }

          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] {
            grid-template-columns: 42px 100px minmax(220px, 1fr) !important;
          }

          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(3),
          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(5),
          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(6),
          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(7),
          a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"] > div:nth-child(8) {
            display: none !important;
          }
        }

        a[style*="grid-template-columns: 42px 100px 160px minmax(260px, 1fr) minmax(170px, 220px) minmax(150px, 190px) 120px 150px"]:hover {
          background: #f8fbff !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
        }
      `}</style>
    </main>
  );
}