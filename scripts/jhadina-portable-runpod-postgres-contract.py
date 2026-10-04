#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
script = (root / "scripts/jhadina-portable-runpod-postgres.py").read_text()
workflow = (root / ".github/workflows/jhadina-portable-runpod-postgres.yml").read_text()

required_script = [
    'findmnt", "-T", "/workspace"',
    'target != "/workspace"',
    '"overlay", "tmpfs", "rootfs"',
    "listen_addresses = '127.0.0.1'",
    "include_if_exists = 'jhadina-portable.conf'",
    "PORTABLE_RUNPOD_POSTGRES_PUBLIC_LISTENER_FORBIDDEN",
    '"networkBoundaryVerified": True',
    "jhadina_portable_migration_ledger",
    "PORTABLE_RUNPOD_MIGRATION_DRIFT",
    "20260822000000_create_jhadina_memory_core.sql",
    "packages/money-core/migrations",
    "010_money_execution_attempts_prerequisite.sql",
    "--single-transaction",
    '"authority": "STAGING_DATABASE_EVIDENCE_ONLY"',
    '"canExecute": False',
]
for needle in required_script:
    assert needle in script, f"PORTABLE_RUNPOD_CONTRACT_SCRIPT_MISSING:{needle}"

required_workflow = [
    "workflow_dispatch:",
    "OWNER_ACTION_REQUIRED:PORTABLE_RUNPOD_NETWORK_VOLUME_REQUIRED",
    "--network-volume-id",
    "--ports 22/tcp",
    ".networkVolumeId // .networkVolume.id // empty",
    '[[ "$mount_path" == "/workspace" ]]',
    "PORTABLE_RUNPOD_NETWORK_VOLUME_REQUIRED",
    "PORTABLE_RUNPOD_DEDICATED_CPU_REQUIRED",
    "runpodctl exec python scripts/jhadina-portable-runpod-postgres.py",
]
for needle in required_workflow:
    assert needle in workflow, f"PORTABLE_RUNPOD_CONTRACT_WORKFLOW_MISSING:{needle}"

for forbidden in [
    "5432/tcp",
    "5432/http",
    "9000/http",
    "6379/tcp",
    "4222/tcp",
    "SUPABASE_SERVICE_ROLE_KEY",
]:
    assert forbidden not in workflow, f"PORTABLE_RUNPOD_PUBLIC_OR_HOSTED_AUTH_FORBIDDEN:{forbidden}"

assert "\npush:" not in workflow, "PORTABLE_RUNPOD_WORKFLOW_MUST_BE_MANUAL_ONLY"
print("JHADINA_PORTABLE_RUNPOD_POSTGRES_CONTRACT_PASS")
