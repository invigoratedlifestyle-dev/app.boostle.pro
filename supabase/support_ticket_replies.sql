create table if not exists public.support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  body text not null,
  sent_to text not null,
  sent_by text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists support_ticket_replies_ticket_id_idx
  on public.support_ticket_replies(ticket_id);

notify pgrst, 'reload schema';