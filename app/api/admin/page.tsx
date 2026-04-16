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

function statusClasses(status: SupportTicket["status"]) {
  switch (status) {
    case "open":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
    case "in_progress":
      return "bg-sky-500/15 text-sky-300 border-sky-500/20";
    case "waiting_on_customer":
      return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    case "resolved":
      return "bg-violet-500/15 text-violet-300 border-violet-500/20";
    case "closed":
      return "bg-slate-500/15 text-slate-300 border-slate-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/20";
  }
}

function priorityClasses(priority: SupportTicket["priority"]) {
  switch (priority) {
    case "low":
      return "bg-slate-500/15 text-slate-300 border-slate-500/20";
    case "normal":
      return "bg-sky-500/15 text-sky-300 border-sky-500/20";
    case "high":
      return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    case "urgent":
      return "bg-red-500/15 text-red-300 border-red-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/20";
  }
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
    redirect("/dashboard/login");
  }

  const tickets = await getTickets();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
              Boostle Support
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-white/70">
              View all incoming support tickets.
            </p>
          </div>

          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Log out
            </button>
          </form>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">Total tickets</p>
            <p className="mt-2 text-3xl font-semibold">{tickets.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">Open</p>
            <p className="mt-2 text-3xl font-semibold">
              {tickets.filter((ticket) => ticket.status === "open").length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">In progress</p>
            <p className="mt-2 text-3xl font-semibold">
              {tickets.filter((ticket) => ticket.status === "in_progress").length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">Urgent</p>
            <p className="mt-2 text-3xl font-semibold">
              {tickets.filter((ticket) => ticket.priority === "urgent").length}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-white/60">
                <tr>
                  <th className="px-5 py-4 font-medium">Ticket</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">Subject</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Priority</th>
                  <th className="px-5 py-4 font-medium">Created</th>
                </tr>
              </thead>

              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-white/50">
                      No tickets yet.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b border-white/5 transition hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/tickets/${ticket.id}`}
                          className="font-medium text-sky-300 hover:text-sky-200"
                        >
                          #{ticket.ticket_number}
                        </Link>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium">{ticket.name}</div>
                        <div className="text-white/50">{ticket.email}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="max-w-[320px] truncate">{ticket.subject}</div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(ticket.status)}`}
                        >
                          {ticket.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${priorityClasses(ticket.priority)}`}
                        >
                          {ticket.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-white/60">
                        {formatDate(ticket.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}