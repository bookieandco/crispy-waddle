-- JH-SPINE.FINAL.03: durable, action-bound receipts for the shared Growth /
-- Intelligence governance path. This migration does not replace domain stores
-- already owned by Money, Commerce, or Social.
--
-- Explicit grants: newer Supabase Data API grants are not implicit for newly
-- created public tables. Table writes are never directly granted to clients.
-- All state transitions are atomic and bind to auth.uid() on the database.

create table if not exists public.jhadina_action_approval_receipts (
  id uuid primary key default gen_random_uuid(),
  action_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  fingerprint text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'consumed', 'expired')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists jhadina_action_receipts_owner_status_idx
  on public.jhadina_action_approval_receipts (user_id, status, expires_at);
create index if not exists jhadina_action_receipts_action_idx
  on public.jhadina_action_approval_receipts (action_id);

alter table public.jhadina_action_approval_receipts enable row level security;

-- Rerunnable without erasing or opening wider existing policies.
drop policy if exists "action receipts owner read only" on public.jhadina_action_approval_receipts;
create policy "action receipts owner read only"
  on public.jhadina_action_approval_receipts
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.jhadina_action_approval_receipts from public, anon, authenticated;
grant select on public.jhadina_action_approval_receipts to authenticated;

-- SECURITY DEFINER is required because clients have no INSERT/UPDATE grant.
-- Every entry point validates the session subject and exact owner. Avoid
-- search_path hijacking; call objects with explicit schemas.
create or replace function public.jhadina_action_create_approval_receipt(
  p_action_id text,
  p_user_id uuid,
  p_type text,
  p_fingerprint text,
  p_expires_at timestamptz
)
returns public.jhadina_action_approval_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.jhadina_action_approval_receipts;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'approval receipt identity mismatch';
  end if;
  if p_action_id is null or length(p_action_id) = 0
    or p_type is null or length(p_type) = 0
    or p_fingerprint is null or length(p_fingerprint) = 0
    or p_expires_at is null or p_expires_at <= now()
    or p_expires_at > now() + interval '15 minutes'
  then
    raise exception 'approval receipt binding or expiry invalid';
  end if;

  insert into public.jhadina_action_approval_receipts (
    action_id, user_id, type, fingerprint, expires_at
  )
  values (p_action_id, p_user_id, p_type, p_fingerprint, p_expires_at)
  returning * into receipt;
  return receipt;
end;
$$;

create or replace function public.jhadina_action_approve_receipt(
  p_receipt_id uuid,
  p_user_id uuid
)
returns public.jhadina_action_approval_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.jhadina_action_approval_receipts;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'approval receipt identity mismatch';
  end if;
  update public.jhadina_action_approval_receipts
  set status = 'approved', approved_at = now()
  where id = p_receipt_id
    and user_id = p_user_id
    and status = 'pending'
    and expires_at > now()
  returning * into receipt;
  if receipt.id is null then
    raise exception 'approval receipt cannot be approved';
  end if;
  return receipt;
end;
$$;

create or replace function public.jhadina_action_consume_receipt(
  p_receipt_id uuid,
  p_action_id text,
  p_user_id uuid,
  p_type text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  rows_changed integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return false;
  end if;
  update public.jhadina_action_approval_receipts
  set status = 'consumed', consumed_at = now()
  where id = p_receipt_id
    and action_id = p_action_id
    and user_id = p_user_id
    and type = p_type
    and fingerprint = p_fingerprint
    and status = 'approved'
    and expires_at > now();
  get diagnostics rows_changed = row_count;
  return rows_changed = 1;
end;
$$;

-- PostgreSQL defaults function EXECUTE to PUBLIC. Undo that explicitly.
revoke execute on function public.jhadina_action_create_approval_receipt(text,uuid,text,text,timestamptz)
  from public, anon, authenticated;
revoke execute on function public.jhadina_action_approve_receipt(uuid,uuid)
  from public, anon, authenticated;
revoke execute on function public.jhadina_action_consume_receipt(uuid,text,uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.jhadina_action_create_approval_receipt(text,uuid,text,text,timestamptz)
  to authenticated;
grant execute on function public.jhadina_action_approve_receipt(uuid,uuid)
  to authenticated;
grant execute on function public.jhadina_action_consume_receipt(uuid,text,uuid,text,text)
  to authenticated;
