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

  return (
    <main className="page-shell">
      <div className="container">
        <div className="card" style={{ padding: 28 }}>
          <div className="eyebrow">Boostle Support</div>

          <h1 style={{ marginTop: 12 }}>Admin Dashboard</h1>

          <p className="lead">View and manage incoming support tickets.</p>

          <div style={{ marginTop: 16 }}>
            <form action="/api/admin/logout" method="post">
              <button className="button button-secondary" type="submit">
                Log out
              </button>
            </form>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginTop: 24,
            }}
          >
            <div className="card" style={{ padding: 16 }}>
              <strong>Total</strong>
              <div>{tickets.length}</div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <strong>Open</strong>
              <div>{tickets.filter((t) => t.status === "open").length}</div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <strong>In progress</strong>
              <div>
                {tickets.filter((t) => t.status === "in_progress").length}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <strong>Urgent</strong>
              <div>{tickets.filter((t) => t.priority === "urgent").length}</div>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            {tickets.length === 0 ? (
              <p className="status-text">No tickets yet.</p>
            ) : (
              <table style={{ width: "100%", marginTop: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link href={`/admin/tickets/${ticket.id}`}>
                          #{ticket.ticket_number}
                        </Link>
                      </td>

                      <td>
                        <div>{ticket.name}</div>
                        <div className="status-text">{ticket.email}</div>
                      </td>

                      <td>
                        <Link href={`/admin/tickets/${ticket.id}`}>
                          {ticket.subject}
                        </Link>
                      </td>
                      <td>{ticket.status}</td>
                      <td>{ticket.priority}</td>
                      <td>{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}