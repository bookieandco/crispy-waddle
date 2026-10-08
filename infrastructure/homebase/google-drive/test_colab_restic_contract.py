"""Static, hermetic safety checks for the synthetic Restic Colab notebook."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).parent


class ColabEncryptedResticContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nb=json.loads((ROOT/"COLAB-ENCRYPTED-RESTIC-SYNTHETIC.ipynb").read_text())
        cls.code="\n".join("".join(cell["source"]) for cell in cls.nb["cells"]
                          if cell["cell_type"]=="code")

    def test_usable_notebook_code_cells(self):
        self.assertEqual(self.nb["nbformat"],4)
        self.assertEqual(sum(c["cell_type"]=="code" for c in self.nb["cells"]),2)
        for index,cell in enumerate(self.nb["cells"]):
            if cell["cell_type"]=="code":
                compile("".join(cell["source"]),f"synthetic-restic-cell-{index}","exec")

    def test_synthetic_only_encrypted_remote_restored_by_hash(self):
        code=self.code
        for expected in (
            "drive.mount('/content/drive')",
            "01-BACKUPS",
            "secrets.token_bytes(64)",
            "'backup','--stdin'",
            "'--stdin-filename','synthetic.bin'",
            "'dump',snapshot,'/synthetic.bin'",
            "hashlib.sha256(restored).hexdigest() != sha",
            "secrets.token_urlsafe(48)",
            "RESTIC_PASSWORD_FILE",
            "os.O_EXCL",
            "parent.is_symlink()",
            "trial_root.exists()",
            "'encrypted_mounted_drive_roundtrip_verified':True",
            "'production_backup_restored':False",
            "'postgres_database_restore_verified':False",
            "'machine_rclone_oauth_verified':False",
            "'encryption_password_recovery_after_session_verified':False",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected,code)

    def test_no_production_sources_or_remote_deletion_or_printed_secrets(self):
        code=self.code
        for unsafe in ("pg_dump", "docker", "supabase", "MC_HOST_", "DATABASE_URL",
                       "shutil.rmtree(trial_root", "forget", "prune",
                       "print(secret_file", "print(env", "'password':"):
            with self.subTest(unsafe=unsafe):
                self.assertNotIn(unsafe,code)

if __name__=="__main__":
    unittest.main()
