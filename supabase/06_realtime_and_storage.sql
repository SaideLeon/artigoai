-- =============================================================================
-- 06. Realtime e Bucket de Storage para Imagens de Artigos
-- Dependências: 01 e 02
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'articles'
  ) then
    alter publication supabase_realtime add table public.articles;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table public.user_settings;
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "article_images_public_read" on storage.objects;
create policy "article_images_public_read"
  on storage.objects for select
  using (bucket_id = 'article-images');

drop policy if exists "article_images_owner_write" on storage.objects;
create policy "article_images_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'article-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "article_images_owner_update" on storage.objects;
create policy "article_images_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'article-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'article-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "article_images_owner_delete" on storage.objects;
create policy "article_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'article-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
