-- GP-UX-06: private cover images and explanatory GIFs for exercise library items.
begin;

alter table public.exercise_library_items
  add column if not exists cover_image_path text,
  add column if not exists explanation_gif_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exercise-media','exercise-media',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy exercise_media_read on storage.objects for select to authenticated using (
  bucket_id='exercise-media' and exists(
    select 1 from public.groups g
    where g.organization_id=(storage.foldername(name))[1]::uuid
      and private.has_training_permission(g.id,'templates.view')
  )
);
create policy exercise_media_insert on storage.objects for insert to authenticated with check (
  bucket_id='exercise-media' and exists(
    select 1 from public.groups g
    where g.organization_id=(storage.foldername(name))[1]::uuid
      and private.has_training_permission(g.id,'templates.edit')
  )
);

commit;

-- Verification: bucket is private and the two paths are nullable.
-- select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='exercise-media';
-- select column_name,is_nullable from information_schema.columns where table_schema='public'
--   and table_name='exercise_library_items' and column_name in ('cover_image_path','explanation_gif_path');
