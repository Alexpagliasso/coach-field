-- GP-UX-06C: optional field dimensions for exercise technical sheets.
begin;

alter table public.exercise_library_items
  add column if not exists field_width_m numeric(6,2)
    check (field_width_m is null or field_width_m > 0),
  add column if not exists field_length_m numeric(6,2)
    check (field_length_m is null or field_length_m > 0);

commit;
