import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import TicketsTable from "./tickets-table";

type TicketStatus = "open" | "in_progress" | "closed";
type TicketStatusFilter = TicketStatus | "all";
type SortOrder = "newest" | "oldest";
type TicketPriority = "low" | "normal" | "high" | "urgent" | string;

type Ticket = {
  id: string;
  ticket_number?: number | null;
  public_thread_id?: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority?: TicketPriority | null;
  created_at: string;
  needs_attention: boolean;
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

  if (q) {
    params.set("q", q);
  }

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (sort && sort !== "newest") {
    params.set("sort", sort);
  }

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
    .select(
      "id, ticket_number, public_thread_id, name, email, subject, message, status, priority, created_at, needs_attention",
    );

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

  const needsAttentionCount = tickets.filter(
    (ticket) => ticket.needs_attention,
  ).length;

  const returnTo = buildAdminUrl({
    q: q || undefined,
    status: status === "all" ? undefined : status,
    sort: sort === "newest" ? undefined : sort,
  });

  const tabs: TicketStatusFilter[] = ["all", "open", "in_progress", "closed"];

  return (
    <main className="page-shell">
      <div className="container">
        <div className="top-row">
          <div>
            <p className="eyebrow">Boostle Support</p>
            <h1 className="page-title">Ticket Dashboard</h1>
            <p className="page-copy">
              View, filter, and open support tickets submitted from
              app.boostle.pro.
            </p>
          </div>

          <div className="top-actions">
            <Link href="/" className="secondary-link">
              Open support form
            </Link>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total tickets</span>
            <strong className="stat-value">
              {counts.open + counts.in_progress + counts.closed}
            </strong>
          </div>

          <div className="stat-card">
            <span className="stat-label">Open</span>
            <strong className="stat-value">{counts.open}</strong>
          </div>

          <div className="stat-card">
            <span className="stat-label">In progress</span>
            <strong className="stat-value">{counts.in_progress}</strong>
          </div>

          <div className="stat-card">
            <span className="stat-label">Needs attention</span>
            <strong className="stat-value">{needsAttentionCount}</strong>
          </div>
        </div>

        <div className="toolbar">
          <form method="get" className="search-form">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search name, email, or subject"
              className="search-input"
            />
            <input type="hidden" name="sort" value={sort} />
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <button type="submit" className="search-button">
              Search
            </button>
          </form>

          <div className="sort-actions">
            <Link
              href={buildAdminUrl({
                q: q || undefined,
                status: status === "all" ? undefined : status,
                sort: "newest",
              })}
              className={sort === "newest" ? "sort-link active" : "sort-link"}
            >
              Newest
            </Link>

            <Link
              href={buildAdminUrl({
                q: q || undefined,
                status: status === "all" ? undefined : status,
                sort: "oldest",
              })}
              className={sort === "oldest" ? "sort-link active" : "sort-link"}
            >
              Oldest
            </Link>
          </div>
        </div>

        <div className="tabs">
          {tabs.map((tab) => {
            const active = tab === status;

            return (
              <Link
                key={tab}
                href={getTabHref({ activeStatus: tab, q, sort })}
                className={active ? "tab active" : "tab"}
              >
                {getTabLabel(tab)} ({getCountForStatus(tab, counts)})
              </Link>
            );
          })}
        </div>

        <div className="table-wrap">
          <TicketsTable tickets={tickets} returnTo={returnTo} />
        </div>
      </div>

      <style jsx>{`
        .page-shell {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top,
              rgba(37, 99, 235, 0.08),
              transparent 26%
            ),
            linear-gradient(180deg, #f8fbff 0%, #eef4ff 40%, #f8fafc 100%);
          color: #0f172a;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 20px 56px;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .eyebrow {
          margin: 0 0 6px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #2563eb;
        }

        .page-title {
          margin: 0;
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.03em;
        }

        .page-copy {
          margin: 10px 0 0;
          font-size: 16px;
          line-height: 1.65;
          color: #475569;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .secondary-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #dbe7f5;
          color: #0f172a;
          text-decoration: none;
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
        }

        .stats-grid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
        }

        .stat-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .stat-value {
          display: block;
          margin-top: 10px;
          font-size: 28px;
          line-height: 1;
          letter-spacing: -0.03em;
          color: #0f172a;
        }

        .toolbar {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .search-form {
          display: flex;
          gap: 10px;
          flex: 1 1 460px;
          flex-wrap: wrap;
        }

        .search-input {
          flex: 1 1 280px;
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          padding: 0 14px;
          font: inherit;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }

        .search-input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
        }

        .search-button {
          min-height: 48px;
          border: 0;
          border-radius: 14px;
          padding: 0 16px;
          background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.2);
        }

        .sort-actions {
          display: flex;
          gap: 8px;
        }

        .sort-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 14px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          background: #e2e8f0;
          color: #334155;
        }

        .sort-link.active {
          background: #0f172a;
          color: #ffffff;
        }

        .tabs {
          margin-top: 18px;
          margin-bottom: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tab {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          background: #f1f5f9;
          color: #334155;
          text-decoration: none;
        }

        .tab.active {
          background: #0f172a;
          color: #ffffff;
        }

        .table-wrap {
          margin-top: 8px;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .container {
            padding: 20px 14px 40px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .page-title {
            font-size: 28px;
          }

          .toolbar {
            align-items: stretch;
          }

          .search-form {
            flex-direction: column;
          }

          .search-button {
            width: 100%;
          }

          .sort-actions {
            width: 100%;
          }

          .sort-link {
            flex: 1 1 0;
          }
        }
      `}</style>
    </main>
  );
}