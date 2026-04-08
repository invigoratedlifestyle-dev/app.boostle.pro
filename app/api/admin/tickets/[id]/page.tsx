"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Ticket = {
  id: string;
  ticket_number: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_notes: string | null;
};

export default function TicketPage() {
  const params = useParams();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/tickets/get?id=${id}`)
      .then((res) => res.json())
      .then((data) => setTicket(data));
  }, [id]);

  async function save() {
    if (!ticket) return;

    setSaving(true);

    await fetch("/api/admin/tickets/update", {
      method: "POST",
      body: JSON.stringify(ticket),
    });

    setSaving(false);
    alert("Saved");
  }

  if (!ticket) return <div>Loading...</div>;

  return (
    <main className="page-shell">
      <div className="container">
        <div className="card" style={{ padding: 28 }}>
          <h1>Ticket #{ticket.ticket_number}</h1>

          <p><strong>{ticket.name}</strong> — {ticket.email}</p>

          <h3>Message</h3>
          <p>{ticket.message}</p>

          <div style={{ marginTop: 20 }}>
            <label>Status</label>
            <select
              value={ticket.status}
              onChange={(e) =>
                setTicket({ ...ticket, status: e.target.value })
              }
              className="input"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on_customer">Waiting</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Priority</label>
            <select
              value={ticket.priority}
              onChange={(e) =>
                setTicket({ ...ticket, priority: e.target.value })
              }
              className="input"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Admin Notes</label>
            <textarea
              value={ticket.admin_notes || ""}
              onChange={(e) =>
                setTicket({ ...ticket, admin_notes: e.target.value })
              }
              className="textarea"
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              className="button button-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}