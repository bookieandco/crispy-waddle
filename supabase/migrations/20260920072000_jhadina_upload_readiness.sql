-- JLLM-18S — non-mutating universal-upload production readiness probe.
-- Service-role only. This function exposes booleans/names, never secret values
-- or user data, and does not claim work from any queue.

create or replace function public.jhadina_upload_readiness()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog, storage
as $$
  select jsonb_build_object(
    'schemaVersion', 'jllm-18s-v1',
    'tables', jsonb_build_object(
      'intelligenceAssets', to_regclass('public.jhadina_intelligence_assets') is not null,
      'subsystemInbox', to_regclass('public.jhadina_subsystem_intelligence_inbox') is not null,
      'perceptionJobs', to_regclass('public.jhadina_perception_jobs') is not null,
      'uploadSessions', to_regclass('public.jhadina_upload_sessions') is not null,
      'cleanupReceipts', to_regclass('public.jhadina_quarantine_cleanup_receipts') is not null
    ),
    'storage', jsonb_build_object(
      'intakeBucket', exists(
        select 1 from storage.buckets where id = 'jhadina-intake-private'
      )
    ),
    'functions', jsonb_build_object(
      'enqueuePerception', to_regprocedure(
        'public.enqueue_jhadina_perception_job(text,text,text,text,integer)'
      ) is not null,
      'claimPerception', to_regprocedure(
        'public.claim_next_jhadina_perception_job(text,integer)'
      ) is not null,
      'requestFinalize', to_regprocedure(
        'public.request_jhadina_upload_session_finalize(text,uuid,integer)'
      ) is not null,
      'claimFinalize', to_regprocedure(
        'public.claim_next_jhadina_upload_session_finalize(text,integer)'
      ) is not null,
      'renewFinalize', to_regprocedure(
        'public.renew_jhadina_upload_session_finalize_lease(text,uuid,text,text,integer)'
      ) is not null,
      'retryFinalize', to_regprocedure(
        'public.retry_jhadina_upload_session_finalize(text,uuid,text,text,text,timestamptz)'
      ) is not null,
      'claimCleanup', to_regprocedure(
        'public.claim_next_jhadina_upload_cleanup(text,integer)'
      ) is not null,
      'orphanDiscovery', to_regprocedure(
        'public.list_jhadina_orphan_quarantine_objects(integer)'
      ) is not null
    )
  );
$$;

revoke execute on function public.jhadina_upload_readiness()
  from public, anon, authenticated;
grant execute on function public.jhadina_upload_readiness()
  to service_role;
