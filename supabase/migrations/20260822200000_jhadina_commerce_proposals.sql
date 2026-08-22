-- Jhadina Commerce Phase 4.6: durable, human-approved commerce proposals.
--
-- A proposal is created PENDING, and only transitions to APPROVED through
-- an explicit human approval call (never automatically), then to EXECUTED
-- only once a matching, unexpired, single-use approval receipt is
-- consumed. No row in this table can move forward without both an
-- authenticated owner and, for the approved/executed transitions, a
-- pending/approved predecessor state — every transition is atomic and
-- enforced by the database, not by application code. There is no denial
-- transition here: a policy denial happens before any proposal row is
-- ever created (see proposeCommerceAction), so a PENDING row always
-- means "policy already allowed reaching this point."
--
-- There is no separate fingerprint column: the approval-receipt
-- fingerprint that binds a receipt to this exact proposal is always
-- deterministically recomputed from (id, capability, payload) at every
-- stage (see computeProposalFingerprint in commerce-proposal-lifecycle.ts)
-- rather than stored — a single source of truth, so it can never drift
-- from the content it is supposed to bind.
create table if not exists public.jhadina_commerce_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'executed')),
  receipt_id uuid references public.jhadina_commerce_approval_receipts(id),
  result jsonb,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_commerce_proposals_user_status_idx
  on public.jhadina_commerce_proposals (user_id, status, created_at desc);

alter table public.jhadina_commerce_proposals enable row level security;

create policy "commerce proposals are owner readable"
  on public.jhadina_commerce_proposals
  for select
  using (auth.uid() = user_id);

create or replace function public.jhadina_commerce_create_proposal(
  p_capability text,
  p_payload jsonb
)
returns public.jhadina_commerce_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.jhadina_commerce_proposals;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.jhadina_commerce_proposals (
    user_id, capability, payload
  )
  values (
    auth.uid(), p_capability, p_payload
  )
  returning * into result;

  return result;
end;
$$;

-- Atomic pending -> approved transition. Requires the caller to already
-- hold an approved receipt id (issued by the approval-receipt flow in the
-- same request) so a proposal can never be marked approved without one.
create or replace function public.jhadina_commerce_mark_proposal_approved(
  p_proposal_id uuid,
  p_receipt_id uuid
)
returns public.jhadina_commerce_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.jhadina_commerce_proposals;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.jhadina_commerce_proposals
     set status = 'approved', receipt_id = p_receipt_id, decided_at = now()
   where id = p_proposal_id
     and user_id = auth.uid()
     and status = 'pending'
  returning * into result;

  if result.id is null then
    raise exception 'proposal cannot be approved';
  end if;

  return result;
end;
$$;

-- Atomic approved -> executed transition. The caller must already have
-- independently consumed the single-use approval receipt (via
-- jhadina_commerce_consume_approval_receipt) before calling this —
-- this function only records the resulting execution, it does not
-- perform or re-check receipt consumption itself.
create or replace function public.jhadina_commerce_mark_proposal_executed(
  p_proposal_id uuid,
  p_result jsonb
)
returns public.jhadina_commerce_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.jhadina_commerce_proposals;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.jhadina_commerce_proposals
     set status = 'executed', result = p_result, executed_at = now()
   where id = p_proposal_id
     and user_id = auth.uid()
     and status = 'approved'
  returning * into result;

  if result.id is null then
    raise exception 'proposal cannot be executed';
  end if;

  return result;
end;
$$;
