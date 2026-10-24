create table if not exists public.products (
 id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'), name text not null,
 category text not null check(category in ('santi','calcio')),
 price numeric(10,2) not null check(price >= 0 and price <= 100000),
 image text not null, description text not null default '', details text not null default '',
 badge text not null default '', purchase_url text not null default '',
 active boolean not null default true, featured boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select, insert, update, delete on public.products to service_role;
-- Access is exclusively through the server: no public write policy.
insert into public.products (id,name,category,price,image,description,details,badge,purchase_url,active,featured) values
('d10s-oro','D10S','calcio',16.99,'assets/img/maradonaOro.jpeg','Diego Armando, il Numero 10.','','','https://www.vinted.it/member/253373573',true,true),
('san-gennaro-oro','San Gennaro','santi',14.99,'assets/img/sanGennaroOro.jpeg','Il patrono della città più bella del mondo.','','','https://www.vinted.it/member/253373573',true,true)
on conflict (id) do nothing;
