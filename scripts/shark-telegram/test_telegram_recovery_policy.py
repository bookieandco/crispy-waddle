"""RECOVER.02/.04: enforce the inactive-listener release boundaries."""
from argparse import Namespace
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch
import telegram_intake as intake

class ConsumerHoldTests(unittest.TestCase):
    def test_durable_bot_cannot_take_manual_getupdates_queue(self):
        with patch.object(intake, "verify_bot_setup") as mocked:
            with self.assertRaisesRegex(SystemExit,
                    "TELEGRAM_PERSISTENT_BOT_CONSUMER_HELD_SINGLE_OWNER_REQUIRED"):
                intake.forwarded_bot(Path("/unused"), "fake")
            mocked.assert_not_called()

class ResearchRightsHoldTests(unittest.IsolatedAsyncioTestCase):
    async def test_selected_chat_stays_disabled_before_auth(self):
        fake = types.ModuleType("telethon")
        fake.TelegramClient = object
        fake.events = object()
        fake.utils = object()
        args = Namespace(mode="live", chats=["@somechannel"],
                         exclude_chats=[], all_chats=False,
                         days=30, max_per_chat=100)
        with tempfile.TemporaryDirectory() as temp:
            with patch.dict(sys.modules, {"telethon": fake}):
                with self.assertRaisesRegex(SystemExit,
                        "TELEGRAM_SELECTED_CHAT_PERSISTENCE_HELD_RIGHTS_REVIEW"):
                    await intake.user_reader(args, Path(temp), "")
