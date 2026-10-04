#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
script = (root / "scripts/jhadina-portable-backup.py").read_text()
workflow = (root / ".github/workflows/jhadina-portable-backup-restore.yml").read_text()
ci = (root / ".github/workflows/jhadina-portable-backup-ci.yml").read_text()

for needle in (
    "JHADINA_PORTABLE_ROOT",
    "JHADINA_POSTGRES_HOST",
    "JHADINA_POSTGRES_PORT",
    "--format=custom",
    "--no-owner",
    "--symmetric",
    "--cipher-algo",
    "AES256",
    "--passphrase-file",
    "dumpSha256",
    "encryptedSha256",
    "criticalRowCountDigest",
    "plaintext.unlink(missing_ok=True)",
    '"authority": "BACKUP_EVIDENCE_ONLY"',
    '"canExecute": False',
):
    assert needle in script, f"PORTABLE_BACKUP_SCRIPT_MISSING:{needle}"

for needle in (
    "workflow_dispatch:",
    "JHADINA_PORTABLE_BACKUP_PASSPHRASE",
    "bash scripts/install-runpodctl-ci.sh",
    "jhadina-portable-staging",
    "networkVolumeId",
    "scp",
    "pg_restore",
    "jhadina_restore",
    "encryptedSha256",
    "dumpSha256",
    "criticalRowCountDigest",
    "actions/upload-artifact@v4",
    "retention-days: 7",
    "PORTABLE_BACKUP_RESTORE_PASS",
    "rm -f /tmp/jhadina-backup-passphrase",
):
    assert needle in workflow, f"PORTABLE_BACKUP_WORKFLOW_MISSING:{needle}"

for needle in (
    "source-postgres:",
    "restore-postgres:",
    "5435:5432",
    "5436:5432",
    "PORTABLE_BACKUP_RESTORE_CI_PASS",
    "portable backup restore sentinel",
):
    assert needle in ci, f"PORTABLE_BACKUP_CI_MISSING:{needle}"

for forbidden in (
    "\npush:",
    "\nschedule:",
    "5432/tcp",
    "SUPABASE_SERVICE_ROLE_KEY",
    'canExecute": true',
):
    assert forbidden not in workflow, f"PORTABLE_BACKUP_WORKFLOW_FORBIDDEN:{forbidden}"

assert ".dump.gpg" in workflow
assert "/tmp/jhadina-portable.restore.dump" not in workflow.split("Upload encrypted independent copy and receipt", 1)[1].split("Remove plaintext", 1)[0]
assert "JHADINA_PORTABLE_BACKUP_PASSPHRASE" not in script
print("JHADINA_PORTABLE_BACKUP_RESTORE_CONTRACT_PASS")
