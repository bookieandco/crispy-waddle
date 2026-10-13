"""Comprehensive no-network contracts for manual owner-only SHARK inbox preview."""
from __future__ import annotations

import io
import json
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest.mock import patch

import bot_research_once as subject

NOW = 1791867200
TAG = "JHADINA-SHARK-06"
OWNER = 123456789
OTHER = 5551234
SOL = "So11111111111111111111111111111111111111112"
EVM = "0x" + "ab" * 20

def msg(update_id, sender=OWNER, when=NOW - 20, text="", forwarded=True,
        private=True, chat_id=None, **extras):
    body = {
        "chat": {"type": "private" if private else "group",
                 "id": sender if chat_id is None else chat_id},
        "from": {"id": sender}, "date": when,
        "message_id": update_id, "text": text, **extras,
    }
    if forwarded:
        body["forward_origin"] = {
            "type": "channel", "date": NOW - 2000,
            "chat": {"id": -1002342, "username": "private-channel-name"},
        }
    return {"update_id": update_id, "message": body}

def command(update_id=51, sender=OWNER, tag=TAG, when=NOW - 1):
    return msg(update_id, sender, when, "/research-digest " + tag, forwarded=False)

class ResearchPreviewTests(unittest.TestCase):
    def test_pump_and_evm_are_candidates_not_verified(self):
        messages = [
            msg(45, text="CA " + SOL + " migrated PumpSwap"),
            msg(46, text="CA " + SOL + " rug?"),
            msg(47, text="contract " + EVM + " migration claimed"),
            command(),
        ]
        result = subject.collect_preview(messages, OWNER, TAG, NOW)
        self.assertEqual(result["forwarded_message_count"], 3)
        self.assertEqual(result["candidate_count"], 2)
        sol = next(x for x in result["candidates"] if x["chain"] == "solana_candidate")
        evm = next(x for x in result["candidates"] if x["chain"] == "evm_unresolved")
        self.assertEqual(sol["mentions"], 2)
        self.assertEqual(sol["migration_claims"], 1)
        self.assertEqual(sol["pumpswap_mentions"], 1)
        self.assertEqual(sol["rug_risk_claims"], 1)
        self.assertEqual(evm["migration_claims"], 1)
        self.assertFalse(result["chain_verified"])
        self.assertFalse(result["durably_stored"])
        self.assertFalse(result["trade_approved"])
        body = subject.format_private_preview(result)
        self.assertIn(SOL, body)
        self.assertIn(EVM.lower(), body)
        self.assertIn("Migration CLAIMS: 1", body)
        self.assertIn("NOT early predictions", body)
        self.assertNotIn("private-channel-name", body)
        self.assertNotIn(str(OWNER), body)

    def test_owner_command_required_and_not_from_attacker(self):
        rows = [msg(10, text="CA " + SOL), command(sender=OTHER)]
        self.assertIsNone(subject.collect_preview(rows, OWNER, TAG, NOW))
        self.assertIsNone(subject.collect_preview([msg(10, text="CA " + SOL)],
                                                  OWNER, TAG, NOW))
        self.assertIsNone(subject.collect_preview([command(tag="WRONG-TAG")],
                                                  OWNER, TAG, NOW))

    def test_forward_only_and_before_command_and_within_window(self):
        rows = [
            msg(41, text="CA " + SOL, forwarded=False),
            msg(42, text="CA " + SOL, sender=OTHER),
            msg(43, text="CA " + SOL, private=False),
            msg(44, text="CA " + SOL, chat_id=OWNER + 1),
            msg(45, text="CA " + SOL, when=NOW - 7 * 3600),
            msg(46, text="CA " + SOL, when=NOW + 70),
            msg(47, text="CA " + SOL, when=NOW - 50),
            command(48),
            msg(49, text="CA " + SOL),
        ]
        result = subject.collect_preview(rows, OWNER, TAG, NOW)
        self.assertEqual(result["forwarded_message_count"], 1)
        self.assertEqual(result["candidate_count"], 1)
        self.assertEqual(result["candidates"][0]["mentions"], 1)

    def test_zero_candidate_preview_is_not_fake_history(self):
        result = subject.collect_preview([
            msg(42, text="Wow. Sounds great!"),
            command(43),
        ], OWNER, TAG, NOW)
        self.assertEqual(result["candidate_count"], 0)
        self.assertEqual(result["forwarded_message_count"], 1)
        self.assertIn("None of these contracts", subject.format_private_preview(result))

    def test_edit_and_forwarded_command_cannot_authorize_digest(self):
        edited = {"update_id": 11, "edited_message": command()["message"]}
        forwarded_cmd = msg(15, text="/research-digest " + TAG)
        self.assertIsNone(subject.collect_preview([edited, forwarded_cmd], OWNER, TAG, NOW))
        message = command()["message"]
        message["edit_date"] = NOW - 1
        self.assertIsNone(subject.collect_preview([{"update_id": 30, "message": message}],
                                                  OWNER, TAG, NOW))

    def test_malformed_and_big_text_is_skipped(self):
        rows = [
            {"update_id": 1, "message": None},
            msg(5, text="CA " + SOL, **{"forward_origin": None}),
            msg(6, text="CA " + SOL + " Z" * 16000),
            msg(7, text="CA " + SOL, sender=True),
            msg(8, text="CA " + SOL),
            command(10),
        ]
        result = subject.collect_preview(rows, OWNER, TAG, NOW)
        self.assertEqual(result["candidate_count"], 1)
        self.assertEqual(result["candidates"][0]["mentions"], 1)

    def test_zero_ack_and_bot_identity_webhook_preflight(self):
        called = []
        sent = []
        def fake_bot(token, method, params=None):
            called.append((method, params))
            self.assertEqual(method, "getUpdates")
            return {"ok": True, "result": [
                msg(20, text="CA " + SOL + " PumpSwap migrated"),
                command(21),
            ]}
        with patch.object(subject, "validate_preflight") as preflight:
            with patch.object(subject, "bot_api", side_effect=fake_bot):
                with patch.object(subject, "send_private_preview", side_effect=lambda t, u, body: sent.append((u, body))):
                    ok = subject.execute_once("secret", OWNER, TAG, NOW)
        self.assertTrue(ok)
        preflight.assert_called_once_with("secret")
        self.assertEqual(called, [("getUpdates", {"offset": 0, "limit": 100, "timeout": 0})])
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][0], OWNER)

    def test_sender_must_match_chat_for_private_reply(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return b'{"ok": true, "result": {"message_id": 1}}'
        captured = []
        with patch.object(subject.urllib.request, "urlopen", side_effect=lambda req, timeout: (captured.append(req), Response())[1]):
            subject.send_private_preview("EXAMPLE_SECRET", OWNER, "Test only")
        data = json.loads(captured[0].data)
        self.assertEqual(data["chat_id"], OWNER)
        self.assertTrue(data["protect_content"])
        self.assertFalse(data["disable_notification"] is False)
        self.assertNotIn("EXAMPLE_SECRET", data["text"])

    def test_http_errors_redact_bot_token(self):
        secret = "TOP_SECRET_TEST_VALUE"
        error = urllib.error.HTTPError("https://api.telegram.org/bot"+secret+"/sendMessage",
                                      403, "forbidden", None, None)
        with patch.object(subject.urllib.request, "urlopen", side_effect=error):
            with self.assertRaisesRegex(subject.SmokeCheckError, "PRIVATE_REPLY_HTTP_ERROR") as caught:
                subject.send_private_preview(secret, OWNER, "test")
        self.assertNotIn(secret, str(caught.exception))

    def test_never_log_private_id_token_addresses_or_challenge(self):
        with patch.dict(subject.os.environ, {
            "TELEGRAM_BOT_TOKEN": "SAFE_DUMMY_SECRET",
            "TELEGRAM_ALLOWED_USER_ID": str(OWNER),
            "TELEGRAM_RESEARCH_TAG": TAG,
        }, clear=True):
            with patch.object(subject, "execute_once", return_value=True):
                stream = io.StringIO()
                with redirect_stdout(stream):
                    self.assertEqual(subject.main(), 0)
                public = stream.getvalue()
                self.assertIn("PRIVATE_OWNER_RESEARCH_PREVIEW_SENT", public)
                for private in ("SAFE_DUMMY_SECRET", str(OWNER), SOL, EVM, TAG):
                    self.assertNotIn(private, public)

    def test_missing_owner_secret_fails_before_telegram_calls(self):
        with patch.dict(subject.os.environ, {
            "TELEGRAM_BOT_TOKEN": "SAFE_DUMMY_SECRET",
            "TELEGRAM_ALLOWED_USER_ID": "",
            "TELEGRAM_RESEARCH_TAG": TAG,
        }, clear=True):
            with patch.object(subject, "execute_once") as run:
                self.assertEqual(subject.main(), 1)
                run.assert_not_called()

if __name__ == "__main__":
    unittest.main()
