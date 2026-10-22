-- SOCIAL-CORE.RECOVER.01-.02 — REVIEW ONLY; DO NOT APPLY AS-IS TO PRODUCTION.
-- Generated against verified main b1b9c277 (2026-10-21).
-- Convert to a uniquely versioned CLI migration only after exact-project drift
-- reconciliation, two-owner/anonymous RLS testing, and route validation.
--
-- Security defect: authenticated clients can invoke jhadina_social_upsert_account
-- and self-assert a profile as connected even without provider discovery.
-- App cutover: /api/social/profiles checks the provider profile; repository
-- binds it using the server-only service role / reviewed production OIDC proxy.
-- This migration removes only the obsolete user-callable account write RPC.
--
-- SECURITY WARNING: other authenticated SECURITY DEFINER mutation RPCs for
-- receipts/outbox still need a separate trusted-server authority cutover.
-- Do not call this the final publication/messaging approval certification.
begin;

do $audit$
begin
  if to_regclass('public.jhadina_social_accounts') is null
     or to_regprocedure('public.jhadina_social_upsert_account(text,text,text,text,text,text)') is null
  then
    raise exception 'SOCIAL_RECOVER_SCHEMA_NOT_RECONCILED';
  end if;
end
$audit$;

-- Eliminate the forgery path independently of any Next.js route guard.
revoke all on function
  public.jhadina_social_upsert_account(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function
  public.jhadina_social_upsert_account(text,text,text,text,text,text)
  to service_role;

-- The legacy migration granted authenticated DELETE, TRUNCATE, TRIGGER etc.
-- despite owner-readable RLS policies. Remove redundant grants. Preserve the
-- separate owner-write content-project table, which is intentionally omitted.
revoke all on table public.jhadina_social_accounts from public, anon, authenticated;
revoke all on table public.jhadina_social_approval_receipts from public, anon, authenticated;
revoke all on table public.jhadina_social_publication_proposals from public, anon, authenticated;
revoke all on table public.jhadina_social_publication_targets from public, anon, authenticated;
revoke all on table public.jhadina_social_outbox from public, anon, authenticated;
revoke all on table public.jhadina_social_observations from public, anon, authenticated;
revoke all on table public.jhadina_social_contact_states from public, anon, authenticated;
revoke all on table public.jhadina_social_message_proposals from public, anon, authenticated;
revoke all on table public.jhadina_social_message_outbox from public, anon, authenticated;
revoke all on table public.jhadina_social_publish_canaries from public, anon, authenticated;
revoke all on table public.jhadina_social_platform_receipts from public, anon, authenticated;

-- Read access is still scoped by existing owner RLS on each listed table.
grant select on table public.jhadina_social_accounts to authenticated;
grant select on table public.jhadina_social_approval_receipts to authenticated;
grant select on table public.jhadina_social_publication_proposals to authenticated;
grant select on table public.jhadina_social_publication_targets to authenticated;
grant select on table public.jhadina_social_outbox to authenticated;
grant select on table public.jhadina_social_observations to authenticated;
grant select on table public.jhadina_social_contact_states to authenticated;
grant select on table public.jhadina_social_message_proposals to authenticated;
grant select on table public.jhadina_social_message_outbox to authenticated;
grant select on table public.jhadina_social_publish_canaries to authenticated;
grant select on table public.jhadina_social_platform_receipts to authenticated;

-- Stop if RLS has disappeared or a core table is absent.
do $verify$
declare name text;
begin
  foreach name in array array[
    'jhadina_social_accounts', 'jhadina_social_approval_receipts',
    'jhadina_social_publication_proposals', 'jhadina_social_publication_targets',
    'jhadina_social_outbox', 'jhadina_social_observations',
    'jhadina_social_contact_states', 'jhadina_social_message_proposals',
    'jhadina_social_message_outbox', 'jhadina_social_publish_canaries',
    'jhadina_social_platform_receipts'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=name and c.relkind='r' and c.relrowsecurity
    ) then
      raise exception 'SOCIAL_RECOVER_RLS_MISSING:%', name;
    end if;
  end loop;
end
$verify$;

commit;
