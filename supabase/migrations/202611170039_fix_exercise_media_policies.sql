-- GP-FIX-01: disambiguate the Storage object path from public.groups.name.
begin;

drop policy if exists exercise_media_read on storage.objects;
drop policy if exists exercise_media_insert on storage.objects;

create policy exercise_media_read on storage.objects
for select to authenticated
using (
  storage.objects.bucket_id = 'exercise-media'
  and exists (
    select 1
    from public.groups g
    where g.organization_id = (storage.foldername(storage.objects.name))[1]::uuid
      and private.has_training_permission(g.id, 'templates.view')
  )
);

create policy exercise_media_insert on storage.objects
for insert to authenticated
with check (
  storage.objects.bucket_id = 'exercise-media'
  and exists (
    select 1
    from public.groups g
    where g.organization_id = (storage.foldername(storage.objects.name))[1]::uuid
      and private.has_training_permission(g.id, 'templates.edit')
  )
);

commit;
