"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support";

type GetTicketResponse = {
  ok?: boolean;
  ticket?: SupportTicket;
  error?: string;
};

type UpdateTicketResponse = {
  ok?: boolean;
  ticket?: SupportTicket;
  error?: string;
};

const statusOptions: Array<{
  value: SupportTicketStatus;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting on Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const priorityOptions: Array<{
  value: SupportTicketPriority;
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params?.id;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState<SupportTicketStatus>("open");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    type: "idle" | "error" | "success";
    message: string;
  }>({
    type: "idle",
    message: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTicket() {
      if (!ticketId) {
        setLoading(false);
        setNotice({
          type: "error",
          message: "Missing ticket id.",
        });
        return;
      }

      try {
        setLoading(true);
        setNotice({ type: "idle", message: "" });

        const response = await fetch(
          `/api/admin/tickets/get?id=${encodeURIComponent(ticketId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        const data = (await response.json()) as GetTicketResponse;

        if (!response.ok || !data.ok || !data.ticket) {
          throw new Error(data.error || "Failed to load ticket.");
        }

        if (cancelled) {
          return;
        }

        setTicket(data.ticket);
        setStatus(data.ticket.status);
        setPriority(data.ticket.priority);
        setAdminNotes(data.ticket.admin_notes ?? "");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to load ticket.",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTicket();

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const hasChanges = useMemo(() => {
    if (!ticket) {
      return false;
    }

    return (
      status !== ticket.status ||
      priority !== ticket.priority ||
      adminNotes !== (ticket.admin_notes ?? "")
    );
  }, [ticket, status, priority, adminNotes]);

  async function handleSave() {
    if (!ticket) {
      return;
    }

    try {
      setSaving(true);
      setNotice({ type: "idle", message: "" });

      const response = await fetch("/api/admin/tickets/update", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: ticket.id,
          status,
          priority,
          admin_notes: adminNotes,
        }),
      });

      const data = (await response.json()) as UpdateTicketResponse;

      if (!response.ok || !data.ok || !data.ticket) {
        throw new Error(data.error || "Failed to save ticket.");
      }

      setTicket(data.ticket);
      setStatus(data.ticket.status);
      setPriority(data.ticket.priority);
      setAdminNotes(data.ticket.admin_notes ?? "");
      setNotice({
        type: "success",
        message: "Ticket updated successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save ticket.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="container">
        <div className="card" style={{ padding: 28 }}>
          <div className="eyebrow">Boostle Support</div>

          <div style={{ marginTop: 18 }}>
            <Link href="/admin" className="status-text">
              ← Back to dashboard
            </Link>
          </div>

          {loading ? (
            <div style={{ marginTop: 18 }}>
              <h1 style={{ margin: "8px 0 0" }}>Loading ticket...</h1>
            </div>
          ) : !ticket ? (
            <div style={{ marginTop: 18 }}>
              <h1 style={{ margin: "8px 0 0" }}>Ticket unavailable</h1>
              {notice.message ? (
                <p
                  className={`status-text ${
                    notice.type === "error" ? "status-error" : ""
                  }`}
                  style={{ marginTop: 12 }}
                >
                  {notice.message}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <h1 style={{ margin: "16px 0 8px" }}>
                Ticket #{ticket.ticket_number}
              </h1>

              <p className="lead" style={{ maxWidth: "none" }}>
                Review the request, update its status, and keep internal notes.
              </p>

              <div
                style={{
                  marginTop: 24,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className="card" style={{ padding: 18 }}>
                  <strong>Customer</strong>
                  <div style={{ marginTop: 10 }}>{ticket.name}</div>
                  <div className="status-text" style={{ marginTop: 6 }}>
                    {ticket.email}
                  </div>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <strong>Created</strong>
                  <div style={{ marginTop: 10 }}>
                    {formatDate(ticket.created_at)}
                  </div>
                  <div className="status-text" style={{ marginTop: 6 }}>
                    Last updated {formatDate(ticket.updated_at)}
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginTop: 20, padding: 18 }}>
                <strong>Subject</strong>
                <div style={{ marginTop: 10 }}>{ticket.subject}</div>
              </div>

              <div className="card" style={{ marginTop: 20, padding: 18 }}>
                <strong>Customer message</strong>
                <div
                  style={{
                    marginTop: 10,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.65,
                  }}
                >
                  {ticket.message}
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className="field">
                  <label className="label" htmlFor="ticket-status">
                    Status
                  </label>
                  <select
                    id="ticket-status"
                    className="select"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as SupportTicketStatus)
                    }
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="ticket-priority">
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    className="select"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as SupportTicketPriority)
                    }
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: 20 }}>
                <label className="label" htmlFor="admin-notes">
                  Admin notes
                </label>
                <textarea
                  id="admin-notes"
                  className="textarea"
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder="Add internal notes for follow-up, troubleshooting, or customer context."
                />
              </div>

              {notice.message ? (
                <div
                  className={`status-text ${
                    notice.type === "error"
                      ? "status-error"
                      : notice.type === "success"
                        ? "status-success"
                        : ""
                  }`}
                  style={{ marginTop: 14 }}
                >
                  {notice.message}
                </div>
              ) : null}

              <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>

                <Link href="/admin" className="button button-secondary">
                  Back to dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}