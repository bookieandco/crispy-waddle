"""Hermetic tests: no Telegram authentication, no internet, no external wallets."""
import importlib.util
import json
import os
import stat
import tempfile
import unittest
import urllib.error
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
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

    def test_named_bot_binding_rejects_wrong_token_identity(self):
        correct = {"id": 78281, "is_bot": True, "username": "R2dice2bot"}
        self.assertEqual(mod.verify_bot_identity(correct)["username"], "R2dice2bot")
        self.assertEqual(mod.verify_bot_identity(dict(correct, username="r2DICE2BOT"))["id"], 78281)
        with self.assertRaisesRegex(RuntimeError, "TELEGRAM_BOT_USERNAME_MISMATCH"):
            mod.verify_bot_identity(dict(correct, username="SomeOtherBot"))
        with self.assertRaisesRegex(RuntimeError, "TELEGRAM_BOT_USERNAME_MISMATCH"):
            mod.verify_bot_identity(dict(correct, is_bot=False))
        with self.assertRaisesRegex(RuntimeError, "TELEGRAM_BOT_USERNAME_MISMATCH"):
            mod.verify_bot_identity(None)

    def test_existing_webhook_is_blocking_and_never_removed(self):
        self.assertTrue(mod.assert_bot_polling_safe({"url": ""}))
        with self.assertRaisesRegex(RuntimeError, "TELEGRAM_EXISTING_WEBHOOK"):
            mod.assert_bot_polling_safe({"url": "https://example.invalid/other-integration"})
        with self.assertRaisesRegex(RuntimeError, "TELEGRAM_WEBHOOK_STATUS_UNAVAILABLE"):
            mod.assert_bot_polling_safe(None)

    def test_one_time_owner_pairing_requires_fresh_private_exact_challenge(self):
        start = 1791800000
        cmd = "/pair PLACEHOLDER_RANDOM_CHALLENGE"
        update = {"message": {"chat": {"type": "private", "id": 7382},
                              "from": {"id": 7382}, "text": cmd, "date": start + 4}}
        self.assertEqual(mod.pairing_user_id(update, "PLACEHOLDER_RANDOM_CHALLENGE", start), 7382)
        self.assertIsNone(mod.pairing_user_id(update, "WRONG_CHALLENGE", start))
        self.assertIsNone(mod.pairing_user_id(update, "PLACEHOLDER_RANDOM_CHALLENGE", start + 5))
        self.assertIsNone(mod.pairing_user_id({"message": dict(update["message"], chat={"type":"group","id":-123})},
                                               "PLACEHOLDER_RANDOM_CHALLENGE", start))
        self.assertIsNone(mod.pairing_user_id({"message": dict(update["message"], chat={"type":"private","id":999})},
                                               "PLACEHOLDER_RANDOM_CHALLENGE", start))

    def test_forward_original_date_never_rewrites_collected_event_time(self):
        msg = {"message": {"chat": {"type": "private", "id": 3},
                           "from": {"id": 3}, "text": SOL,
                           "message_id": 17, "date": 1791846660,
                           "forward_origin": {"type": "channel", "date": 1791800000}}}
        rows = mod.process_bot_update(msg, 3, SECRET)
        self.assertEqual(rows[0]["event_time_role"], "telegram_forward_received")
        self.assertEqual(rows[0]["message_time_utc"], mod.utc(datetime.fromtimestamp(1791846660, tz=timezone.utc)))
        self.assertEqual(rows[0]["forward_origin_date_utc"], mod.utc(datetime.fromtimestamp(1791800000, tz=timezone.utc)))
        self.assertFalse(rows[0]["scoring_eligible"])
        self.assertFalse(rows[0]["can_authorize_trade"])

    def test_telegram_409_stops_and_redacts_token_url(self):
        bogus = "https://api.telegram.org/botSECRET_PRIVATE_TOKEN/getUpdates"
        req = mod.urllib.request.Request(bogus)
        exception = urllib.error.HTTPError(bogus, 409, "Conflict", None, None)
        with patch.object(mod.urllib.request, "urlopen", side_effect=exception):
            with self.assertRaises(mod.BotPollingConflict) as ctx:
                mod.safe_telegram_response(req, 1, 1024)
            self.assertNotIn("SECRET_PRIVATE_TOKEN", str(ctx.exception))
        unauthorized = urllib.error.HTTPError(bogus, 401, "Unauthorized", None, None)
        with patch.object(mod.urllib.request, "urlopen", side_effect=unauthorized):
            with self.assertRaises(RuntimeError) as ctx:
                mod.safe_telegram_response(req, 1, 1024)
            self.assertEqual(str(ctx.exception), "TELEGRAM_API_REQUEST_FAILED")

    def test_railway_ephemeral_disk_refused(self):
        with tempfile.TemporaryDirectory() as scratch:
            with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_ID":"testenv"}, clear=True):
                with self.assertRaisesRegex(RuntimeError, "RAILWAY_PERSISTENT_VOLUME_REQUIRED"):
                    mod.assert_persistent_runtime_storage(Path(scratch))
            with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_ID":"testenv",
                                         "RAILWAY_VOLUME_MOUNT_PATH":scratch}, clear=True):
                mod.assert_persistent_runtime_storage(Path(scratch) / "private")
                with self.assertRaisesRegex(RuntimeError, "TELEGRAM_PRIVATE_DIR_MUST_BE_INSIDE_RAILWAY_VOLUME"):
                    mod.assert_persistent_runtime_storage(Path("/tmp/not-that-volume"))

    def test_single_worker_lock_prevents_double_consumers(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            first = mod.exclusive_worker_lock(root)
            try:
                with self.assertRaises(BlockingIOError):
                    mod.exclusive_worker_lock(root)
            finally:
                os.close(first)
            second = mod.exclusive_worker_lock(root)
            os.close(second)

    def test_forwarded_message_edits_are_append_only_and_labeled(self):
        baseline = {"message": {"chat": {"type": "private", "id": 7},
                                "from": {"id": 7}, "text": "CA " + SOL,
                                "message_id": 11, "date": 1791846660}}
        now = mod.process_bot_update(baseline, 7, SECRET)
        self.assertEqual(len(now), 1)
        self.assertEqual(now[0]["event_kind"], "NEW")
        edit = {"edited_message": dict(baseline["message"],
                text="migrated to PumpSwap " + SOL, edit_date=1791846760)}
        new = mod.process_bot_update(edit, 7, SECRET)
        self.assertEqual(new[0]["event_kind"], "EDIT")
        self.assertEqual(new[0]["message_fingerprint"], now[0]["message_fingerprint"])
        self.assertNotEqual(new[0]["text_hmac_sha256"], now[0]["text_hmac_sha256"])
        self.assertEqual(new[0]["content_version_time_utc"],
                         mod.utc(datetime.fromtimestamp(1791846760, tz=timezone.utc)))
        self.assertIn("MIGRATION_CLAIM", new[0]["mentioned_tags"])
        self.assertNotIn("MIGRATION_CLAIM", now[0]["mentioned_tags"])
        self.assertFalse(new[0]["scoring_eligible"])

    def test_malformed_edited_message_is_not_a_backdated_new_call(self):
        msg = {"edited_message": {"chat": {"type":"private","id":3}, "from":{"id":3},
                                 "message_id":4,"date":1791846660, "text":SOL}}
        self.assertEqual(mod.process_bot_update(msg, 3, SECRET), [])
        msg["edited_message"]["edit_date"] = 1791846560
        with self.assertRaisesRegex(ValueError, "edit date"):
            mod.process_bot_update(msg, 3, SECRET)

    def test_watchlist_separates_original_edit_and_historical_migration_claims(self):
        receipt = TIME + timedelta(minutes=10)
        revision = TIME + timedelta(minutes=5)
        first = mod.extract("CA " + SOL,  "chat", 1, TIME, TIME, SECRET,
                            "forwarded_bot", event_kind="NEW")
        edit = mod.extract("MIGRATED TO PUMPSWAP CA " + SOL, "chat", 1,
                           TIME, receipt, SECRET, "forwarded_bot",
                           edit_at=revision, event_kind="EDIT")
        history = mod.extract("migrated CA " + SOL, "chat", 2,
                              TIME, receipt, SECRET, "backfill",
                              edit_at=revision, event_kind="BACKFILL")
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            mod.append_private(root / "forwarded-derived-signals.jsonl", first + edit + edit)
            mod.append_private(root / "owner-derived-signals.jsonl", history)
            summary = build_watchlist(root)
            self.assertEqual(summary["schema_version"], "jhadina.telegram.watchlist-candidates.v2")
            self.assertEqual(summary["unique_message_token_pairs"], 2)
            self.assertEqual(summary["unique_content_versions"], 3)
            row = summary["tokens"][0]
            self.assertEqual(row["mention_count"], 2)
            self.assertEqual(row["new_message_migration_claim_count"], 0)
            self.assertEqual(row["edited_message_migration_claim_count"], 1)
            self.assertEqual(row["historical_snapshot_migration_claim_count"], 1)
            self.assertEqual(row["edited_message_count"], 1)
            self.assertFalse(row["onchain_migration_verified"])
            self.assertFalse(row["approved_for_market_collection"])
            self.assertEqual(row["first_detected_utc"], mod.utc(TIME))
            self.assertEqual(row["first_source_sent_utc"], mod.utc(TIME))

    def test_crash_before_checkpoint_is_replay_safe(self):
        msg = {"update_id": 41,
               "message": {"chat": {"type": "private", "id": 7},
                           "from": {"id": 7}, "text": "migrated " + SOL,
                           "message_id": 11, "date": 1791846660}}
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            output = root / "forwarded-derived-signals.jsonl"
            checkpoint = root / "forwarded-update-offset.txt"
            # Simulate a crash after fsyncing records but before update ack.
            with patch.object(mod, "save_checkpoint", side_effect=OSError("power-loss")):
                with self.assertRaisesRegex(OSError, "power-loss"):
                    mod.persist_bot_update(msg, 0, 7, SECRET, output, checkpoint)
            self.assertTrue(output.exists())
            self.assertFalse(checkpoint.exists())
            offset, count = mod.persist_bot_update(msg, 0, 7, SECRET, output, checkpoint)
            self.assertEqual(offset, 42)
            self.assertEqual(count, 1)
            self.assertEqual(checkpoint.read_text(), "42")
            self.assertEqual(build_watchlist(root)["tokens"][0]["mention_count"], 1)
            offset, count = mod.persist_bot_update(msg, 42, 7, SECRET, output, checkpoint)
            self.assertEqual((offset, count), (42, 0))

    def test_unauthorized_updates_can_ack_without_storing_messages(self):
        msg = {"update_id": 8,
               "message": {"chat": {"type": "private", "id": 123},
                           "from": {"id": 123}, "text": "migrated " + SOL,
                           "message_id": 6, "date": 1791846660}}
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            out, chk = root / "forwarded-derived-signals.jsonl", root / "forwarded-update-offset.txt"
            offset, count = mod.persist_bot_update(msg, 0, 99, SECRET, out, chk)
            self.assertEqual((offset, count), (9, 0))
            self.assertFalse(out.exists())
            self.assertEqual(chk.read_text(), "9")

    def test_malformed_update_id_does_not_advance_offset(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            with self.assertRaisesRegex(ValueError, "update ID"):
                mod.persist_bot_update({"update_id": -1}, 0, 1, SECRET, root/"out", root/"offset")
            self.assertFalse((root/"offset").exists())

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
