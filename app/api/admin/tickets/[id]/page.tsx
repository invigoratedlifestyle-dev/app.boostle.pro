import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { SupportTicket } from "@/types/support";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getTicket(id: string): Promise<SupportTicket | null> {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code === "PGRST116") {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data as SupportTicket;
}

export default async function AdminTicketDetailPage({ params }: PageProps) {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const ticket = await getTicket(id);

  if (!ticket) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-sky-300 hover:text-sky-200"
          >
            ← Back to dashboard
          </Link>

          <p className="mt-4 text-sm uppercase tracking-[0.2em] text-sky-300">
            Ticket #{ticket.ticket_number}
          </p>

          <h1 className="mt-2 text-3xl font-semibold">{ticket.subject}</h1>

          <p className="mt-2 text-sm text-white/60">
            Created {formatDate(ticket.created_at)}
          </p>
        </div>

        <div className="grid gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Customer</h2>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              <p>
                <span className="text-white/50">Name:</span> {ticket.name}
              </p>
              <p>
                <span className="text-white/50">Email:</span> {ticket.email}
              </p>
              <p>
                <span className="text-white/50">Status:</span> {ticket.status}
              </p>
              <p>
                <span className="text-white/50">Priority:</span> {ticket.priority}
              </p>
              <p>
                <span className="text-white/50">Source:</span> {ticket.source}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Message</h2>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/85">
              {ticket.message}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Admin notes</h2>
            <div className="mt-4 text-sm text-white/60">
              {ticket.admin_notes?.trim()
                ? ticket.admin_notes
                : "No admin notes yet in this MVP."}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}