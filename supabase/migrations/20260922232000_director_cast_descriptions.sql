-- Add durable, editable human-authored character descriptions to the normalized Director Cast Bible.
-- Visual reference assets remain the identity authority; prose is supporting continuity guidance.

alter table public.director_cast_characters
  add column if not exists character_description text,
  add column if not exists appearance_description text,
  add column if not exists performance_notes text[] not null default '{}',
  add column if not exists description_revision integer not null default 1 check (description_revision >= 1),
  add column if not exists description_updated_at timestamptz,
  add column if not exists description_updated_by uuid references auth.users(id) on delete set null;

update public.director_cast_characters
set description_updated_at = coalesce(description_updated_at, approved_at),
    description_updated_by = coalesce(description_updated_by, approved_by)
where description_updated_at is null
   or description_updated_by is null;

create or replace function public.assert_director_cast_character_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  uid uuid;
  role_value text;
begin
  uid := coalesce(new.description_updated_by, new.approved_by, old.description_updated_by, old.approved_by);

  select role into role_value
  from public.director_project_memberships
  where project_id = coalesce(new.project_id, old.project_id)
    and user_id = uid;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director cast edit authority required';
  end if;

  return new;
end;
$$;

drop trigger if exists director_cast_authority_guard on public.director_cast_characters;
create trigger director_cast_authority_guard
before insert or update on public.director_cast_characters
for each row execute function public.assert_director_cast_character_authority();

comment on column public.director_cast_characters.character_description is
  'Human-authored narrative/personality description. Supporting guidance only; cannot replace approved visual identity references.';

comment on column public.director_cast_characters.appearance_description is
  'Human-authored visual description used together with canonical character reference assets.';

comment on column public.director_cast_characters.performance_notes is
  'Stable acting, mannerism, posture, movement and delivery notes for the character.';

comment on column public.director_cast_characters.description_revision is
  'Monotonic revision for human-authored Cast Bible description fields.';
