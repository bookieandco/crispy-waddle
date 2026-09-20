-- JLLM-18R — quarantine orphan discovery + durable cleanup receipts.
-- Orphans are storage objects whose actor/session path has no durable upload
-- session. A six-hour grace period prevents races with session issuance.

create table if not exists public.jhadina_quarantine_cleanup_receipts (
  id bigint generated always as identity primary key,
  object_path text not null,
  reason text not null check (reason in ('session_terminal','orphan')),
  session_id uuid,
  cleaned_at timestamptz not null default clock_timestamp(),
  unique (object_path, reason)
);

alter table public.jhadina_quarantine_cleanup_receipts enable row level security;
revoke all on public.jhadina_quarantine_cleanup_receipts from public, anon, authenticated;
grant select, insert on public.jhadina_quarantine_cleanup_receipts to service_role;

create or replace function public.list_jhadina_orphan_quarantine_objects(
  p_limit integer
)
returns table(object_path text)
language sql security definer set search_path = public, storage
as $$
  select o.name::text
    from storage.objects o
   where o.bucket_id = 'jhadina-intake-private'
     and o.name like 'quarantine/%'
     and o.created_at <= clock_timestamp() - interval '6 hours'
     and not exists (
       select 1
         from public.jhadina_upload_sessions s
        where s.quarantine_path = o.name
     )
   order by o.created_at asc
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke execute on function public.list_jhadina_orphan_quarantine_objects(integer)
  from public, anon, authenticated;
grant execute on function public.list_jhadina_orphan_quarantine_objects(integer)
  to service_role;
