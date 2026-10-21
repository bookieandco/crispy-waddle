#!/usr/bin/env python3
"""Static source/SQL parity check; does not connect to production or run SQL."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
proposal = (root / "supabase/proposals/social_core_recover_06_server_mutation_UNAPPLIED.sql").read_text()
helper = (root / "apps/jhadina-web/src/lib/social/server-mutation-rpc.ts").read_text()

expected = {
    "create_proposal", "create_approval_receipt", "attach_approval_receipt",
    "approve_receipt", "consume_approval_receipt", "enqueue_outbox",
    "begin_outbox_attempt", "complete_outbox", "fail_outbox",
    "record_observation", "publish_canary_create",
    "publish_canary_capture_outbox", "upsert_contact_state",
    "create_message_proposal", "attach_message_approval",
    "enqueue_message_outbox", "begin_message_attempt",
    "complete_message_outbox", "fail_message_outbox",
}
names = {"jhadina_social_" + value for value in expected}
allowlist = helper.split("const MUTATIONS = [", 1)[1].split("] as const", 1)[0]
assert {name for name in re.findall(r'"(jhadina_social_[a-z_]+)"', allowlist)} == names, "SOCIAL_RPC_ALLOWLIST_DRIFT"
assert set(re.findall(r"p_operation = '(jhadina_social_[a-z_]+)'", proposal)) == names, "SOCIAL_RPC_SQL_DISPATCH_DRIFT"
assert len(re.findall(r"revoke all on function public.jhadina_social_[a-z_]+\(", proposal)) == len(names) + 2, "SOCIAL_RPC_REVOKE_COUNT"
for name in names:
    assert f"revoke all on function public.{name}(" in proposal, f"SOCIAL_RPC_GRANT_MISSING:{name}"
    assert f"public.{name}(" in proposal, f"SOCIAL_RPC_CALL_MISSING:{name}"

assert "revoke all on function public.jhadina_social_server_mutation(uuid,text,jsonb)" in proposal
assert "grant execute on function public.jhadina_social_server_mutation(uuid,text,jsonb)\n  to service_role;" in proposal
assert "set_config('request.jwt.claim.sub', p_owner_user_id::text, true)" in proposal
assert "SECURITY DEFINER" in proposal.upper()
assert "execute " not in proposal.lower().replace("grant execute", "").replace("revoke all", "").split("create or replace function")[1].split("end;\n$social$;")[0], "NO_DYNAMIC_SQL"
assert "JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED" in helper
assert "createRequestIdentityVerifier()" in helper
assert "createRuntimeServiceRoleClient()" in helper

app = root / "apps/jhadina-web/src/lib/social"
for name in ("repository.ts", "message-repository.ts", "supabase-approval-receipt-store.ts"):
    source = (app / name).read_text()
    assert "socialServerMutationResult" in source, f"SOCIAL_RPC_SERVER_BRIDGE_MISSING:{name}"
    assert not re.search(r'\.rpc\(\s*"jhadina_social_', source), f"SOCIAL_RPC_USER_PATH_REMAINS:{name}"

print(f"SOCIAL-CORE.RECOVER.06 static source parity OK: {len(names)} protected operations")
