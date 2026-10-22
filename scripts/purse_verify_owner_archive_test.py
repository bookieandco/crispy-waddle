import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "purse_verify_owner_archive", HERE / "purse_verify_owner_archive.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NAME = "jhadina-purse-20261022T060000Z-aabbccddeeff.dump.age"


class OfflineArchiveTests(unittest.TestCase):
    def seed(self, directory):
        p = Path(directory) / NAME
        p.write_bytes(b"ENCRYPTED-FIXTURE-ONLY" * 35)
        payload = {
            "schema": mod.SCHEMA, "sourceProjectRef": mod.PROJECT,
            "sourceDatabase": "postgres", "sourceKind": "DIRECT",
            "archiveName": NAME,
            "archiveFormat": "pg_dump-custom-age-x25519",
            "archiveEncrypted": True,
            "archiveBytes": p.stat().st_size,
            "encryptedArchiveSha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "independentlyDownloadedAndDecrypted": False,
            "independentRealDataRestoreVerified": False,
            "authenticatedCrossTenantRlsVerified": False,
            "productionMigrationApproved": False,
            "canChangeProductionSchema": False,
            "canMoveMoney": False
        }
        m = Path(directory) / "receipt.json"
        m.write_text(json.dumps(payload))
        return p, m, payload

    def test_offline_bytes_match_never_certifies_restoration(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest, _ = self.seed(tmp)
            r = mod.check_encrypted_copy(path, manifest)
            self.assertTrue(r["ciphertextMatchesSourceReceipt"])
            self.assertFalse(r["ageDecryptionVerified"])
            self.assertFalse(r["isolatedRestoreVerified"])
            self.assertFalse(r["canMoveMoney"])

    def test_modified_ciphertext_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest, _ = self.seed(tmp)
            path.write_bytes(path.read_bytes()[:-1] + b"Z")
            with self.assertRaisesRegex(mod.VerificationBlocked, "SHA-256"):
                mod.check_encrypted_copy(path, manifest)

    def test_flag_tampering_and_foreign_project_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest, meta = self.seed(tmp)
            for field, val in [("independentRealDataRestoreVerified", True),
                               ("canMoveMoney", True),("sourceProjectRef","foreign")]:
                bad = dict(meta, **{field: val})
                with self.subTest(field=field):
                    with self.assertRaises(mod.VerificationBlocked):
                        mod.validate_receipt(path, bad)

    def test_missing_identity_not_an_implicit_restore(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest, _ = self.seed(tmp)
            with self.assertRaises(mod.VerificationBlocked):
                mod.verify_complete_decryption(path, Path(tmp) / "missing")

    def test_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest, _ = self.seed(tmp)
            symlink = Path(tmp) / "link"
            symlink.symlink_to(path)
            with self.assertRaises(mod.VerificationBlocked):
                mod.check_encrypted_copy(symlink, manifest)

    def test_wrong_name_or_wrong_size_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest, meta = self.seed(tmp)
            with self.assertRaises(mod.VerificationBlocked):
                mod.validate_receipt(path, dict(meta, archiveName="wrong.dump.age"))
            with self.assertRaises(mod.VerificationBlocked):
                mod.validate_receipt(path, dict(meta, archiveBytes=path.stat().st_size + 1))


if __name__ == "__main__":
    unittest.main()
