-- Additional staff accounts, independent from future customer authentication.
begin;
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  email text not null unique check (email = lower(email) and length(email) <= 254),
  password_hash text not null check (password_hash ~ '^[0-9a-f]{128}$'),
  password_salt text not null check (password_salt ~ '^[0-9a-f]{32}$'),
  session_version uuid not null default gen_random_uuid(),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select, insert, update on public.admin_users to service_role;
notify pgrst, 'reload schema';
commit;
