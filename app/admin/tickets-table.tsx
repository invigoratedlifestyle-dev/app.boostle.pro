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

function getStatusClasses(status: TicketStatus) {
  if (status === "open") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "in_progress") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-200 text-slate-700";
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

  function toggleOne(ticketId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(ticketId)) {
          return current;
        }

        return [...current, ticketId];
      }

      return current.filter((id) => id !== ticketId);
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <form action={bulkUpdateTicketsAction}>
        <input type="hidden" name="returnTo" value={returnTo} />

        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="selectedIds" value={id} />
        ))}

        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tickets</h2>
            <p className="mt-1 text-sm text-slate-500">
              {tickets.length} result{tickets.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-slate-600">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : "Select tickets to use bulk actions"}
            </div>

            <div className="flex gap-2">
              <select
                name="bulkAction"
                defaultValue=""
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                disabled={selectedCount === 0}
              >
                <option value="" disabled>
                  Bulk action
                </option>
                <option value="open">Mark as open</option>
                <option value="in_progress">Mark as in progress</option>
                <option value="closed">Mark as closed</option>
              </select>

              <button
                type="submit"
                disabled={selectedCount === 0}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-base font-medium text-slate-900">No tickets found</p>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your filters or search.
            </p>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-sky-500"
                />
                Select all visible tickets
              </label>
            </div>

            <div className="divide-y divide-slate-200">
              {tickets.map((ticket) => {
                const isChecked = selectedIds.includes(ticket.id);

                return (
                  <div
                    key={ticket.id}
                    className="flex gap-4 px-5 py-4 transition hover:bg-slate-50"
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) =>
                          toggleOne(ticket.id, event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-sky-500"
                        aria-label={`Select ticket ${ticket.subject}`}
                      />
                    </div>

                    <Link
                      href={`/admin/tickets/${ticket.id}`}
                      className="block min-w-0 flex-1"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-slate-900">
                              {ticket.subject}
                            </h3>

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                                ticket.status,
                              )}`}
                            >
                              {getStatusLabel(ticket.status)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-600">
                            {ticket.name} · {ticket.email}
                          </p>

                          <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                            {ticket.message}
                          </p>
                        </div>

                        <div className="shrink-0 text-sm text-slate-500">
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