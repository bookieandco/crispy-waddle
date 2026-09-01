-- Bind durable credential leases to the exact egress authorization that released them.
-- Existing leases remain readable but new bound leases carry all three fields.
alter table public.jhadina_credential_leases
  add column if not exists egress_destination text,
  add column if not exists egress_policy_version text,
  add column if not exists egress_decision_reason text;

create or replace function public.create_jhadina_credential_lease(
  p_lease_id text, p_actor_id text, p_worker_id text, p_capability text, p_provider text,
  p_credential_ref text, p_purpose text, p_resource_id text, p_expires_at timestamptz,
  p_max_uses integer, p_egress_destination text, p_egress_policy_version text,
  p_egress_decision_reason text
) returns void
language plpgsql security invoker as $$
begin
  if p_egress_destination is not null and (p_egress_policy_version is null or p_egress_decision_reason is null) then
    raise exception 'EGRESS_POLICY_BINDING_REQUIRED';
  end if;
  insert into public.jhadina_credential_leases (
    lease_id, actor_id, worker_id, capability, provider, credential_ref, purpose, resource_id,
    expires_at, max_uses, egress_destination, egress_policy_version, egress_decision_reason
  ) values (
    p_lease_id, p_actor_id, p_worker_id, p_capability, p_provider, p_credential_ref, p_purpose, p_resource_id,
    p_expires_at, p_max_uses, p_egress_destination, p_egress_policy_version, p_egress_decision_reason
  );
end;
$$;

create or replace function public.consume_jhadina_credential_lease(
  p_lease_id text, p_actor_id text, p_worker_id text, p_capability text, p_provider text,
  p_credential_ref text, p_purpose text, p_resource_id text, p_now timestamptz,
  p_egress_destination text, p_egress_policy_version text, p_egress_decision_reason text
) returns boolean
language plpgsql security invoker as $$
declare updated_count integer;
begin
  update public.jhadina_credential_leases
     set uses = uses + 1
   where lease_id = p_lease_id
     and actor_id = p_actor_id
     and worker_id is not distinct from p_worker_id
     and capability = p_capability
     and provider = p_provider
     and credential_ref = p_credential_ref
     and purpose = p_purpose
     and resource_id is not distinct from p_resource_id
     and egress_destination is not distinct from p_egress_destination
     and egress_policy_version is not distinct from p_egress_policy_version
     and egress_decision_reason is not distinct from p_egress_decision_reason
     and expires_at > p_now
     and uses < max_uses;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

grant execute on function public.create_jhadina_credential_lease(text,text,text,text,text,text,text,text,timestamptz,integer,text,text,text) to authenticated;
grant execute on function public.consume_jhadina_credential_lease(text,text,text,text,text,text,text,text,timestamptz,text,text,text) to authenticated;
