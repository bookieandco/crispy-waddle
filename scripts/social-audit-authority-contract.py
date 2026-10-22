#!/usr/bin/env python3
"""Static audit trust-boundary certification; makes no external calls."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ledger = (root / "apps/jhadina-web/src/lib/social/durable-audit-ledger.ts").read_text()
proposal = (root / "supabase/proposals/social_core_recover_08_audit_domain_UNAPPLIED.sql").read_text()

assert 'SOCIAL_AUDIT_DOMAIN = "social"' in ledger
assert "createRequestIdentityVerifier()" in ledger
assert "args.p_actor_id !== identity.userId" in ledger
assert "createRuntimeServiceRoleClient()" in ledger
assert 'fn === "append_jhadina_audit_event"' in ledger
assert 'fn !== "append_jhadina_audit_event"' in ledger
assert "SOCIAL_RPC_AUTHORITY_FLAG" in ledger
assert 'await privileged.rpc(fn, args)' in ledger
assert 'await userClient.rpc(fn, args)' in ledger

assert "SOCIAL_AUDIT_SOURCE_DRIFT_STOP" in proposal
assert "SOCIAL_AUDIT_SERVER_ONLY" in proposal
assert "if p_domain = 'social' and auth.role() is distinct from 'service_role' then" in proposal
assert "from public, anon, authenticated" not in proposal.lower(), (
    "This proposal must not globally revoke other Action Core domains."
)
assert "SOCIAL-CORE.RECOVER.08" in proposal
assert "UNAPPLIED" in proposal
print("SOCIAL_CORE_RECOVER_08_AUDIT_STATIC_CONTRACT_PASS")
