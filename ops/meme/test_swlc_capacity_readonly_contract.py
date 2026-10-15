"""SNIPER-REPAIR.01: SQL audit must never mutate the SWLC database."""
from __future__ import annotations

import pathlib
import re
import unittest

SQL_PATH = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "supabase-recovery-readonly.sql"


def statements() -> list[str]:
    text = SQL_PATH.read_text(encoding="utf-8")
    without_comments = re.sub(r"--[^\n]*", "", text)
    return [part.strip() for part in without_comments.split(";") if part.strip()]


class CapacityRecoverySQLContract(unittest.TestCase):
    def test_only_select_statements(self):
        queries = statements()
        self.assertGreaterEqual(len(queries), 7)
        for statement in queries:
            with self.subTest(statement=statement[:60]):
                self.assertRegex(statement.lower(), r"^select\b")

    def test_quota_and_readonly_are_explicit(self):
        sql = SQL_PATH.read_text(encoding="utf-8").lower()
        self.assertIn("500 * 1024 * 1024", sql)
        self.assertIn("475 * 1024 * 1024", sql)
        self.assertIn("default_transaction_read_only", sql)
        self.assertIn("transaction_read_only", sql)
        self.assertIn("pg_database_size", sql)
        self.assertIn("pg_is_in_recovery()", sql)
        self.assertNotIn("client_addr", sql)
        self.assertNotIn("left(query", sql)

    def test_relation_inventory_is_not_data_export(self):
        sql = SQL_PATH.read_text(encoding="utf-8").lower()
        for required in ("pg_total_relation_size", "pg_relation_size",
                         "pg_indexes_size", "pg_namespace"):
            self.assertIn(required, sql)
        uncommented = re.sub(r"--[^\n]*", "", sql)
        self.assertNotRegex(uncommented, r"\b(copy|pg_read_file|pg_ls_dir|pg_ls_waldir)\s*\(")


if __name__ == "__main__":
    unittest.main()
