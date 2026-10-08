-- JHADINA-DAW.2: one revision-fenced edit document shared by laptop and
-- landscape phone/tablet. This does not approve a VST binary or alter source.
create table if not exists public.music_daw_sessions (
  case_id text primary key references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision >= 1),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  mutation_id text not null,
  updated_at timestamptz not null default now()
);
create index if not exists music_daw_sessions_owner_idx
  on public.music_daw_sessions(owner_user_id, updated_at desc);

create table if not exists public.music_daw_edit_history (
  id bigserial primary key,
  case_id text not null references public.music_daw_sessions(case_id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision >= 1),
  mutation_id text not null,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_at timestamptz not null default now(),
  unique(case_id, revision),
  unique(case_id, mutation_id)
);
create index if not exists music_daw_edit_history_owner_idx
  on public.music_daw_edit_history(owner_user_id, case_id, revision desc);

alter table public.music_daw_sessions enable row level security;
alter table public.music_daw_sessions force row level security;
alter table public.music_daw_edit_history enable row level security;
alter table public.music_daw_edit_history force row level security;
revoke all on public.music_daw_sessions from public, anon, authenticated, service_role;
revoke all on public.music_daw_edit_history from public, anon, authenticated, service_role;
grant select on public.music_daw_sessions to service_role;
grant select on public.music_daw_edit_history to service_role;
grant usage, select on sequence public.music_daw_edit_history_id_seq to service_role;

-- Authoritative atomic compare-and-swap. An API caller cannot write SQL rows
-- directly; server validates every edit/source hash before invoking the RPC.
create or replace function public.save_music_daw_session(
  p_case_id text, p_owner_user_id uuid, p_expected_revision bigint,
  p_mutation_id text, p_document jsonb
)
returns public.music_daw_sessions
language plpgsql security definer set search_path = public
as $$
declare
  owner uuid;
  old public.music_daw_sessions%rowtype;
  result public.music_daw_sessions%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'MUSIC_DAW_SERVICE_ROLE_REQUIRED';
  end if;
  if coalesce(trim(p_case_id), '') = '' or p_owner_user_id is null or
     coalesce(trim(p_mutation_id), '') = '' or length(p_mutation_id)>240 or
     p_expected_revision is null or p_expected_revision < 0 or
     jsonb_typeof(p_document) <> 'object' or
     p_document->>'caseId' is distinct from p_case_id or
     p_document->>'schemaVersion' is distinct from 'jhadina-music-daw/v1' then
    raise exception 'MUSIC_DAW_SAVE_INPUT_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('music-daw:'||p_case_id, 0));
  select user_id into owner from public.music_restoration_cases
    where id = p_case_id;
  if owner is distinct from p_owner_user_id then
    raise exception 'MUSIC_DAW_CASE_OWNER_MISMATCH';
  end if;
  select * into old from public.music_daw_sessions
    where case_id=p_case_id for update;
  if found then
    if old.owner_user_id <> p_owner_user_id then
      raise exception 'MUSIC_DAW_OWNER_MISMATCH';
    end if;
    if old.mutation_id = p_mutation_id then
      return old;
    end if;
    if old.revision <> p_expected_revision then
      raise exception 'MUSIC_DAW_REVISION_CONFLICT';
    end if;
    update public.music_daw_sessions set
      revision=old.revision+1,
      document=jsonb_set(p_document,'{revision}',to_jsonb(old.revision+1)),
      mutation_id=p_mutation_id, updated_at=now()
    where case_id=p_case_id returning * into result;
  else
    if p_expected_revision<>0 then
      raise exception 'MUSIC_DAW_REVISION_CONFLICT';
    end if;
    insert into public.music_daw_sessions(
      case_id,owner_user_id,revision,document,mutation_id
    ) values (
      p_case_id,p_owner_user_id,1,
      jsonb_set(p_document,'{revision}','1'::jsonb),p_mutation_id
    ) returning * into result;
  end if;
  insert into public.music_daw_edit_history(
    case_id,owner_user_id,revision,mutation_id,document
  ) values (result.case_id,result.owner_user_id,result.revision,p_mutation_id,result.document);
  return result;
end;
$$;
revoke all on function public.save_music_daw_session(text,uuid,bigint,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.save_music_daw_session(text,uuid,bigint,text,jsonb)
  to service_role;
