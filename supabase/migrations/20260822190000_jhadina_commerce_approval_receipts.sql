-- Jhadina Commerce: durable, explicit human approval receipts.
-- No money-moving operation may auto-approve through this table.

create table if not exists public.jhadina_commerce_approval_receipts (
  id uuid primary key default gen_random_uuid(),
  action_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  fingerprint text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'consumed', 'expired')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_commerce_approval_receipts_user_status_idx
  on public.jhadina_commerce_approval_receipts (user_id, status, expires_at desc);

create index if not exists jhadina_commerce_approval_receipts_action_idx
  on public.jhadina_commerce_approval_receipts (action_id);

alter table public.jhadina_commerce_approval_receipts enable row level security;

create policy "commerce approval receipts are owner readable"
  on public.jhadina_commerce_approval_receipts
  for select
  using (auth.uid() = user_id);

create or replace function public.jhadina_commerce_create_approval_receipt(
  p_action_id text,
  p_type text,
  p_fingerprint text,
  p_expires_at timestamptz
)
returns public.jhadina_commerce_approval_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.jhadina_commerce_approval_receipts;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.jhadina_commerce_approval_receipts (
    action_id, user_id, type, fingerprint, expires_at
  )
  values (
    p_action_id, auth.uid(), p_type, p_fingerprint, p_expires_at
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.jhadina_commerce_approve_receipt(
  p_receipt_id uuid
)
returns public.jhadina_commerce_approval_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.jhadina_commerce_approval_receipts;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.jhadina_commerce_approval_receipts
     set status = 'approved', approved_at = now()
   where id = p_receipt_id
     and user_id = auth.uid()
     and status = 'pending'
     and expires_at > now()
  returning * into result;

  if result.id is null then
    raise exception 'approval receipt cannot be approved';
  end if;

  return result;
end;
$$;

create or replace function public.jhadina_commerce_consume_approval_receipt(
  p_receipt_id uuid,
  p_action_id text,
  p_type text,
  p_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  consumed boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.jhadina_commerce_approval_receipts
     set status = 'consumed', consumed_at = now()
   where id = p_receipt_id
     and user_id = auth.uid()
     and action_id = p_action_id
     and type = p_type
     and fingerprint = p_fingerprint
     and status = 'approved'
     and expires_at > now()
  returning true into consumed;

  if consumed is null then
    update public.jhadina_commerce_approval_receipts
       set status = 'expired'
     where id = p_receipt_id
       and user_id = auth.uid()
       and status = 'approved'
       and expires_at <= now();
    return false;
  end if;

  return consumed;
end;
$$;
