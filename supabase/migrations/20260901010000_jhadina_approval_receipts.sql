create table if not exists public.jhadina_approval_receipt (
  id uuid primary key,
  action_id text not null,
  user_id text not null,
  type text not null,
  fingerprint text not null,
  status text not null check (status in ('pending', 'approved', 'consumed', 'expired')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists jhadina_approval_receipt_user_status_idx
  on public.jhadina_approval_receipt (user_id, status, expires_at);

create or replace function public.create_jhadina_approval_receipt(
  p_action_id text,
  p_user_id text,
  p_type text,
  p_fingerprint text,
  p_expires_at timestamptz
)
returns public.jhadina_approval_receipt
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.jhadina_approval_receipt;
begin
  if auth.uid() is null or auth.uid()::text <> p_user_id then
    raise exception 'APPROVAL_RECEIPT_ACTOR_MISMATCH';
  end if;
  if p_action_id is null or p_user_id is null or p_type is null or p_fingerprint is null then
    raise exception 'APPROVAL_RECEIPT_INPUT_INVALID';
  end if;
  if p_expires_at <= now() then
    raise exception 'APPROVAL_RECEIPT_ALREADY_EXPIRED';
  end if;
  if p_expires_at > now() + interval '5 minutes' then
    raise exception 'APPROVAL_RECEIPT_TTL_TOO_LONG';
  end if;

  insert into public.jhadina_approval_receipt
    (id, action_id, user_id, type, fingerprint, status, requested_at, expires_at)
  values
    (gen_random_uuid(), p_action_id, p_user_id, p_type, p_fingerprint, 'pending', now(), p_expires_at)
  returning * into result;

  return result;
end;
$$;

create or replace function public.approve_jhadina_approval_receipt(
  p_receipt_id uuid,
  p_user_id text
)
returns public.jhadina_approval_receipt
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.jhadina_approval_receipt;
begin
  if auth.uid() is null or auth.uid()::text <> p_user_id then
    raise exception 'APPROVAL_RECEIPT_ACTOR_MISMATCH';
  end if;

  update public.jhadina_approval_receipt
  set status = 'approved', approved_at = now()
  where id = p_receipt_id
    and user_id = p_user_id
    and status = 'pending'
    and expires_at > now()
  returning * into result;

  if not found then
    update public.jhadina_approval_receipt
    set status = 'expired'
    where id = p_receipt_id
      and user_id = p_user_id
      and status in ('pending', 'approved')
      and expires_at <= now();
    return null;
  end if;

  return result;
end;
$$;

create or replace function public.consume_jhadina_approval_receipt(
  p_receipt_id uuid,
  p_action_id text,
  p_user_id text,
  p_type text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed_id uuid;
begin
  if auth.uid() is null or auth.uid()::text <> p_user_id then
    raise exception 'APPROVAL_RECEIPT_ACTOR_MISMATCH';
  end if;

  update public.jhadina_approval_receipt
  set status = 'consumed', consumed_at = now()
  where id = p_receipt_id
    and action_id = p_action_id
    and user_id = p_user_id
    and type = p_type
    and fingerprint = p_fingerprint
    and status = 'approved'
    and expires_at > now()
  returning id into consumed_id;

  if consumed_id is not null then
    return true;
  end if;

  update public.jhadina_approval_receipt
  set status = 'expired'
  where id = p_receipt_id
    and user_id = p_user_id
    and status = 'approved'
    and expires_at <= now();

  return false;
end;
$$;

revoke all on public.jhadina_approval_receipt from anon;
revoke all on function public.create_jhadina_approval_receipt(text, text, text, text, timestamptz) from public, anon;
revoke all on function public.approve_jhadina_approval_receipt(uuid, text) from public, anon;
revoke all on function public.consume_jhadina_approval_receipt(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_jhadina_approval_receipt(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.approve_jhadina_approval_receipt(uuid, text) to authenticated;
grant execute on function public.consume_jhadina_approval_receipt(uuid, text, text, text, text) to authenticated;