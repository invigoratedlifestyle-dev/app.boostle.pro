-- Enable helpful extension for UUID generation
create extension if not exists pgcrypto;

-- Ticket status enum
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'support_ticket_status'
  ) then
    create type public.support_ticket_status as enum (
      'open',
      'in_progress',
      'waiting_on_customer',
      'resolved',
      'closed'
    );
  end if;
end
$$;

-- Ticket priority enum
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'support_ticket_priority'
  ) then
    create type public.support_ticket_priority as enum (
      'low',
      'normal',
      'high',
      'urgent'
    );
  end if;
end
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),

  ticket_number bigint generated always as identity unique,

  name text not null,
  email text not null,
  subject text not null,
  message text not null,

  status public.support_ticket_status not null default 'open',
  priority public.support_ticket_priority not null default 'normal',

  source text not null default 'website',
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_created_at_idx
  on public.support_tickets (created_at desc);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status);

create index if not exists support_tickets_priority_idx
  on public.support_tickets (priority);

create index if not exists support_tickets_email_idx
  on public.support_tickets (email);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;

create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row
execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

-- Admin/server access only for MVP.
-- We are intentionally not granting public insert/select here.
-- All reads/writes happen through your Next.js server using the service role key.

drop policy if exists "No direct anon access to support tickets" on public.support_tickets;

create policy "No direct anon access to support tickets"
on public.support_tickets
for all
to anon, authenticated
using (false)
with check (false);