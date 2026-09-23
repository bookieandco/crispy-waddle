-- PERSONALITY-MEMORY.FINAL: immutable Memory lifecycle.
--
-- Approved memory content is historical evidence. It is never edited in place.
-- Corrections append a new approved revision and retire the prior revision;
-- forgetting retires the active revision without deleting its audit lineage.

alter table public.jhadina_memories
  drop constraint if exists jhadina_memories_status_check;

alter table public.jhadina_memories
  add constraint jhadina_memories_status_check
  check (status in ('APPROVED', 'REJECTED', 'RETIRED'));

alter table public.jhadina_memories
  add column if not exists supersedes_memory_id text references public.jhadina_memories(id),
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text
    check (revocation_reason is null or revocation_reason in ('corrected', 'forgotten', 'retired'));

create index if not exists jhadina_memories_supersedes_idx
  on public.jhadina_memories (supersedes_memory_id)
  where supersedes_memory_id is not null;

alter table public.jhadina_timeline_events
  drop constraint if exists jhadina_timeline_events_type_check;

alter table public.jhadina_timeline_events
  add constraint jhadina_timeline_events_type_check
  check (type in ('REASONING', 'APPROVAL', 'REJECTION', 'CORRECTION', 'FORGET'));

alter table public.jhadina_timeline_events
  drop constraint if exists jhadina_timeline_events_decision_check;

alter table public.jhadina_timeline_events
  add constraint jhadina_timeline_events_decision_check
  check (decision is null or decision in ('APPROVED', 'REJECTED', 'RETIRED'));

create or replace function public.jhadina_retire_memory(
  p_memory_id text,
  p_user_id text,
  p_reason text,
  p_revoked_at timestamptz
)
returns public.jhadina_memories
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.jhadina_memories;
begin
  if p_reason not in ('corrected', 'forgotten', 'retired') then
    raise exception 'JHADINA_MEMORY_RETIRE_REASON_INVALID';
  end if;

  update public.jhadina_memories
  set status = 'RETIRED',
      revoked_at = p_revoked_at,
      revocation_reason = p_reason
  where id = p_memory_id
    and user_id = p_user_id
    and status = 'APPROVED'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'JHADINA_MEMORY_RETIRE_TARGET_INVALID';
  end if;
  return v_row;
end;
$$;

create or replace function public.jhadina_correct_memory(
  p_memory_id text,
  p_user_id text,
  p_new_memory_id text,
  p_content text,
  p_confidence numeric,
  p_reasoning_event_id text,
  p_corrected_at timestamptz
)
returns table(retired jsonb, replacement jsonb)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.jhadina_memories;
  v_new public.jhadina_memories;
begin
  select * into v_old
  from public.jhadina_memories
  where id = p_memory_id and user_id = p_user_id and status = 'APPROVED'
  for update;

  if v_old.id is null then
    raise exception 'JHADINA_MEMORY_CORRECTION_TARGET_INVALID';
  end if;
  if length(trim(p_content)) = 0 then
    raise exception 'JHADINA_MEMORY_CORRECTION_CONTENT_REQUIRED';
  end if;
  if p_confidence < 0 or p_confidence > 1 then
    raise exception 'JHADINA_MEMORY_CORRECTION_CONFIDENCE_INVALID';
  end if;

  update public.jhadina_memories
  set status = 'RETIRED',
      revoked_at = p_corrected_at,
      revocation_reason = 'corrected'
  where id = v_old.id
  returning * into v_old;

  insert into public.jhadina_memories (
    id, user_id, type, status, content, confidence, created_at, approved_at,
    reasoning_event_id, supersedes_memory_id
  ) values (
    p_new_memory_id, v_old.user_id, v_old.type, 'APPROVED', p_content,
    p_confidence, p_corrected_at, p_corrected_at, p_reasoning_event_id, v_old.id
  )
  returning * into v_new;

  return query select to_jsonb(v_old), to_jsonb(v_new);
end;
$$;

revoke all on function public.jhadina_retire_memory(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.jhadina_retire_memory(text, text, text, timestamptz) to service_role;
revoke all on function public.jhadina_correct_memory(text, text, text, text, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.jhadina_correct_memory(text, text, text, text, numeric, text, timestamptz) to service_role;
