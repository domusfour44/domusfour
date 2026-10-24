-- Evidence of the newsletter opt-in, without IP addresses or tracking pixels.
create table if not exists public.newsletter_consents (
  confirmation_id text primary key check (confirmation_id ~ '^[a-f0-9]{64}$'),
  email text not null,
  requested_at timestamptz not null,
  confirmed_at timestamptz not null default now(),
  privacy_version text not null,
  synced boolean not null default false
);
alter table public.newsletter_consents enable row level security;
revoke all on public.newsletter_consents from anon, authenticated;
grant select, insert, update, delete on public.newsletter_consents to service_role;
notify pgrst, 'reload schema';
