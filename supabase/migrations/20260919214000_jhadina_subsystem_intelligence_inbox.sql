-- JLLM-18M — immutable cross-subsystem intelligence handoff inbox.
-- This is a transport/evidence boundary only. It grants no subsystem capability,
-- approval, execution, publishing, financial, contact, or memory authority.

create table if not exists public.jhadina_subsystem_intelligence_inbox (
  id text primary key,
  actor_id text not null,
  subsystem text not null check (subsystem in (
    'sports-intelligence',
    'jhadina-media',
    'director-studio',
    'creative-engine',
    'overageos',
    'knowledge',
    'research'
  )),
  asset_id text not null references public.jhadina_intelligence_assets(id) on delete cascade,
  asset_ref text,
  media_type text,
  privacy_class text,
  content_sha256 text,
  evidence jsonb not null default '[]'::jsonb,
  uncertainty jsonb not null default '[]'::jsonb,
  intent text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (actor_id, subsystem, asset_id)
);

create index if not exists jhadina_subsystem_intelligence_inbox_actor_idx
  on public.jhadina_subsystem_intelligence_inbox (actor_id, created_at desc);

create index if not exists jhadina_subsystem_intelligence_inbox_subsystem_idx
  on public.jhadina_subsystem_intelligence_inbox (subsystem, created_at);

alter table public.jhadina_subsystem_intelligence_inbox enable row level security;

create policy jhadina_subsystem_intelligence_inbox_service_role_only
  on public.jhadina_subsystem_intelligence_inbox as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_subsystem_intelligence_inbox from anon, authenticated;
revoke update, delete on public.jhadina_subsystem_intelligence_inbox from service_role;
grant select, insert on public.jhadina_subsystem_intelligence_inbox to service_role;

create or replace function public.jhadina_subsystem_intelligence_inbox_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'JHADINA_SUBSYSTEM_INTELLIGENCE_INBOX_APPEND_ONLY';
end;
$$;

drop trigger if exists jhadina_subsystem_intelligence_inbox_no_update_delete
  on public.jhadina_subsystem_intelligence_inbox;
create trigger jhadina_subsystem_intelligence_inbox_no_update_delete
before update or delete on public.jhadina_subsystem_intelligence_inbox
for each row execute function public.jhadina_subsystem_intelligence_inbox_append_only();
