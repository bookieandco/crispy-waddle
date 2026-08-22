create table if not exists public.jhadina_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  request_id text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  domain text not null,
  capability text not null,
  decision text not null check (decision in ('allow','deny','approval_required')),
  occurred_at timestamptz not null default now(),
  previous_hash text not null,
  event_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_audit_ledger_occurred_at_idx on public.jhadina_audit_ledger (occurred_at desc);
create index if not exists jhadina_audit_ledger_actor_idx on public.jhadina_audit_ledger (actor_id, occurred_at desc);

create table if not exists public.jhadina_audit_ledger_head (
  id boolean primary key default true check (id = true),
  head_hash text not null default 'GENESIS',
  event_count bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.jhadina_audit_ledger_head (id) values (true) on conflict (id) do nothing;

create or replace function public.prevent_jhadina_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'JHADINA_AUDIT_APPEND_ONLY';
end;
$$;

drop trigger if exists jhadina_audit_no_update on public.jhadina_audit_ledger;
drop trigger if exists jhadina_audit_no_delete on public.jhadina_audit_ledger;
create trigger jhadina_audit_no_update before update on public.jhadina_audit_ledger for each row execute function public.prevent_jhadina_audit_mutation();
create trigger jhadina_audit_no_delete before delete on public.jhadina_audit_ledger for each row execute function public.prevent_jhadina_audit_mutation();

alter table public.jhadina_audit_ledger enable row level security;
drop policy if exists "users can read own jhadina audit events" on public.jhadina_audit_ledger;
create policy "users can read own jhadina audit events"
  on public.jhadina_audit_ledger for select to authenticated using (auth.uid() = actor_id);

revoke insert, update, delete on public.jhadina_audit_ledger from anon, authenticated;
revoke all on public.jhadina_audit_ledger_head from anon, authenticated;
