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

  const supabase = getSupabaseAdmin();

  let ticketsQuery = supabase
    .from("support_tickets")
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
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "closed"),
    ]);

  if (ticketsResult.error) {
    throw new Error(ticketsResult.error.message);
  }

  if (openCountResult.error) {
    throw new Error(openCountResult.error.message);
  }

  if (inProgressCountResult.error) {
    throw new Error(inProgressCountResult.error.message);
  }

  if (closedCountResult.error) {
    throw new Error(closedCountResult.error.message);
  }

  const tickets = (ticketsResult.data ?? []) as Ticket[];

  const counts: Record<TicketStatus, number> = {
    open: openCountResult.count ?? 0,
    in_progress: inProgressCountResult.count ?? 0,
    closed: closedCountResult.count ?? 0,
  };

  const returnTo = buildAdminUrl({
    q: q || undefined,
    status: status === "all" ? undefined : status,
    sort: sort === "newest" ? undefined : sort,
  });

  const tabs: TicketStatusFilter[] = ["all", "open", "in_progress", "closed"];

  return (
    <main className="page-shell">
      <div className="container">
        <div>
          <p
            style={{
              fontSize: 13,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#2563eb",
              margin: "0 0 6px",
            }}
          >
            Boostle Support
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 34,
              letterSpacing: "-0.03em",
            }}
          >
            Ticket Dashboard
          </h1>
        </div>

        <div
          style={{
            marginTop: 14,
            marginBottom: 22,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {tabs.map((tab) => {
            const active = tab === status;

            return (
              <Link
                key={tab}
                href={getTabHref({ activeStatus: tab, q, sort })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: active ? "#0f172a" : "#f1f5f9",
                  color: active ? "#ffffff" : "#334155",
                  textDecoration: "none",
                }}
              >
                {getTabLabel(tab)} ({getCountForStatus(tab, counts)})
              </Link>
            );
          })}
        </div>

        <TicketsTable tickets={tickets} returnTo={returnTo} />
      </div>
    </main>
  );
}