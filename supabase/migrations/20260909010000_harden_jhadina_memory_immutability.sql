-- Harden Memory Core audit/state boundaries.
-- Reasoning and timeline events are append-only: application roles must not
-- be able to mutate or delete historical audit records.

alter table public.jhadina_reasoning_events
  add constraint jhadina_reasoning_events_candidate_fk
  foreign key (candidate_id)
  references public.jhadina_memory_candidates(id)
  on delete set null;

alter table public.jhadina_timeline_events
  add constraint jhadina_timeline_reasoning_fk
  foreign key (reasoning_event_id)
  references public.jhadina_reasoning_events(id)
  on delete set null;

alter table public.jhadina_timeline_events
  add constraint jhadina_timeline_memory_fk
  foreign key (memory_id)
  references public.jhadina_memories(id)
  on delete set null;

-- Audit rows are immutable once written. The service-role policy remains
-- necessary for inserts, but UPDATE/DELETE are explicitly rejected by a
-- database trigger so application bugs cannot rewrite history.
create or replace function public.jhadina_reject_audit_mutation()
returns trigger
language plpgsql
security invoker
as $$
begin
  raise exception 'JHADINA_AUDIT_IMMUTABLE:%', TG_TABLE_NAME;
end;
$$;

 drop trigger if exists jhadina_reasoning_events_immutable on public.jhadina_reasoning_events;
create trigger jhadina_reasoning_events_immutable
before update or delete on public.jhadina_reasoning_events
for each row execute function public.jhadina_reject_audit_mutation();

 drop trigger if exists jhadina_timeline_events_immutable on public.jhadina_timeline_events;
create trigger jhadina_timeline_events_immutable
before update or delete on public.jhadina_timeline_events
for each row execute function public.jhadina_reject_audit_mutation();
