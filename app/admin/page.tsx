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

const styles = {
  pageShell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(37, 99, 235, 0.08), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #eef4ff 40%, #f8fafc 100%)",
    color: "#0f172a",
  } as const,
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "32px 20px 56px",
  } as const,
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  } as const,
  eyebrow: {
    margin: "0 0 6px",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#2563eb",
  } as const,
  pageTitle: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.02,
    letterSpacing: "-0.03em",
  } as const,
  pageCopy: {
    margin: "10px 0 0",
    fontSize: "16px",
    lineHeight: 1.65,
    color: "#475569",
  } as const,
  topActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  } as const,
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "14px",
    background: "#ffffff",
    border: "1px solid #dbe7f5",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
  } as const,
  statsGrid: {
    marginTop: "22px",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
  } as const,
  statCard: {
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
  } as const,
  statLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  } as const,
  statValue: {
    display: "block",
    marginTop: "10px",
    fontSize: "28px",
    lineHeight: 1,
    letterSpacing: "-0.03em",
    color: "#0f172a",
  } as const,
  toolbar: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  } as const,
  searchForm: {
    display: "flex",
    gap: "10px",
    flex: "1 1 460px",
    flexWrap: "wrap",
  } as const,
  searchInput: {
    flex: "1 1 280px",
    minHeight: "48px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    font: "inherit",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
  } as const,
  searchButton: {
    minHeight: "48px",
    border: 0,
    borderRadius: "14px",
    padding: "0 16px",
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#ffffff",
    font: "inherit",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(37, 99, 235, 0.2)",
  } as const,
  sortActions: {
    display: "flex",
    gap: "8px",
  } as const,
  sortLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    padding: "0 14px",
    borderRadius: "999px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    background: "#e2e8f0",
    color: "#334155",
  } as const,
  sortLinkActive: {
    background: "#0f172a",
    color: "#ffffff",
  } as const,
  tabs: {
    marginTop: "18px",
    marginBottom: "18px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  } as const,
  tab: {
    padding: "8px 14px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 600,
    background: "#f1f5f9",
    color: "#334155",
    textDecoration: "none",
  } as const,
  tabActive: {
    background: "#0f172a",
    color: "#ffffff",
  } as const,
  tableWrap: {
    marginTop: "8px",
  } as const,
};

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

  const responsiveCss = `
    @media (max-width: 1024px) {
      .admin-stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }

    @media (max-width: 720px) {
      .admin-container {
        padding: 20px 14px 40px !important;
      }

      .admin-stats-grid {
        grid-template-columns: 1fr !important;
      }

      .admin-page-title {
        font-size: 28px !important;
      }

      .admin-toolbar {
        align-items: stretch !important;
      }

      .admin-search-form {
        flex-direction: column !important;
      }

      .admin-search-button {
        width: 100% !important;
      }

      .admin-sort-actions {
        width: 100% !important;
      }

      .admin-sort-link {
        flex: 1 1 0 !important;
      }
    }
  `;

  return (
    <main style={styles.pageShell}>
      <div className="admin-container" style={styles.container}>
        <div style={styles.topRow}>
          <div>
            <p style={styles.eyebrow}>Boostle Support</p>
            <h1 className="admin-page-title" style={styles.pageTitle}>
              Ticket Dashboard
            </h1>
            <p style={styles.pageCopy}>
              View, filter, and open support tickets submitted from
              app.boostle.pro.
            </p>
          </div>

          <div style={styles.topActions}>
            <Link href="/" style={styles.secondaryLink}>
              Open support form
            </Link>
          </div>
        </div>

        <div className="admin-stats-grid" style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Total tickets</span>
            <strong style={styles.statValue}>
              {counts.open + counts.in_progress + counts.closed}
            </strong>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>Open</span>
            <strong style={styles.statValue}>{counts.open}</strong>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>In progress</span>
            <strong style={styles.statValue}>{counts.in_progress}</strong>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>Needs attention</span>
            <strong style={styles.statValue}>{needsAttentionCount}</strong>
          </div>
        </div>

        <div className="admin-toolbar" style={styles.toolbar}>
          <form method="get" className="admin-search-form" style={styles.searchForm}>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search name, email, or subject"
              style={styles.searchInput}
            />
            <input type="hidden" name="sort" value={sort} />
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <button
              type="submit"
              className="admin-search-button"
              style={styles.searchButton}
            >
              Search
            </button>
          </form>

          <div className="admin-sort-actions" style={styles.sortActions}>
            <Link
              href={buildAdminUrl({
                q: q || undefined,
                status: status === "all" ? undefined : status,
                sort: "newest",
              })}
              className="admin-sort-link"
              style={{
                ...styles.sortLink,
                ...(sort === "newest" ? styles.sortLinkActive : {}),
              }}
            >
              Newest
            </Link>

            <Link
              href={buildAdminUrl({
                q: q || undefined,
                status: status === "all" ? undefined : status,
                sort: "oldest",
              })}
              className="admin-sort-link"
              style={{
                ...styles.sortLink,
                ...(sort === "oldest" ? styles.sortLinkActive : {}),
              }}
            >
              Oldest
            </Link>
          </div>
        </div>

        <div style={styles.tabs}>
          {tabs.map((tab) => {
            const active = tab === status;

            return (
              <Link
                key={tab}
                href={getTabHref({ activeStatus: tab, q, sort })}
                style={{
                  ...styles.tab,
                  ...(active ? styles.tabActive : {}),
                }}
              >
                {getTabLabel(tab)} ({getCountForStatus(tab, counts)})
              </Link>
            );
          })}
        </div>

        <div style={styles.tableWrap}>
          <TicketsTable tickets={tickets} returnTo={returnTo} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />
    </main>
  );
}