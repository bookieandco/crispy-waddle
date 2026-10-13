"""TELEGRAM-LIVE.09 simulated incoming-event certification.

NO Telethon auth, Bot API, Telegram calls, wallets or network.
Exercises the real user_reader async path with an in-memory fake Telethon
module. Synthetic messages only. No raw or derived event storage allowed.
"""
from __future__ import annotations

import asyncio
import contextlib
import io
import os
import sys
import tempfile
import types
import unittest
from argparse import Namespace
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import telegram_intake as mod

OWNER = 447788
OTHER = 999441
SOL = "FXynyTLxTwaLZJrBuLTNafBfqBthbAxKiv7afABapump"
EVM = "0x98096d17e191B3dA1d5f99a6D7b3584351b11E18"
PRIVATE_MESSAGE = "private-example-do-not-log"
NOW = datetime(2026, 10, 12, tzinfo=timezone.utc)


def fake_event(kind, chat_id, text):
    message = types.SimpleNamespace(message=text, date=NOW, id=8, edit_date=None)
    return types.SimpleNamespace(kind=kind, chat_id=chat_id, message=message)


def make_fake_telethon(*, user_id=OWNER, constructor_error=False,
                       disconnect_error=False):
    state = {"instances": [], "filters": [], "events_seen": []}

    class Filter:
        def __init__(self, kind, chats=None, incoming=None, **kwargs):
            self.kind = kind
            self.chats = chats
            self.incoming = incoming
            state["filters"].append(self)

    class NewMessage(Filter):
        def __init__(self, **kwargs):
            super().__init__("new", **kwargs)

    class MessageEdited(Filter):
        def __init__(self, **kwargs):
            super().__init__("edit", **kwargs)

    class BadMessage:
        @property
        def message(self):
            raise ValueError(PRIVATE_MESSAGE)

    class FakeClient:
        def __init__(self, name, api_id, api_hash):
            if constructor_error:
                raise RuntimeError("FAKE_CONSTRUCTOR_ERROR")
            state["instances"].append(self)
            self.handlers = []
            self.connected = False
            self.disconnected = False

        async def start(self):
            self.connected = True

        async def get_me(self):
            return types.SimpleNamespace(id=user_id, bot=False)

        async def get_entity(self, name):
            if name == "@exclude":
                return -1005678
            raise RuntimeError("UNEXPECTED_FAKE_ENTITY")

        def on(self, event_filter):
            def decorator(fn):
                self.handlers.append((event_filter, fn))
                return fn
            return decorator

        async def run_until_disconnected(self):
            events = [
                fake_event("new", -1009999, "CA " + SOL + " migration PumpSwap"),
                fake_event("new", -1005678, "CA " + SOL + " excluded"),
                fake_event("new", -1009999, "unrelated message"),
                fake_event("edit", -1009999, "contract " + EVM),
                types.SimpleNamespace(kind="new", chat_id=-1009999,
                                      message=BadMessage()),
            ]
            for event in events:
                state["events_seen"].append(event.kind)
                for filt, handler in self.handlers:
                    if filt.kind == event.kind:
                        await handler(event)

        async def disconnect(self):
            self.disconnected = True
            if disconnect_error:
                raise RuntimeError("FAKE_DISCONNECT_ERROR")

    module = types.ModuleType("telethon")
    module.TelegramClient = FakeClient
    module.events = types.SimpleNamespace(
        NewMessage=NewMessage, MessageEdited=MessageEdited)
    module.utils = types.SimpleNamespace(get_peer_id=lambda x: x)
    return module, state


class SimulatedAllNewTelegram(unittest.IsolatedAsyncioTestCase):
    async def test_all_new_messages_include_future_chats_and_exclude_denied_peers(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            fake, state = make_fake_telethon()
            args = Namespace(mode="live", chats=None, exclude_chats=["@exclude"],
                             all_chats=True, days=30, max_per_chat=2000)
            env = {"TELEGRAM_API_ID": "12345",
                   "TELEGRAM_API_HASH": "a" * 32,
                   "TELEGRAM_ALLOWED_USER_ID": str(OWNER)}
            with patch.dict(sys.modules, {"telethon": fake}):
                with patch.dict(os.environ, env, clear=True):
                    with patch.object(mod, "append_private") as save:
                        with contextlib.redirect_stdout(io.StringIO()) as captured:
                            await mod.user_reader(args, root, "")
                        save.assert_not_called()
            log = captured.getvalue()
            self.assertIn("READ_ONLY_LIVE_LISTENER_STARTED ALL_NEW_INCOMING_CLOUD_CHATS", log)
            self.assertEqual(log.count("NEW_TOKEN_MENTIONS 1"), 1)
            self.assertEqual(log.count("EDITED_TOKEN_MENTIONS 1"), 1)
            self.assertIn("MIGRATION_CLAIM_ONLY 1", log)
            self.assertIn("PUMPSWAP_MENTION_ONLY 1", log)
            self.assertIn("EVM_CHAIN_UNRESOLVED 1", log)
            self.assertIn("UNVERIFIED_NO_AI_NO_TRADE", log)
            self.assertIn("TELEGRAM_SCAN_EVENT_REJECTED", log)
            for forbidden in (SOL, EVM, str(OWNER), PRIVATE_MESSAGE, "@exclude"):
                self.assertNotIn(forbidden, log)
            self.assertFalse((root / "owner-derived-signals.jsonl").exists())
            self.assertFalse((root / "owner.session").exists())  # fake never logs in
            self.assertTrue(state["instances"][0].disconnected)
            self.assertTrue(all(filt.incoming is True for filt in state["filters"]))
            self.assertTrue(all(filt.chats is None for filt in state["filters"]))

    async def test_ephemeral_local_crypto_notices_are_redacted_and_not_evidence(self):
        text = "Rug pulled, migrated PumpSwap, CA " + SOL + " and contract " + EVM
        signal = mod.ephemeral_crypto_observation(text)
        self.assertEqual(signal["candidates"], 2)
        self.assertEqual(signal["solana_candidate"], 1)
        self.assertEqual(signal["evm_unresolved"], 1)
        self.assertEqual(signal["migration_claim"], 1)
        self.assertEqual(signal["pumpswap_mention"], 1)
        self.assertEqual(signal["rug_risk_claim"], 1)
        notice = mod.ephemeral_local_notice("NEW", signal)
        self.assertIn("MIGRATION_CLAIM_ONLY 1", notice)
        self.assertIn("RUG_RISK_CLAIM_ONLY 1", notice)
        self.assertIn("UNVERIFIED_NO_AI_NO_TRADE", notice)
        for sensitive in (SOL, EVM, text, str(OWNER), "Rug pulled"):
            self.assertNotIn(sensitive, notice)
        self.assertEqual(mod.ephemeral_crypto_observation("rug pulled, no contract")["candidates"], 0)
        self.assertEqual(mod.ephemeral_crypto_observation("x" * 16001)["candidates"], 0)
        self.assertEqual(mod.ephemeral_crypto_observation(None)["candidates"], 0)
        self.assertEqual(mod.ephemeral_local_notice(
            "NEW", mod.ephemeral_crypto_observation("rug pulled")), "")
        with self.assertRaises(ValueError):
            mod.ephemeral_local_notice("BACKFILL", signal)

    async def test_wrong_personal_account_aborts_before_handlers_and_releases_lock(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            fake, state = make_fake_telethon(user_id=OTHER)
            args = Namespace(mode="live", chats=None, exclude_chats=None,
                             all_chats=True, days=30, max_per_chat=2000)
            env = {"TELEGRAM_API_ID": "12345",
                   "TELEGRAM_API_HASH": "a" * 32,
                   "TELEGRAM_ALLOWED_USER_ID": str(OWNER)}
            with patch.dict(sys.modules, {"telethon": fake}):
                with patch.dict(os.environ, env, clear=True):
                    with self.assertRaisesRegex(SystemExit, "ACCOUNT_ID_MISMATCH"):
                        await mod.user_reader(args, root, "")
            self.assertTrue(state["instances"][0].disconnected)
            self.assertEqual(state["filters"], [])
            fd = mod.exclusive_worker_lock(root)
            os.close(fd)
            self.assertFalse((root / "owner-derived-signals.jsonl").exists())

    async def test_telethon_constructor_failure_still_releases_worker_lock(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            fake, state = make_fake_telethon(constructor_error=True)
            args = Namespace(mode="live", chats=None, exclude_chats=None,
                             all_chats=True, days=30, max_per_chat=2000)
            env = {"TELEGRAM_API_ID": "12345",
                   "TELEGRAM_API_HASH": "a" * 32,
                   "TELEGRAM_ALLOWED_USER_ID": str(OWNER)}
            with patch.dict(sys.modules, {"telethon": fake}):
                with patch.dict(os.environ, env, clear=True):
                    with self.assertRaisesRegex(RuntimeError, "FAKE_CONSTRUCTOR_ERROR"):
                        await mod.user_reader(args, root, "")
            fd = mod.exclusive_worker_lock(root)
            os.close(fd)
            self.assertEqual(len(state["instances"]), 0)

    async def test_telethon_disconnect_failure_releases_lock(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            fake, state = make_fake_telethon(disconnect_error=True)
            args = Namespace(mode="live", chats=None, exclude_chats=["@exclude"],
                             all_chats=True, days=30, max_per_chat=2000)
            env = {"TELEGRAM_API_ID": "12345",
                   "TELEGRAM_API_HASH": "a" * 32,
                   "TELEGRAM_ALLOWED_USER_ID": str(OWNER)}
            with patch.dict(sys.modules, {"telethon": fake}):
                with patch.dict(os.environ, env, clear=True):
                    with contextlib.redirect_stdout(io.StringIO()):
                        with self.assertRaisesRegex(RuntimeError, "FAKE_DISCONNECT_ERROR"):
                            await mod.user_reader(args, root, "")
            fd = mod.exclusive_worker_lock(root)
            os.close(fd)


if __name__ == "__main__":
    unittest.main()
