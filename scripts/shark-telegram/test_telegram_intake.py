"""Hermetic tests: no Telegram authentication, no internet, no external wallets."""
import importlib.util
import json
import os
import stat
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from telegram_research_bridge import build_watchlist, save_private_watchlist

MODULE = Path(__file__).with_name("telegram_intake.py")
spec = importlib.util.spec_from_file_location("telegram_intake", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SOL = "FXynyTLxTwaLZJrBuLTNafBfqBthbAxKiv7afABapump"
EVM = "0x98096d17e191B3dA1d5f99a6D7b3584351b11E18"
SECRET = "test-only-not-a-real-key--" + ("k" * 40)
TIME = datetime(2026, 10, 12, tzinfo=timezone.utc)

class ContractTests(unittest.TestCase):
    def test_mixed_chains_do_not_cross_identify(self):
        matches = mod.find_contracts("migrated to PumpSwap CA " + SOL + " " + EVM)
        self.assertEqual(len(matches), 2)
        self.assertEqual({m["chain_id"] for m in matches}, {"solana_candidate", "evm_unresolved"})
        self.assertEqual([x for x in matches if x["chain_id"] == "evm_unresolved"][0]["address"], EVM.lower())

    def test_rumor_is_never_treated_as_onchain_truth(self):
        rows = mod.extract("migrated to PumpSwap on Raydium " + SOL + " 100x!",
                           "-100123", 13, TIME, TIME, SECRET, "backfill")
        self.assertEqual(len(rows), 1)
        self.assertIn("MIGRATION_CLAIM", rows[0]["mentioned_tags"])
        self.assertIn("PUMPSWAP_MENTION", rows[0]["mentioned_tags"])
        self.assertFalse(rows[0]["migration_verified_onchain"])
        self.assertFalse(rows[0]["scoring_eligible"])
        self.assertFalse(rows[0]["can_authorize_trade"])
        self.assertNotIn("100x", json.dumps(rows))
        self.assertNotIn("-100123", json.dumps(rows))

    def test_fingerprint_stable_no_raw_message(self):
        args = (SOL, "my_secret_chat", 1, TIME, TIME, SECRET, "backfill")
        self.assertEqual(mod.extract(*args), mod.extract(*args))
        self.assertNotIn("my_secret_chat", json.dumps(mod.extract(*args)))

    def test_not_all_random_ids_become_solana_tokens(self):
        self.assertEqual(mod.find_contracts("abcdef123456789abcdef123456789abcdef123"), [])

    def test_datetime_fails_closed(self):
        with self.assertRaises(ValueError):
            mod.extract(SOL, "somechat", 5, datetime.now(), TIME, SECRET, "backfill")

    def test_private_file_and_symlink_protection(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "signals.jsonl"
            self.assertEqual(mod.append_private(target, [{"ok": True}]), 1)
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
            link = Path(tmp) / "link"
            link.symlink_to(target)
            with self.assertRaises(PermissionError):
                mod.append_private(link, [{"ok": False}])

    def test_deduped_private_candidate_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            first = mod.extract(SOL, "mychat", 100, TIME, TIME, SECRET, "backfill")
            # A backfill/live overlap must not count a message twice.
            mod.append_private(root / "owner-derived-signals.jsonl", first + first)
            report = build_watchlist(root)
            self.assertEqual(len(report["tokens"]), 1)
            self.assertEqual(report["tokens"][0]["mention_count"], 1)
            self.assertFalse(report["tokens"][0]["approved_for_market_collection"])
            self.assertEqual(save_private_watchlist(root), 1)
            self.assertEqual(stat.S_IMODE((root/"telegram-watchlist-candidates.json").stat().st_mode), 0o600)
            self.assertNotIn("mychat", (root/"telegram-watchlist-candidates.json").read_text())

    def test_bot_authorizes_owner_private_messages_only(self):
        msg = {"message": {"chat": {"type": "private", "id": 42},
                           "from": {"id": 99}, "text": SOL,
                           "message_id": 12, "date": 1791846660}}
        self.assertEqual(mod.process_bot_update(msg, 1, SECRET), [])
        msg["message"]["from"]["id"] = 1
        self.assertEqual(len(mod.process_bot_update(msg, 1, SECRET)), 1)
        msg["message"]["chat"]["type"] = "group"
        self.assertEqual(mod.process_bot_update(msg, 1, SECRET), [])

if __name__ == "__main__":
    unittest.main()
