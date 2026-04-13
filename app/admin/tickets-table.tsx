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
  needs_attention: boolean;
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
  if (status === "in_progress") {
    return "In progress";
  }

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
      setSelectedIds(tickets.map((ticket) => ticket.id));
      return;
    }

    setSelectedIds([]);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(id)) {
          return current;
        }

        return [...current, id];
      }

      return current.filter((currentId) => currentId !== id);
    });
  }

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <form action={bulkUpdateTicketsAction}>
        <input type="hidden" name="returnTo" value={returnTo} />

        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="selectedIds" value={id} />
        ))}

        <div
          style={{
            padding: 20,
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Tickets
            </h2>

            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              {tickets.length} result{tickets.length === 1 ? "" : "s"}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 14, color: "#334155" }}>
              {selectedCount > 0
                ? `${selectedCount} selected`
                : "Select tickets"}
            </span>

            <select
              name="bulkAction"
              defaultValue=""
              disabled={!selectedCount}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #dbe4f0",
                background: "#ffffff",
                color: "#122033",
              }}
            >
              <option value="" disabled>
                Bulk action
              </option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>

            <button
              type="submit"
              disabled={!selectedCount}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: selectedCount ? "#2563eb" : "#cbd5e1",
                color: "#ffffff",
                fontWeight: 700,
                cursor: selectedCount ? "pointer" : "not-allowed",
              }}
            >
              Apply
            </button>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>No tickets found</p>
            <p style={{ margin: "8px 0 0", color: "#64748b" }}>
              Try changing your filters or search.
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
                Select all visible tickets
              </label>
            </div>

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
                      cursor: "pointer",
                      transition: "background 0.18s ease",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ paddingTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) =>
                          toggleOne(ticket.id, event.target.checked)
                        }
                        aria-label={`Select ticket ${ticket.subject}`}
                      />
                    </div>

                    <Link
                      href={`/admin/tickets/${ticket.id}`}
                      style={{
                        flex: 1,
                        textDecoration: "none",
                        color: "inherit",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              {ticket.needs_attention ? (
                                <span
                                  aria-label="Needs attention"
                                  title="Needs attention"
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                    display: "inline-block",
                                    flexShrink: 0,
                                  }}
                                />
                              ) : null}

                              <strong
                                style={{
                                  fontSize: 18,
                                  lineHeight: 1.2,
                                  fontWeight: ticket.needs_attention ? 800 : 600,
                                }}
                              >
                                {ticket.subject}
                              </strong>
                            </div>

                            <span
                              style={{
                                ...getStatusStyle(ticket.status),
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {getStatusLabel(ticket.status)}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 14,
                              color: "#64748b",
                              marginTop: 4,
                            }}
                          >
                            {ticket.name} · {ticket.email}
                          </div>

                          <div
                            style={{
                              fontSize: 14,
                              marginTop: 10,
                              color: "#122033",
                              lineHeight: 1.5,
                            }}
                          >
                            {ticket.message}
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(ticket.created_at).toLocaleString()}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </section>
  );
}