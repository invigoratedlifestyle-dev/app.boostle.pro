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

type SearchParams = Promise<{
  q?: string;
  status?: string;
  sort?: string;
}>;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRoleKey);
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
  if (status === "all") {
    return "All";
  }

  if (status === "in_progress") {
    return "In progress";
  }

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
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = normaliseStatus(params.status);
  const sort = normaliseSort(params.sort);

  const supabase = getSupabaseAdmin();

  let ticketsQuery = supabase
    .from("tickets")
    .select("id, name, email, subject, message, status, created_at");

  if (status !== "all") {
    ticketsQuery = ticketsQuery.eq("status", status);
  }

  if (q) {
    const escapedQ = q.replace(/,/g, "\\,");

    ticketsQuery = ticketsQuery.or(
      [
        `name.ilike.%${escapedQ}%`,
        `email.ilike.%${escapedQ}%`,
        `subject.ilike.%${escapedQ}%`,
        `message.ilike.%${escapedQ}%`,
      ].join(","),
    );
  }

  ticketsQuery = ticketsQuery.order("created_at", {
    ascending: sort === "oldest",
  });

  const [ticketsResult, openCountResult, inProgressCountResult, closedCountResult] =
    await Promise.all([
      ticketsQuery,
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "closed"),
    ]);

  if (ticketsResult.error) {
    throw new Error(ticketsResult.error.message);
  }

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">
              Boostle Support
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Ticket Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Triage incoming tickets, filter fast, and update statuses in bulk.
            </p>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total tickets</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{totalCount}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Open</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">
              {counts.open}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">In progress</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">
              {counts.in_progress}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Closed</p>
            <p className="mt-2 text-3xl font-semibold text-slate-700">
              {counts.closed}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = tab === status;

              return (
                <Link
                  key={tab}
                  href={getTabHref({
                    activeStatus: tab,
                    q,
                    sort,
                  })}
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  ].join(" ")}
                >
                  <span>{getTabLabel(tab)}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs",
                      active ? "bg-white/15 text-white" : "bg-white text-slate-600",
                    ].join(" ")}
                  >
                    {getCountForStatus(tab, counts)}
                  </span>
                </Link>
              );
            })}
          </div>

          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_120px]">
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}

            <div>
              <label
                htmlFor="q"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Search name, email, subject, or message..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="sort"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Sort
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <TicketsTable tickets={tickets} returnTo={returnTo} />
      </div>
    </main>
  );
}