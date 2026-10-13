"""Offline tests: no real Bot API calls and no account identifiers printed."""
import io
import json
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest.mock import patch

import bot_owner_id_reply as mod

NOW = 1791856800
TAG = "JHADINA-OWNER-ID-26"
COMMAND = "/jhadina-id " + TAG

def update(sender=5432198, seconds_ago=3, **overrides):
    return {"update_id": 111, "message": {
        "chat": {"type": "private", "id": sender}, "from": {"id": sender},
        "date": NOW - seconds_ago, "message_id": 93, "text": COMMAND,
        **overrides,
    }}

class OwnerIdReplyTests(unittest.TestCase):
    def test_private_exact_recent_and_not_forwarded(self):
        self.assertEqual(mod.eligible_private_sender(update(), TAG, NOW), 5432198)
        self.assertIsNone(mod.eligible_private_sender(update(seconds_ago=3600), TAG, NOW))
        self.assertIsNone(mod.eligible_private_sender(update(text=COMMAND+" extra"), TAG, NOW))
        self.assertIsNone(mod.eligible_private_sender(update(forward_origin={"type": "user"}), TAG, NOW))
        self.assertIsNone(mod.eligible_private_sender(update(chat={"type":"group","id":-1001}), TAG, NOW))
        self.assertIsNone(mod.eligible_private_sender(update(**{"from":{"id":999}}), TAG, NOW))
        self.assertIsNone(mod.eligible_private_sender({"edited_message": update()["message"]}, TAG, NOW))

    def test_no_api_acknowledgement_and_only_identical_sender_gets_self_id(self):
        methods = []
        sent = []
        def fake_bot_api(token, method, body=None):
            methods.append((method, body))
            if method == "getUpdates":
                return {"ok": True, "result": [update(), update(sender=5432198)]}
            raise AssertionError("other methods tested by preflight mock")
        with patch.object(mod, "validate_preflight") as preflight:
            with patch.object(mod, "bot_api", side_effect=fake_bot_api):
                with patch.object(mod, "send_self_id", side_effect=lambda token, recipient: sent.append(recipient)):
                    value = mod.identify_once("fake", TAG, NOW)
        preflight.assert_called_once_with("fake")
        self.assertEqual(value, "PRIVATE_ACCOUNT_ID_REPLY_SENT")
        self.assertEqual(sent, [5432198])
        self.assertEqual(methods, [("getUpdates", {"offset": 0, "limit": 100, "timeout": 0})])

    def test_ambiguous_requests_never_send_to_anyone(self):
        with patch.object(mod, "validate_preflight"):
            with patch.object(mod, "bot_api", return_value={"result": [update(), update(sender=9876543)]}):
                with patch.object(mod, "send_self_id") as sender:
                    with self.assertRaisesRegex(mod.SmokeCheckError, "AMBIGUOUS"):
                        mod.identify_once("private", TAG, NOW)
        sender.assert_not_called()

    def test_private_reply_contains_only_self_id_and_no_bot_token(self):
        class FakeResponse:
            def __init__(self): self.data = b'{"ok":true,"result":{"message_id":77}}'
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return self.data
        captured = []
        def fake_open(req, timeout=0):
            captured.append(req)
            return FakeResponse()
        with patch.object(mod.urllib.request, "urlopen", side_effect=fake_open):
            mod.send_self_id("VERY_PRIVATE_FAKE_TOKEN", 5432198)
        request = captured[0]
        self.assertTrue(request.full_url.endswith("/sendMessage"))
        body = json.loads(request.data)
        self.assertEqual(body["chat_id"], 5432198)
        self.assertIn("5432198", body["text"])
        self.assertTrue(body["protect_content"])
        self.assertNotIn("VERY_PRIVATE_FAKE_TOKEN", body["text"])

    def test_http_error_sanitizes_token_url(self):
        secret = "VERY_PRIVATE_FAKE_TOKEN"
        url = "https://api.telegram.org/bot"+secret+"/sendMessage"
        error = urllib.error.HTTPError(url, 400, "bad recipient", None, None)
        with patch.object(mod.urllib.request, "urlopen", side_effect=error):
            with self.assertRaisesRegex(mod.SmokeCheckError, "PRIVATE_REPLY_HTTP_ERROR") as e:
                mod.send_self_id(secret, 5432198)
        self.assertNotIn(secret, str(e.exception))

    def test_main_logs_no_account_ids_or_tokens(self):
        with patch.dict(mod.os.environ, {"TELEGRAM_BOT_TOKEN": "secret",
                                         "TELEGRAM_ID_TAG": TAG}, clear=True):
            with patch.object(mod, "identify_once", return_value="PRIVATE_ACCOUNT_ID_REPLY_SENT"):
                stream = io.StringIO()
                with redirect_stdout(stream):
                    self.assertEqual(mod.main(), 0)
                self.assertNotIn("5432198", stream.getvalue())
                self.assertNotIn("secret", stream.getvalue())
                self.assertIn("PRIVATE_ACCOUNT_ID_REPLY_SENT", stream.getvalue())

if __name__ == "__main__":
    unittest.main()
