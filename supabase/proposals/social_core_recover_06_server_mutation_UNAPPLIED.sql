-- SOCIAL-CORE.RECOVER.06 — PROPOSAL ONLY. NOT A MIGRATION, NOT APPLIED.
-- Requires exact code head, secure proxy admission, isolated test database,
-- Action Core policy proofs and explicit user approval before any rollout.
--
-- Client JWTs may NOT invoke any Social mutating RPC. Server-side actions are
-- authenticated and owner-verified in createRequestIdentityVerifier(), then
-- issued through a privileged Supabase client to this narrow static dispatcher.
-- Never grant this dispatcher EXECUTE to authenticated/anon/PUBLIC.
-- The original routines preserve their transactional idempotency/receipt checks.
begin;

create or replace function public.jhadina_social_server_mutation(
  p_owner_user_id uuid, p_operation text, p_arguments jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $social$
begin
  if p_owner_user_id is null or p_operation is null
     or jsonb_typeof(p_arguments) is distinct from 'object' then
    raise exception 'SOCIAL_SERVER_MUTATION_INVALID_INPUT';
  end if;

  -- The only permitted SQL invoker is service_role (GRANT at bottom).
  -- PostgREST service-role calls have no user JWT; this *transaction-local*
  -- owner claim feeds the existing auth.uid()-scoped transactional functions.
  -- No dynamic SQL, identifier interpolation or caller-set GUC is allowed.
  perform set_config('request.jwt.claim.sub', p_owner_user_id::text, true);
  if auth.uid() is distinct from p_owner_user_id then
    raise exception 'SOCIAL_SERVER_MUTATION_OWNER_CONTEXT_DENIED';
  end if;

  if p_operation = 'jhadina_social_create_proposal' then
    return to_jsonb(public.jhadina_social_create_proposal(
      p_arguments->>'p_action_id',
      p_arguments->>'p_brand',
      p_arguments->>'p_text',
      p_arguments->'p_media_urls',
      (p_arguments->>'p_scheduled_at')::timestamptz,
      (select coalesce(array_agg(item::uuid), array[]::uuid[]) from jsonb_array_elements_text(p_arguments->'p_target_account_ids') as item),
      p_arguments->>'p_request_fingerprint',
      p_arguments->>'p_idempotency_key'
    ));
  elsif p_operation = 'jhadina_social_create_approval_receipt' then
    return to_jsonb(public.jhadina_social_create_approval_receipt(
      p_arguments->>'p_action_id',
      p_arguments->>'p_type',
      p_arguments->>'p_fingerprint',
      (p_arguments->>'p_expires_at')::timestamptz
    ));
  elsif p_operation = 'jhadina_social_attach_approval_receipt' then
    return to_jsonb(public.jhadina_social_attach_approval_receipt(
      (p_arguments->>'p_proposal_id')::uuid,
      (p_arguments->>'p_receipt_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_approve_receipt' then
    return to_jsonb(public.jhadina_social_approve_receipt(
      (p_arguments->>'p_receipt_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_consume_approval_receipt' then
    return to_jsonb(public.jhadina_social_consume_approval_receipt(
      (p_arguments->>'p_receipt_id')::uuid,
      p_arguments->>'p_action_id',
      p_arguments->>'p_type',
      p_arguments->>'p_fingerprint'
    ));
  elsif p_operation = 'jhadina_social_enqueue_outbox' then
    return to_jsonb(public.jhadina_social_enqueue_outbox(
      (p_arguments->>'p_proposal_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_begin_outbox_attempt' then
    return to_jsonb(public.jhadina_social_begin_outbox_attempt(
      (p_arguments->>'p_outbox_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_complete_outbox' then
    return to_jsonb(public.jhadina_social_complete_outbox(
      (p_arguments->>'p_outbox_id')::uuid,
      p_arguments->>'p_provider_post_id'
    ));
  elsif p_operation = 'jhadina_social_fail_outbox' then
    return to_jsonb(public.jhadina_social_fail_outbox(
      (p_arguments->>'p_outbox_id')::uuid,
      p_arguments->>'p_error',
      (p_arguments->>'p_ambiguous')::boolean,
      p_arguments->>'p_provider_post_id'
    ));
  elsif p_operation = 'jhadina_social_record_observation' then
    return to_jsonb(public.jhadina_social_record_observation(
      (p_arguments->>'p_proposal_id')::uuid,
      (p_arguments->>'p_outbox_id')::uuid,
      p_arguments->>'p_kind',
      p_arguments->>'p_source',
      p_arguments->>'p_provider',
      p_arguments->>'p_platform',
      (p_arguments->>'p_account_id')::uuid,
      p_arguments->>'p_provider_profile_id',
      p_arguments->>'p_content_id',
      (p_arguments->>'p_observed_at')::timestamptz,
      p_arguments->>'p_source_url',
      p_arguments->'p_evidence',
      p_arguments->'p_metrics',
      p_arguments->'p_attributes'
    ));
  elsif p_operation = 'jhadina_social_publish_canary_create' then
    return to_jsonb(public.jhadina_social_publish_canary_create(
      p_arguments->'p_plan'
    ));
  elsif p_operation = 'jhadina_social_publish_canary_capture_outbox' then
    return to_jsonb(public.jhadina_social_publish_canary_capture_outbox(
      p_arguments->>'p_canary_plan_id',
      (p_arguments->>'p_outbox_id')::uuid,
      p_arguments->>'p_final_url'
    ));
  elsif p_operation = 'jhadina_social_upsert_contact_state' then
    return to_jsonb(public.jhadina_social_upsert_contact_state(
      p_arguments->>'p_recipient_ref',
      p_arguments->>'p_provider',
      p_arguments->>'p_platform',
      p_arguments->>'p_provider_recipient_id',
      p_arguments->>'p_state',
      p_arguments->'p_evidence',
      (p_arguments->>'p_observed_at')::timestamptz
    ));
  elsif p_operation = 'jhadina_social_create_message_proposal' then
    return to_jsonb(public.jhadina_social_create_message_proposal(
      p_arguments->>'p_action_id',
      p_arguments->>'p_brand',
      (p_arguments->>'p_sender_account_id')::uuid,
      p_arguments->>'p_recipient_ref',
      p_arguments->>'p_provider_recipient_id',
      p_arguments->>'p_conversation_ref',
      p_arguments->>'p_text',
      p_arguments->>'p_offer_ref',
      p_arguments->>'p_outreach_plan_ref',
      p_arguments->>'p_touch_id',
      p_arguments->>'p_brand_voice_profile_ref',
      p_arguments->>'p_channel_voice_profile_ref',
      p_arguments->'p_eligibility_evidence',
      (p_arguments->>'p_eligibility_observed_at')::timestamptz,
      p_arguments->>'p_request_fingerprint',
      p_arguments->>'p_idempotency_key'
    ));
  elsif p_operation = 'jhadina_social_attach_message_approval' then
    return to_jsonb(public.jhadina_social_attach_message_approval(
      (p_arguments->>'p_proposal_id')::uuid,
      (p_arguments->>'p_receipt_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_enqueue_message_outbox' then
    return to_jsonb(public.jhadina_social_enqueue_message_outbox(
      (p_arguments->>'p_proposal_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_begin_message_attempt' then
    return to_jsonb(public.jhadina_social_begin_message_attempt(
      (p_arguments->>'p_outbox_id')::uuid
    ));
  elsif p_operation = 'jhadina_social_complete_message_outbox' then
    return to_jsonb(public.jhadina_social_complete_message_outbox(
      (p_arguments->>'p_outbox_id')::uuid,
      p_arguments->>'p_provider_message_id'
    ));
  elsif p_operation = 'jhadina_social_fail_message_outbox' then
    return to_jsonb(public.jhadina_social_fail_message_outbox(
      (p_arguments->>'p_outbox_id')::uuid,
      p_arguments->>'p_error',
      (p_arguments->>'p_ambiguous')::boolean,
      p_arguments->>'p_provider_message_id'
    ));
  else
    raise exception 'SOCIAL_SERVER_MUTATION_OPERATION_DENIED';
  end if;
end;
$social$;

-- SQL grants are an independent authority boundary from authenticated routes.
revoke all on function public.jhadina_social_server_mutation(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.jhadina_social_server_mutation(uuid,text,jsonb)
  to service_role;

-- See the callsite manifest in SOCIAL-CORE-RECOVER-06.md.
-- Cut the direct client RPC authority *atomically* with the application
-- switch. Existing functions are still callable internally by the definer.
revoke all on function public.jhadina_social_create_proposal(text,text,text,jsonb,timestamptz,uuid[],text,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_create_approval_receipt(text,text,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_attach_approval_receipt(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_approve_receipt(uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_consume_approval_receipt(uuid,text,text,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_enqueue_outbox(uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_begin_outbox_attempt(uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_complete_outbox(uuid,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_fail_outbox(uuid,text,boolean,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_record_observation(uuid,uuid,text,text,text,text,uuid,text,text,timestamptz,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_publish_canary_create(jsonb)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_publish_canary_capture_outbox(text,uuid,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_upsert_contact_state(text,text,text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_create_message_proposal(text,text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_attach_message_approval(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_enqueue_message_outbox(uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_begin_message_attempt(uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_complete_message_outbox(uuid,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_fail_message_outbox(uuid,text,boolean,text)
  from public, anon, authenticated;

-- Account self-registration was addressed in .01; enforce it in this same
-- cutover even if the earlier staged proposal has not yet been applied.
revoke all on function public.jhadina_social_upsert_account(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.jhadina_social_upsert_account(text,text,text,text,text,text)
  to service_role;

commit;

-- Mandatory isolated acceptance: authenticated/anon cannot execute ANY
-- of the 20 direct functions or dispatcher; service role can execute dispatcher
-- only; owner A cannot affect B; single-use receipts cannot be replayed;
-- expired/missing/incorrect fingerprints fail; no provider call before permit;
-- status/idempotency/reconciliation preserved under concurrent dispatch.
