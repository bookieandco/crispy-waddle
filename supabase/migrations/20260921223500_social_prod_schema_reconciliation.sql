-- Reconcile the already-present SOCIAL.10 production schema into the migration ledger.
-- This intentionally does not recreate tables/policies. It fails unless the
-- certified governed Social publication surface is present.

do $$
declare
  required_table text;
  required_function text;
begin
  foreach required_table in array array[
    'jhadina_social_accounts',
    'jhadina_social_approval_receipts',
    'jhadina_social_publication_proposals',
    'jhadina_social_publication_targets',
    'jhadina_social_outbox',
    'jhadina_social_observations'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'SOCIAL_PROD_RECONCILIATION_MISSING_TABLE:%', required_table;
    end if;
  end loop;

  foreach required_function in array array[
    'public.jhadina_social_create_proposal(text,text,text,jsonb,timestamptz,uuid[],text,text)',
    'public.jhadina_social_create_approval_receipt(text,text,text,timestamptz)',
    'public.jhadina_social_approve_receipt(uuid)',
    'public.jhadina_social_consume_approval_receipt(uuid,text,text,text)',
    'public.jhadina_social_enqueue_outbox(uuid)',
    'public.jhadina_social_begin_outbox_attempt(uuid)',
    'public.jhadina_social_complete_outbox(uuid,text)',
    'public.jhadina_social_fail_outbox(uuid,text,boolean,text)'
  ] loop
    if to_regprocedure(required_function) is null then
      raise exception 'SOCIAL_PROD_RECONCILIATION_MISSING_FUNCTION:%', required_function;
    end if;
  end loop;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname like 'jhadina_social_%'
      and c.relkind='r'
      and not c.relrowsecurity
  ) then
    raise exception 'SOCIAL_PROD_RECONCILIATION_RLS_REQUIRED';
  end if;
end $$;
