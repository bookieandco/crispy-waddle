-- SOCIAL-ID.15 staging DDL design. NOT APPLIED to SWLC.
-- The Supabase CLI was unavailable in this execution environment.
-- After database health / backup / migration inventory / isolated restore:
-- run "supabase migration new jhadina_social_account_identity_v1" in the cloned
-- repository, paste and peer-review this staged design, then run local checks.
-- This is an explicitly staged SQL asset, NOT a recorded migration.

create table if not exists public.jhadina_social_identity_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.jhadina_social_accounts(id) on delete cascade,
  brand text not null,
  platform text not null,
  provider text not null,
  provider_profile_id text not null,
  version integer not null check (version >= 1),
  snapshot jsonb not null,
  last_review_receipt_id uuid not null references public.jhadina_social_approval_receipts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,account_id),
  check (jsonb_typeof(snapshot) = 'object'),
  check ((snapshot->>'authority')='EXPRESSION_ONLY' and (snapshot->>'canPublish')='false' and (snapshot->>'canChangeJhadinaPersonality')='false')
);
create table if not exists public.jhadina_social_identity_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.jhadina_social_accounts(id) on delete cascade,
  version integer not null check (version >= 1),
  proposal_id text not null,
  review_receipt_id uuid not null references public.jhadina_social_approval_receipts(id),
  approval_fingerprint text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,account_id,version),
  unique(review_receipt_id)
);
create index if not exists jhadina_social_identity_history_owner
  on public.jhadina_social_identity_history(user_id,account_id,version desc);
alter table public.jhadina_social_identity_snapshots enable row level security;
alter table public.jhadina_social_identity_history enable row level security;
revoke all on public.jhadina_social_identity_snapshots from public,anon,authenticated;
revoke all on public.jhadina_social_identity_history from public,anon,authenticated;
grant select on public.jhadina_social_identity_snapshots to authenticated;
grant select on public.jhadina_social_identity_history to authenticated;
create policy "Identity snapshots owner-readable only" on public.jhadina_social_identity_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Identity history owner-readable only" on public.jhadina_social_identity_history
  for select to authenticated using ((select auth.uid()) = user_id);

-- Single transaction / default SECURITY INVOKER; no direct user-facing UPDATE/INSERT.
-- Explicit execute allowlist for service_role, still requiring an authenticated
-- server-side request/worker and verified review receipt.
create or replace function public.jhadina_social_commit_identity_snapshot(
 p_owner_user_id uuid, p_account_id uuid, p_brand text, p_platform text,
 p_provider text, p_provider_profile_id text, p_expected_version integer,
 p_next jsonb, p_proposal_id text, p_receipt_id uuid, p_fingerprint text
) returns integer
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
 v_account public.jhadina_social_accounts%rowtype;
 v_receipt public.jhadina_social_approval_receipts%rowtype;
 v_version integer;
begin
 if p_expected_version < 0 or p_expected_version is null or
    p_next is null or jsonb_typeof(p_next) <> 'object' or
    nullif(trim(p_proposal_id),'') is null or
    nullif(trim(p_fingerprint),'') is null
 then raise exception 'SOCIAL_ID_DB_INVALID_COMMIT'; end if;
 select * into v_account
 from public.jhadina_social_accounts
 where id=p_account_id and user_id=p_owner_user_id
   and brand=p_brand and platform=p_platform and provider=p_provider
   and provider_profile_id=p_provider_profile_id and status='connected'
 for update;
 if not found then raise exception 'SOCIAL_ID_DB_ACCOUNT_SCOPE_DENIED'; end if;
 if p_next->>'schemaVersion' <> 'jhadina.social.account-identity.v1' or
    p_next->>'authority' <> 'EXPRESSION_ONLY' or
    p_next->>'canPublish' <> 'false' or
    p_next->>'canChangeJhadinaPersonality' <> 'false' or
    (p_next->>'version')::integer <> p_expected_version+1 or
    p_next->'scope'->>'ownerUserId' <> p_owner_user_id::text or
    p_next->'scope'->>'accountId' <> p_account_id::text or
    p_next->'scope'->>'brandId' <> p_brand or
    p_next->'scope'->>'platform' <> p_platform or
    p_next->'scope'->>'provider' <> p_provider or
    p_next->'scope'->>'providerProfileId' <> p_provider_profile_id
 then raise exception 'SOCIAL_ID_DB_SNAPSHOT_INVALID'; end if;
 select * into v_receipt
 from public.jhadina_social_approval_receipts
 where id=p_receipt_id and user_id=p_owner_user_id
   and type='social.identity.modify'
   and action_id=('social-identity:'||p_account_id::text||':'||p_proposal_id)
   and fingerprint=p_fingerprint
   and status='approved' and expires_at > now()
 for update;
 if not found then raise exception 'SOCIAL_ID_DB_APPROVAL_REQUIRED'; end if;
 if p_expected_version=0 then
   insert into public.jhadina_social_identity_snapshots
    (user_id,account_id,brand,platform,provider,provider_profile_id,
     version,snapshot,last_review_receipt_id)
   values(p_owner_user_id,p_account_id,p_brand,p_platform,p_provider,
     p_provider_profile_id,1,p_next,p_receipt_id)
   on conflict do nothing returning version into v_version;
 else
   update public.jhadina_social_identity_snapshots set
     version=p_expected_version+1, snapshot=p_next,
     last_review_receipt_id=p_receipt_id, updated_at=now()
   where user_id=p_owner_user_id and account_id=p_account_id
     and brand=p_brand and platform=p_platform and provider=p_provider
     and provider_profile_id=p_provider_profile_id and version=p_expected_version
   returning version into v_version;
 end if;
 if v_version is null then raise exception 'SOCIAL_ID_DB_CAS_CONFLICT'; end if;
 insert into public.jhadina_social_identity_history
   (user_id,account_id,version,proposal_id,review_receipt_id,approval_fingerprint,snapshot)
 values(p_owner_user_id,p_account_id,v_version,p_proposal_id,p_receipt_id,p_fingerprint,p_next);
 update public.jhadina_social_approval_receipts
   set status='consumed', consumed_at=now()
 where id=p_receipt_id and status='approved' and user_id=p_owner_user_id;
 if not found then raise exception 'SOCIAL_ID_DB_APPROVAL_REPLAY'; end if;
 return v_version;
end;
$$;
revoke all on function public.jhadina_social_commit_identity_snapshot(
 uuid,uuid,text,text,text,text,integer,jsonb,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.jhadina_social_commit_identity_snapshot(
 uuid,uuid,text,text,text,text,integer,jsonb,text,uuid,text)
 to service_role;

-- Required post-migration checks on isolated clone:
-- inspect grants + RLS; attempt anon/foreign-owner read and direct UPDATE;
-- exercise 0->1, 1->2, stale-version conflict, reused receipt rollback,
-- foreign-brand/account mismatch and cancelled/expired receipts.
