#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / "services/jhadina-portable-memory-gateway/app.py").read_text()
oidc = (root / "services/jhadina-portable-memory-gateway/vercel_oidc.py").read_text()
requirements = (root / "services/jhadina-portable-memory-gateway/requirements.txt").read_text()
grants = (root / "infrastructure/portable/postgres-init/020_memory_runtime_grants.sql").read_text()

for needle in (
    '@app.post("/v1/memory")',
    '@app.get("/healthz")',
    "authorize_vercel_token(token)",
    "MAX_BODY_BYTES",
    "public.jhadina_retire_memory",
    "public.jhadina_correct_memory",
    '"authority": "MEMORY_STORAGE_TRANSPORT_ONLY"',
    '"canExecute": False',
):
    assert needle in app, f"PORTABLE_MEMORY_GATEWAY_APP_MISSING:{needle}"

for needle in (
    "ALLOWED_ISSUERS",
    "AUDIENCE",
    "SUBJECT",
    "OWNER_ID",
    "PROJECT_ID",
    "environment",
    "MAX_TOKEN_BYTES",
):
    assert needle in oidc, f"PORTABLE_MEMORY_GATEWAY_OIDC_MISSING:{needle}"

for forbidden in (
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "CRON_SECRET",
    "MONEY_DEX_COFFER_SIGNER",
    "executeSigned",
):
    assert forbidden not in app + oidc, f"PORTABLE_MEMORY_GATEWAY_FORBIDDEN:{forbidden}"

assert "psycopg[binary]" in requirements
assert "PyJWT[crypto]" in requirements

for table in (
    "jhadina_memory_candidates",
    "jhadina_memories",
    "jhadina_reasoning_events",
    "jhadina_timeline_events",
):
    assert table in grants, f"PORTABLE_MEMORY_GRANT_MISSING:{table}"

for needle in (
    "CREATE ROLE jhadina_memory_gateway NOLOGIN",
    "AS PERMISSIVE FOR ALL",
    "TO jhadina_memory_gateway",
):
    assert needle in grants, f"PORTABLE_MEMORY_ROLE_OR_RLS_MISSING:{needle}"

assert "GRANT service_role TO jhadina_memory_gateway" not in grants
assert "BYPASSRLS" not in grants
assert "money_" not in grants.lower()
assert "anon, authenticated" in grants
print("JHADINA_PORTABLE_MEMORY_GATEWAY_CONTRACT_PASS")
