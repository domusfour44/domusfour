-- Run in the Supabase SQL Editor before deploying category management.
begin;
create table if not exists public.categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null check (char_length(trim(name)) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_unique on public.categories (lower(trim(name)));
alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;
grant select, insert, update, delete on public.categories to service_role;
insert into public.categories (id, name) values ('santi', 'Santi'), ('calcio', 'Calcio')
on conflict (id) do nothing;
-- Preserve existing product references, without restoring removed categories.
insert into public.categories (id, name, active)
select distinct category, initcap(replace(category, '-', ' ')), category not in ('maschere', 'fortuna')
from public.products
on conflict (id) do nothing;
alter table public.products drop constraint if exists products_category_check;
alter table public.products drop constraint if exists products_category_fkey;
alter table public.products add constraint products_category_fkey
  foreign key (category) references public.categories(id);
notify pgrst, 'reload schema';
commit;
