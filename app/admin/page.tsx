import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import TicketsTable from "./tickets-table";

type TicketStatus = "open" | "in_progress" | "closed";
type TicketStatusFilter = TicketStatus | "all";
type SortOrder = "newest" | "oldest";

type Ticket = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
};

type SearchParams = {
  q?: string;
  status?: string;
  sort?: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Admin env check:", {
    hasUrl: Boolean(url),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normaliseStatus(value?: string): TicketStatusFilter {
  if (value === "open" || value === "in_progress" || value === "closed") {
    return value;
  }

  return "all";
}

function normaliseSort(value?: string): SortOrder {
  return value === "oldest" ? "oldest" : "newest";
}

function buildAdminUrl({
  q,
  status,
  sort,
}: {
  q?: string;
  status?: string;
  sort?: string;
}) {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  if (sort && sort !== "newest") params.set("sort", sort);

  const queryString = params.toString();
  return queryString ? `/admin?${queryString}` : "/admin";
}

function getTabLabel(status: TicketStatusFilter) {
  if (status === "all") return "All";
  if (status === "in_progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getCountForStatus(
  status: TicketStatusFilter,
  counts: Record<TicketStatus, number>,
) {
  if (status === "all") {
    return counts.open + counts.in_progress + counts.closed;
  }
  return counts[status];
}

function getTabHref({
  activeStatus,
  q,
  sort,
}: {
  activeStatus: TicketStatusFilter;
  q: string;
  sort: SortOrder;
}) {
  return buildAdminUrl({
    q: q || undefined,
    status: activeStatus === "all" ? undefined : activeStatus,
    sort: sort === "newest" ? undefined : sort,
  });
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};

  const q = params.q?.trim() ?? "";
  const status = normaliseStatus(params.status);
  const sort = normaliseSort(params.sort);

  console.log("Admin page params:", { q, status, sort });

  const supabase = getSupabaseAdmin();

  let ticketsQuery = supabase
    .from("support_tickets") // ✅ FIXED
    .select("id, name, email, subject, message, status, created_at");

  if (status !== "all") {
    ticketsQuery = ticketsQuery.eq("status", status);
  }

  if (q) {
    const escapedQ = q.replace(/,/g, "\\,");
    ticketsQuery = ticketsQuery.or(
      `name.ilike.%${escapedQ}%,email.ilike.%${escapedQ}%,subject.ilike.%${escapedQ}%`,
    );
  }

  ticketsQuery = ticketsQuery.order("created_at", {
    ascending: sort === "oldest",
  });

  const [ticketsResult, openCountResult, inProgressCountResult, closedCountResult] =
    await Promise.all([
      ticketsQuery,
      supabase
        .from("support_tickets") // ✅ FIXED
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("support_tickets") // ✅ FIXED
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("support_tickets") // ✅ FIXED
        .select("*", { count: "exact", head: true })
        .eq("status", "closed"),
    ]);

  if (ticketsResult.error) {
    console.error("Tickets query failed:", ticketsResult.error);
    throw new Error(ticketsResult.error.message);
  }

  if (openCountResult.error) throw new Error(openCountResult.error.message);
  if (inProgressCountResult.error) throw new Error(inProgressCountResult.error.message);
  if (closedCountResult.error) throw new Error(closedCountResult.error.message);

  const tickets = (ticketsResult.data ?? []) as Ticket[];

  const counts: Record<TicketStatus, number> = {
    open: openCountResult.count ?? 0,
    in_progress: inProgressCountResult.count ?? 0,
    closed: closedCountResult.count ?? 0,
  };

  const totalCount = counts.open + counts.in_progress + counts.closed;

  const returnTo = buildAdminUrl({
    q: q || undefined,
    status: status === "all" ? undefined : status,
    sort: sort === "newest" ? undefined : sort,
  });

  const tabs: TicketStatusFilter[] = ["all", "open", "in_progress", "closed"];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">
            Boostle Support
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Ticket Dashboard
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = tab === status;
            return (
              <Link
                key={tab}
                href={getTabHref({ activeStatus: tab, q, sort })}
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  active ? "bg-slate-900 text-white" : "bg-slate-100"
                }`}
              >
                {getTabLabel(tab)} ({getCountForStatus(tab, counts)})
              </Link>
            );
          })}
        </div>

        {/* Table */}
        <TicketsTable tickets={tickets} returnTo={returnTo} />

      </div>
    </main>
  );
}