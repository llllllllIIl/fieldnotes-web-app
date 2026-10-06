-- 002: covers + pinned. run after schema.sql.

alter table public.articles
  add column if not exists image_url text,
  add column if not exists pinned boolean not null default false;

-- public reads, admin writes
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = true;

drop policy if exists "article_images_public_read" on storage.objects;
create policy "article_images_public_read" on storage.objects
  for select using (bucket_id = 'article-images');

drop policy if exists "article_images_admin_write" on storage.objects;
create policy "article_images_admin_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'article-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "article_images_admin_update" on storage.objects;
create policy "article_images_admin_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'article-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "article_images_admin_delete" on storage.objects;
create policy "article_images_admin_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'article-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
