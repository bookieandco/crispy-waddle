create table if not exists public.jhadina_evolution_run_ledger_head (
  singleton boolean primary key default true check (singleton),
  sequence bigint not null default 0,
  event_hash text,
  updated_at timestamptz not null default now()
);

insert into public.jhadina_evolution_run_ledger_head(singleton, sequence, event_hash)
values (true, 0, null)
on conflict (singleton) do nothing;

alter table public.jhadina_evolution_run_ledger enable row level security;
alter table public.jhadina_evolution_run_ledger_head enable row level security;

create policy "authenticated users can read evolution run events"
on public.jhadina_evolution_run_ledger for select to authenticated
using ((payload ->> 'actor_id')::uuid = auth.uid());

create policy "authenticated users can read evolution ledger head"
on public.jhadina_evolution_run_ledger_head for select to authenticated
using (true);

create index if not exists jhadina_evolution_run_ledger_run_sequence_idx
on public.jhadina_evolution_run_ledger(run_id, sequence);

create index if not exists jhadina_evolution_run_ledger_task_idx
on public.jhadina_evolution_run_ledger(task_id, occurred_at desc);

create index if not exists jhadina_evolution_run_ledger_type_idx
on public.jhadina_evolution_run_ledger(type, occurred_at desc);
