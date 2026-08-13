create table if not exists public.staffing_conversations (
  id text primary key,
  organization_id uuid not null,
  subject text,
  created_by text not null,
  created_at timestamptz not null
);

create table if not exists public.staffing_conversation_participants (
  conversation_id text not null references public.staffing_conversations(id) on delete cascade,
  organization_id uuid not null,
  participant_id text not null,
  created_at timestamptz not null,
  primary key (conversation_id, participant_id)
);

create table if not exists public.staffing_messages (
  id text primary key,
  conversation_id text not null references public.staffing_conversations(id) on delete cascade,
  organization_id uuid not null,
  sender_id text not null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null
);

create index if not exists staffing_messages_conversation_idx on public.staffing_messages (conversation_id, created_at asc);
create index if not exists staffing_conversations_org_idx on public.staffing_conversations (organization_id, created_at desc);

alter table public.staffing_conversations enable row level security;
alter table public.staffing_conversation_participants enable row level security;
alter table public.staffing_messages enable row level security;

create policy "staffing conversations organization access" on public.staffing_conversations for all using (public.placement_is_org_member(organization_id)) with check (public.placement_is_org_member(organization_id));
create policy "staffing participants organization access" on public.staffing_conversation_participants for all using (public.placement_is_org_member(organization_id)) with check (public.placement_is_org_member(organization_id));
create policy "staffing messages organization access" on public.staffing_messages for all using (public.placement_is_org_member(organization_id)) with check (public.placement_is_org_member(organization_id));
