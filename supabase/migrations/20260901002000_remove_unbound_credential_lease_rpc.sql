-- Remove the legacy RPC overloads so callers cannot create or consume a lease
-- without supplying its egress authorization binding.
drop function if exists public.create_jhadina_credential_lease(text,text,text,text,text,text,text,text,timestamptz,integer);
drop function if exists public.consume_jhadina_credential_lease(text,text,text,text,text,text,text,text,timestamptz);

-- Governed credential releases must carry an egress binding. Existing rows with
-- null bindings remain readable for migration/audit purposes, but the legacy
-- unbound creation/consumption entry points are no longer callable.
