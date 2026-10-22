import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "purse_owner_offline_backup", HERE / "purse_owner_offline_backup.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

GOOD_RECIPIENT = "age1" + "q" * 58
GOOD_DSN = (
    "postgresql://postgres:example-secret@db."
    + mod.PROJECT_REF + ".supabase.co:5432/postgres?sslmode=verify-full"
)


class GuardTests(unittest.TestCase):
    def test_owner_gate_rejects_missing_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(mod.ExportBlocked, "approval"):
                mod.validate_owner_inputs(
                    GOOD_DSN, GOOD_RECIPIENT, "", Path(directory)
                )

    def test_valid_dry_run_inputs_return_canonical_nonsecret_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            source = mod.validate_owner_inputs(
                GOOD_DSN, GOOD_RECIPIENT, mod.ACK, Path(directory)
            )
            self.assertEqual(source["sourceKind"], "DIRECT")
            self.assertEqual(source["database"], "postgres")

    def test_other_project_and_insecure_transport_fail_closed(self):
        bad = GOOD_DSN.replace(mod.PROJECT_REF, "otherproject123")
        with self.assertRaises(mod.ExportBlocked):
            mod.parse_source(bad)
        with self.assertRaisesRegex(mod.ExportBlocked, "TLS"):
            mod.parse_source(GOOD_DSN.replace("verify-full", "disable"))
        with self.assertRaises(mod.ExportBlocked):
            mod.parse_source(GOOD_DSN.replace("db.", "api."))
        with self.assertRaises(mod.ExportBlocked):
            mod.parse_source(GOOD_DSN.replace("/postgres?", "/otherdb?"))

    def test_pooled_canonical_identity_allowed_but_different_tenant_blocked(self):
        dsn = (
            "postgresql://postgres." + mod.PROJECT_REF
            + ":private@aws-0-ca-central-1.pooler.supabase.com:5432/"
            + "postgres?sslmode=verify-full"
        )
        self.assertEqual(mod.parse_source(dsn)["sourceKind"], "POOLER")
        with self.assertRaises(mod.ExportBlocked):
            mod.parse_source(dsn.replace(mod.PROJECT_REF, "unrelatedtenant"))

    def test_age_and_output_dir_must_be_owner_controlled(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(mod.ExportBlocked):
                mod.validate_owner_inputs(
                    GOOD_DSN, "insecure-recipient", mod.ACK, Path(directory)
                )
            with self.assertRaises(mod.ExportBlocked):
                mod.validate_owner_inputs(
                    GOOD_DSN, GOOD_RECIPIENT, mod.ACK, Path(directory) / "missing"
                )

    def test_receipt_never_claims_a_restored_database_or_grants_authority(self):
        receipt = mod.receipt_for_encrypted_copy(
            "private.dump.age", 1234, "a" * 64,
            "2026-10-22T06:30:00Z", "DIRECT"
        )
        self.assertFalse(receipt["independentRealDataRestoreVerified"])
        self.assertFalse(receipt["independentlyDownloadedAndDecrypted"])
        self.assertFalse(receipt["authenticatedCrossTenantRlsVerified"])
        self.assertFalse(receipt["canChangeProductionSchema"])
        self.assertFalse(receipt["canMoveMoney"])
        self.assertEqual(
            receipt["status"], "LOCAL_ENCRYPTED_COPY_ONLY_UNVERIFIED_RESTORE"
        )

    def test_child_processes_do_not_inherit_secrets(self):
        source = mod.parse_source(GOOD_DSN)
        inherited = {
            "PATH": "/usr/bin:/bin", "HOME": "/tmp/backup-operator",
            "JH_PURSE_SOURCE_DSN": GOOD_DSN,
            "JH_PURSE_SOURCE_BACKUP_ACK": mod.ACK,
            "STRIPE_SECRET_KEY": "sk_test_should_never_be_exported",
            "SUPABASE_SERVICE_ROLE_KEY": "sensitive-provider-secret",
            "PGPASSWORD": "unrelated-stale-password",
            "PGSSLROOTCERT": "/owner/trusted/roots.pem",
        }
        pg, age = mod.build_export_child_environments(source, inherited)
        self.assertEqual(pg["PGPASSWORD"], "example-secret")
        self.assertEqual(pg["PGSSLMODE"], "verify-full")
        self.assertEqual(pg["PGSSLROOTCERT"], "/owner/trusted/roots.pem")
        self.assertEqual(pg["PGOPTIONS"], "-c default_transaction_read_only=on")
        self.assertEqual(age["PATH"], "/usr/bin:/bin")
        self.assertNotIn("PGPASSWORD", age)
        self.assertNotIn("PGHOST", age)
        self.assertNotIn("JH_PURSE_SOURCE_DSN", pg)
        self.assertNotIn("JH_PURSE_SOURCE_DSN", age)
        self.assertNotIn("STRIPE_SECRET_KEY", pg)
        self.assertNotIn("STRIPE_SECRET_KEY", age)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", pg)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", age)
        self.assertNotIn("JH_PURSE_SOURCE_BACKUP_ACK", pg)

    def test_bad_receipt_cannot_be_minted(self):
        with self.assertRaises(mod.ExportBlocked):
            mod.receipt_for_encrypted_copy(
                "bad.csv", 1, "z" * 64, "2026-10-22T06:30:00Z", "DIRECT"
            )


if __name__ == "__main__":
    unittest.main()
