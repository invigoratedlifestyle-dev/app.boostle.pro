"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { bulkUpdateTicketsAction } from "./actions";

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

type TicketsTableProps = {
  tickets: Ticket[];
  returnTo: string;
};

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

export default function TicketsTable({
  tickets,
  returnTo,
}: TicketsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedCount = selectedIds.length;
  const allSelected = useMemo(() => {
    return tickets.length > 0 && selectedIds.length === tickets.length;
  }, [tickets.length, selectedIds.length]);

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(tickets.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((x) => x !== id),
    );
  }

  return (
    <section className="card" style={{ padding: 0 }}>
      <form action={bulkUpdateTicketsAction}>
        <input type="hidden" name="returnTo" value={returnTo} />

        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="selectedIds" value={id} />
        ))}

        {/* Header */}
        <div
          style={{
            padding: 20,
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Tickets</h2>
            <p style={{ margin: 0, color: "#64748b" }}>
              {tickets.length} result{tickets.length === 1 ? "" : "s"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>
              {selectedCount > 0
                ? `${selectedCount} selected`
                : "Select tickets"}
            </span>

            <select
              name="bulkAction"
              disabled={!selectedCount}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #dbe4f0",
              }}
            >
              <option value="">Bulk action</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>

            <button
              type="submit"
              disabled={!selectedCount}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "white",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Select all */}
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all visible tickets
          </label>
        </div>

        {/* Empty state */}
        {tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p>No tickets found</p>
          </div>
        ) : (
          <div>
            {tickets.map((ticket) => {
              const isChecked = selectedIds.includes(ticket.id);

              return (
                <div
                  key={ticket.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 16,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) =>
                      toggleOne(ticket.id, e.target.checked)
                    }
                  />

                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    style={{ flex: 1, textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <strong>{ticket.subject}</strong>

                          <span
                            style={{
                              ...getStatusStyle(ticket.status),
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {getStatusLabel(ticket.status)}
                          </span>
                        </div>

                        <div style={{ fontSize: 14, color: "#64748b" }}>
                          {ticket.name} · {ticket.email}
                        </div>

                        <div style={{ fontSize: 14, marginTop: 6 }}>
                          {ticket.message}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {new Date(ticket.created_at).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </form>
    </section>
  );
}