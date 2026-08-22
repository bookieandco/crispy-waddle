create extension if not exists pgcrypto with schema extensions;

create table if not exists public.jhadina_evolution_run_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  run_id bigint not null,
  sequence bigint not null,
  task_id text not null,
  type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  previous_hash text,
  hash text not null,
  created_at timestamptz not null default now(),
  constraint jhadina_evolution_run_ledger_event_id_key unique (event_id),
  constraint jhadina_evolution_run_ledger_run_sequence_key unique (run_id, sequence),
  constraint jhadina_evolution_run_ledger_type_check check (type in ('RUN_STARTED','RUN_DISPATCHED','RUN_VERIFIED','RUN_FAILED','RUN_BLOCKED','DRAFT_PR_CREATED')),
  constraint jhadina_evolution_run_ledger_sequence_check check (sequence > 0),
  constraint jhadina_evolution_run_ledger_hash_check check (length(hash) = 64)
);

create index if not exists jhadina_evolution_run_ledger_run_sequence_idx on public.jhadina_evolution_run_ledger (run_id, sequence);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.jhadina_evolution_run_ledger'::regclass and conname='jhadina_evolution_run_ledger_sequence_check') then
    alter table public.jhadina_evolution_run_ledger add constraint jhadina_evolution_run_ledger_sequence_check check (sequence > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.jhadina_evolution_run_ledger'::regclass and conname='jhadina_evolution_run_ledger_hash_check') then
    alter table public.jhadina_evolution_run_ledger add constraint jhadina_evolution_run_ledger_hash_check check (length(hash) = 64);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.jhadina_evolution_run_ledger'::regclass and conname='jhadina_evolution_run_ledger_hash_key') then
    alter table public.jhadina_evolution_run_ledger add constraint jhadina_evolution_run_ledger_hash_key unique (hash);
  end if;
end;
$$;

alter table public.jhadina_evolution_run_ledger enable row level security;
revoke all on table public.jhadina_evolution_run_ledger from anon, authenticated, public;
grant select on table public.jhadina_evolution_run_ledger to authenticated;
grant select on table public.jhadina_evolution_run_ledger to service_role;
revoke insert, update, delete, truncate on table public.jhadina_evolution_run_ledger from service_role;

drop policy if exists "authenticated users can read evolution run events" on public.jhadina_evolution_run_ledger;
create policy "authenticated users can read evolution run events" on public.jhadina_evolution_run_ledger for select to authenticated using ((payload ->> 'actor_id')::uuid = (select auth.uid()));

create or replace function public.reject_jhadina_evolution_run_ledger_mutation() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin raise exception 'jhadina evolution run ledger is append-only'; end; $$;
revoke all on function public.reject_jhadina_evolution_run_ledger_mutation() from public, anon, authenticated, service_role;

drop trigger if exists jhadina_evolution_run_ledger_no_update on public.jhadina_evolution_run_ledger;
create trigger jhadina_evolution_run_ledger_no_update before update on public.jhadina_evolution_run_ledger for each row execute function public.reject_jhadina_evolution_run_ledger_mutation();
drop trigger if exists jhadina_evolution_run_ledger_no_delete on public.jhadina_evolution_run_ledger;
create trigger jhadina_evolution_run_ledger_no_delete before delete on public.jhadina_evolution_run_ledger for each row execute function public.reject_jhadina_evolution_run_ledger_mutation();

create or replace function public.append_jhadina_evolution_run_ledger(p_run_id bigint,p_task_id text,p_type text,p_occurred_at timestamptz,p_payload jsonb) returns public.jhadina_evolution_run_ledger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_sequence bigint; v_previous_hash text; v_event_id text; v_hash text; v_row public.jhadina_evolution_run_ledger;
begin
  if p_run_id is null or p_task_id is null or p_type is null or p_occurred_at is null or p_payload is null then raise exception 'ledger append requires run_id, task_id, type, occurred_at, and payload'; end if;
  if p_type not in ('RUN_STARTED','RUN_DISPATCHED','RUN_VERIFIED','RUN_FAILED','RUN_BLOCKED','DRAFT_PR_CREATED') then raise exception 'invalid evolution ledger event type: %', p_type; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text,0));
  select coalesce(max(sequence),0)+1,(array_agg(hash order by sequence desc))[1] into v_sequence,v_previous_hash from public.jhadina_evolution_run_ledger where run_id=p_run_id;
  v_event_id:=p_run_id::text||':'||v_sequence::text;
  v_hash:=encode(extensions.digest(jsonb_build_object('runId',p_run_id,'taskId',p_task_id,'type',p_type,'occurredAt',p_occurred_at,'payload',p_payload,'sequence',v_sequence,'eventId',v_event_id,'previousHash',v_previous_hash)::text::bytea,'sha256'),'hex');
  insert into public.jhadina_evolution_run_ledger(run_id,sequence,event_id,task_id,type,occurred_at,payload,previous_hash,hash) values(p_run_id,v_sequence,v_event_id,p_task_id,p_type,p_occurred_at,p_payload,v_previous_hash,v_hash) returning * into v_row;
  return v_row;
end; $$;
revoke all on function public.append_jhadina_evolution_run_ledger(bigint,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.append_jhadina_evolution_run_ledger(bigint,text,text,timestamptz,jsonb) to service_role;

create or replace function public.verify_jhadina_evolution_run_ledger(p_run_id bigint) returns boolean language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare r record; v_expected_sequence bigint:=1; v_previous_hash text:=null; v_expected_hash text;
begin
  for r in select run_id,sequence,event_id,task_id,type,occurred_at,payload,previous_hash,hash from public.jhadina_evolution_run_ledger where run_id=p_run_id order by sequence loop
    if r.sequence<>v_expected_sequence then return false; end if;
    if r.event_id<>p_run_id::text||':'||r.sequence::text then return false; end if;
    if r.previous_hash is distinct from v_previous_hash then return false; end if;
    v_expected_hash:=encode(extensions.digest(jsonb_build_object('runId',r.run_id,'taskId',r.task_id,'type',r.type,'occurredAt',r.occurred_at,'payload',r.payload,'sequence',r.sequence,'eventId',r.event_id,'previousHash',r.previous_hash)::text::bytea,'sha256'),'hex');
    if r.hash<>v_expected_hash then return false; end if;
    v_previous_hash:=r.hash; v_expected_sequence:=v_expected_sequence+1;
  end loop;
  return true;
end; $$;
revoke all on function public.verify_jhadina_evolution_run_ledger(bigint) from public,anon,authenticated;
grant execute on function public.verify_jhadina_evolution_run_ledger(bigint) to service_role;
