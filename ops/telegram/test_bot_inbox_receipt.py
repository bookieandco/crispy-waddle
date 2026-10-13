"""Offline tests. No live Telegram calls, secrets, or real messages."""
import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
import urllib.error

import bot_inbox_receipt as mod

NOW = 1_791_856_800
TAG = "JHADINA-CHECK-01"
COMMAND = "/research-check " + TAG

def update(sender=123456, chat_type="private", text=COMMAND, age=30, **kw):
    return {"update_id": 91, "message": {
        "chat": {"type": chat_type, "id": sender if chat_type == "private" else -200},
        "from": {"id": sender},
        "date": NOW - age,
        "text": text,
        "message_id": 71,
        **kw,
    }}

class ReceiptSmokeTests(unittest.TestCase):
    def test_recent_private_message_matches_only_exact_command(self):
        self.assertTrue(mod.is_expected_receipt(update(), COMMAND, NOW, None))
        self.assertFalse(mod.is_expected_receipt(update(text=COMMAND + " extra"), COMMAND, NOW, None))
        self.assertFalse(mod.is_expected_receipt(update(chat_type="group"), COMMAND, NOW, None))
        self.assertFalse(mod.is_expected_receipt(update(age=3600), COMMAND, NOW, None))
        self.assertFalse(mod.is_expected_receipt(update(age=-120), COMMAND, NOW, None))
        self.assertFalse(mod.is_expected_receipt(update(forward_origin={"type": "user"}), COMMAND, NOW, None))
        self.assertFalse(mod.is_expected_receipt({"edited_message": update()["message"]}, COMMAND, NOW, None))

    def test_owner_allowlist_is_required_for_owner_attribution(self):
        self.assertTrue(mod.is_expected_receipt(update(), COMMAND, NOW, 123456))
        self.assertFalse(mod.is_expected_receipt(update(), COMMAND, NOW, 999999))
        self.assertFalse(mod.is_expected_receipt(update(sender=True), COMMAND, NOW, None))

    def test_probe_never_acknowledges_pending_updates(self):
        calls = []
        def fake_bot(token, method, body=None):
            calls.append((method, body))
            if method == "getMe":
                return {"ok": True, "result": {"is_bot": True, "username": "R2dice2bot"}}
            if method == "getWebhookInfo":
                return {"ok": True, "result": {"url": ""}}
            return {"ok": True, "result": [update()]}
        with patch.object(mod, "bot_api", side_effect=fake_bot):
            status = mod.smoke_once("not-a-secret", TAG, None, NOW)
        self.assertEqual(status, "LIVE_RECEIPT_UNPAIRED")
        self.assertEqual([x[0] for x in calls], ["getMe", "getWebhookInfo", "getUpdates"])
        self.assertEqual(calls[-1][1], {"offset": 0, "limit": 100, "timeout": 0})

    def test_allowlisted_owner_does_not_auto_pair_other_sender(self):
        def fake_bot(token, method, body=None):
            data = {"getMe": {"is_bot": True, "username": "R2dice2bot"},
                    "getWebhookInfo": {"url": ""},
                    "getUpdates": [update()]}
            return {"ok": True, "result": data[method]}
        with patch.object(mod, "bot_api", side_effect=fake_bot):
            self.assertEqual(mod.smoke_once("secret", TAG, 999, NOW), "NO_MATCHING_RECENT_RECEIPT")
            self.assertEqual(mod.smoke_once("secret", TAG, 123456, NOW), "LIVE_RECEIPT_OWNER_ALLOWLISTED")

    def test_fail_closed_on_webhook_or_wrong_bot(self):
        with patch.object(mod, "bot_api", side_effect=[
            {"result": {"is_bot": True, "username": "AnotherBot"}}]):
            with self.assertRaisesRegex(mod.SmokeCheckError, "BOT_USERNAME_MISMATCH"):
                mod.smoke_once("safe", TAG, None, NOW)
        with patch.object(mod, "bot_api", side_effect=[
            {"result": {"is_bot": True, "username": "R2dice2bot"}},
            {"result": {"url": "https://example.invalid/active"}}]):
            with self.assertRaisesRegex(mod.SmokeCheckError, "EXISTING_WEBHOOK_STOP"):
                mod.smoke_once("safe", TAG, None, NOW)

    def test_http_api_error_cannot_leak_embedded_bot_token(self):
        token = "SECRET_SHOULD_NOT_PRINT"
        url = "https://api.telegram.org/bot" + token + "/getUpdates"
        failure = urllib.error.HTTPError(url, 409, "Conflict", None, None)
        with patch.object(mod.urllib.request, "urlopen", side_effect=failure):
            with self.assertRaises(mod.SmokeCheckError) as caught:
                mod.bot_api(token, "getUpdates", {"offset": 0})
            self.assertEqual(str(caught.exception), "TELEGRAM_UPDATE_CONSUMER_CONFLICT")
            self.assertNotIn(token, str(caught.exception))

    def test_public_logs_contain_status_only(self):
        with patch.dict(mod.os.environ, {
            "TELEGRAM_BOT_TOKEN": "hidden-test-token",
            "TELEGRAM_PROOF_TAG": TAG,
            "TELEGRAM_ALLOWED_USER_ID": "123456",
        }, clear=True):
            with patch.object(mod, "smoke_once", return_value="LIVE_RECEIPT_OWNER_ALLOWLISTED"):
                capture = io.StringIO()
                with redirect_stdout(capture):
                    self.assertEqual(mod.main(), 0)
            printed = capture.getvalue()
            self.assertIn("TELEGRAM_OWNER_ALLOWLISTED_MESSAGE_RECEIPT_CONFIRMED", printed)
            self.assertNotIn("hidden-test-token", printed)
            self.assertNotIn("123456", printed)
            self.assertNotIn(COMMAND, printed)

if __name__ == "__main__":
    unittest.main()
