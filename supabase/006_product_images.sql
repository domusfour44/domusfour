-- Execute once in Supabase SQL Editor before deploying the product gallery.
alter table public.products add column if not exists images text[] not null default '{}';
alter table public.products drop constraint if exists products_images_limit;
alter table public.products add constraint products_images_limit check (cardinality(images) <= 8);

-- Public product photos. Uploads are authorized only by the backend's secret key.
-- No INSERT/UPDATE/DELETE policy is granted to anon or authenticated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
