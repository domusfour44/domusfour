create table if not exists public.contact_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  request_key uuid not null unique,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  phone text not null default '',
  reason text not null,
  message text not null check (char_length(message) between 1 and 3000),
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed')),
  telegram_status text not null default 'pending' check (telegram_status in ('pending','sent','failed','skipped')),
  created_at timestamptz not null default now()
);
create index if not exists contact_tickets_created_idx on public.contact_tickets (created_at desc);
alter table public.contact_tickets enable row level security;
revoke all on public.contact_tickets from anon, authenticated;
grant select, insert, update, delete on public.contact_tickets to service_role;
revoke all on sequence public.contact_tickets_ticket_number_seq from anon, authenticated;
grant usage, select on sequence public.contact_tickets_ticket_number_seq to service_role;
notify pgrst, 'reload schema';
