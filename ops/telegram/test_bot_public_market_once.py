"""ALPHA.11: hermetic, manually authorized private public-market report tests."""
from __future__ import annotations

import io
import json
from contextlib import redirect_stdout
import unittest
from unittest.mock import patch

import bot_public_market_once as subject

OWNER = 123456789
ATTACKER = 7654321
NOW = 1791867200
TAG = "JHADINA-SHARK-06"
WSOL = "So11111111111111111111111111111111111111112"
MINT = subject.public.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
PAIR = subject.public.authority.native.pool_probe.encode_pubkey(bytes([8]) * 32)


def message(uid: int, text: str, *, sender: int=OWNER, time: int=NOW-5,
            forwarded: bool=False, edited: bool=False, private: bool=True,
            via_bot: bool=False):
    msg = {"date": time, "text": text,
           "chat": {"type": "private" if private else "group", "id": sender},
           "from": {"id": sender}}
    if forwarded:
        msg["forward_origin"] = {"type": "channel", "date": time-300,
                                 "chat": {"id": -1005, "title": "PRIVATE CHAT"}}
    if edited:
        msg["edit_date"] = time
    if via_bot:
        msg["via_bot"] = {"id": 44}
    return {"update_id": uid, "message": msg}


def digest(sender=OWNER, **kwargs):
    return message(80, "/research-digest " + TAG, sender=sender, **kwargs)


def dossier(mint=MINT, *, include_account=True, include_pair=True,
            suspicious=False):
    info = {"supply": "100000000",
            "mintAuthority": MINT if suspicious else None,
            "freezeAuthority": MINT if suspicious else None}
    account = {"context": {"slot": 1234}, "value": {
        "owner": subject.public.authority.LEGACY,
        "data": {"parsed": {"type": "mint", "info": info}}}} if include_account else None
    pairs = [{"chainId": "solana", "pairAddress": PAIR,
              "baseToken": {"address": mint}, "quoteToken": {"address": WSOL},
              "priceUsd": "0.001", "liquidity": {"usd": 19000}, "dexId": "pumpswap",
              "pairCreatedAt": 1790000000000}] if include_pair else []
    stamp = "2026-10-17T23:58:00Z"
    return subject.public.compose_public_dossier(
        mint, account=account, pairs=pairs,
        rpc_observed_at=stamp, rpc_available_at=stamp,
        market_observed_at=stamp, market_available_at=stamp,
        information_cutoff=stamp)


class PublicOwnerMarketTests(unittest.TestCase):
    def test_no_market_read_without_fresh_owner_digest(self):
        readers, sends, operations = [], [], []
        with patch.object(subject, "validate_preflight"):
            with patch.object(subject, "bot_api", side_effect=lambda tok, method, params:
                              (operations.append((method,params)),
                               {"result": [digest(sender=ATTACKER)]})[1]):
                with patch.object(subject, "send_private_preview",
                                  side_effect=lambda *args: sends.append(args)):
                    result = subject.execute_once("fake-secret", OWNER, TAG, MINT, NOW,
                                                  reader=lambda m: readers.append(m))
        self.assertFalse(result)
        self.assertEqual(readers, [])
        self.assertEqual(sends, [])
        self.assertEqual(operations, [
            ("getUpdates", {"offset": 0, "limit": 100, "timeout": 0})])

    def test_private_authorization_disallows_forward_edit_expired_via_bot_and_group(self):
        altered = [
            digest(forwarded=True),
            digest(edited=True),
            digest(time=NOW-901),
            digest(via_bot=True),
            digest(private=False),
            digest(sender=ATTACKER),
            message(15, "/research-digest OTHER-TAG"),
            message(16, "/research-market " + MINT),
        ]
        self.assertFalse(subject.owner_authorized(altered, OWNER, TAG, NOW))
        self.assertTrue(subject.owner_authorized([digest()], OWNER, TAG, NOW))
        with self.assertRaisesRegex(subject.SmokeCheckError, "INBOX_UNAVAILABLE"):
            subject.owner_authorized([digest()] * 101, OWNER, TAG, NOW)

    def test_wrong_network_or_format_fails_before_telegram_and_public_apis(self):
        for mint in ("", "0x" + "ab" * 20, "PRIVATE TELEGRAM POST", MINT + ";curl x"):
            with patch.object(subject, "validate_preflight") as preflight:
                with self.assertRaisesRegex(subject.SmokeCheckError, "REQUEST_INVALID"):
                    subject.execute_once("secret", OWNER, TAG, mint, NOW)
                preflight.assert_not_called()

    def test_real_public_dossier_fields_reach_owner_only(self):
        sent, observed = [], []
        with patch.object(subject, "validate_preflight"):
            with patch.object(subject, "bot_api", return_value={"result": [digest()]}):
                with patch.object(subject, "send_private_preview",
                                  side_effect=lambda t, u, msg: sent.append((u, msg))):
                    result = subject.execute_once(
                        "secret", OWNER, TAG, MINT, NOW,
                        reader=lambda mint: (observed.append(mint), dossier(mint, suspicious=True))[1])
        self.assertTrue(result)
        self.assertEqual(observed, [MINT])
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][0], OWNER)
        body = sent[0][1]
        for flag in ("Mint account parsed: YES", "Eligible market pair: YES",
                     "Mint authority active: YES", "Freeze authority active: YES",
                     "Provider-reported price USD: 0.001",
                     "Provider-reported liquidity USD: 19000",
                     "Migration, holder independence, transferability and sellability NOT verified.",
                     "No saved market study"):
            self.assertIn(flag, body)
        self.assertNotIn("PRIVATE CHAT", body)
        self.assertNotIn(str(OWNER), body)
        self.assertNotIn("safe investment", body)
        self.assertLess(len(body), 3200)

    def test_reference_mint_never_called_new_launch(self):
        report = subject.public_reply(WSOL, dossier(WSOL))
        self.assertIn("Known native reference asset, NOT a launch lead", report)
        self.assertIn("NOT safety certification", report)

    def test_missing_rpc_or_market_quarantines_without_fabricated_data(self):
        for item in (dossier(include_account=False), dossier(include_pair=False), None):
            report = subject.public_reply(MINT, item)
            self.assertIn("QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE", report)
            self.assertNotIn("Mint account parsed: YES\nEligible market pair: YES", report)
            self.assertIn("No executable quote", report)

    def test_tampered_receipt_and_market_injection_are_not_reproduced(self):
        item = dossier()
        item["receiptDigest"] = "0" * 64
        item["marketPair"]["dex"] = "<secret>\nAPI_KEY=DO_NOT_LOG"
        report = subject.public_reply(MINT, item)
        self.assertIn("QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE", report)
        self.assertNotIn("DO_NOT_LOG", report)
        self.assertIn("Mint account parsed: NO", report)

    def test_provider_exception_returns_private_quarantine_not_trace(self):
        sent = []
        with patch.object(subject, "validate_preflight"):
            with patch.object(subject, "bot_api", return_value={"result": [digest()]}):
                with patch.object(subject, "send_private_preview",
                                  side_effect=lambda t, o, report: sent.append(report)):
                    self.assertTrue(subject.execute_once(
                        "secret", OWNER, TAG, MINT, NOW,
                        reader=lambda mint: (_ for _ in ()).throw(
                            ValueError("MY_SUPER_SECRET_SERVER_TOKEN"))))
        self.assertEqual(len(sent), 1)
        self.assertIn("QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE", sent[0])
        self.assertNotIn("MY_SUPER_SECRET_SERVER_TOKEN", sent[0])

    def test_owner_secret_and_logs_redacted(self):
        with patch.dict(subject.os.environ, {
            "TELEGRAM_BOT_TOKEN": "VERY_SECRET",
            "TELEGRAM_ALLOWED_USER_ID": str(OWNER),
            "TELEGRAM_RESEARCH_TAG": TAG,
            "SHARK_PUBLIC_MINT": MINT}, clear=True):
            with patch.object(subject, "execute_once", return_value=True):
                stream = io.StringIO()
                with redirect_stdout(stream):
                    self.assertEqual(subject.main(), 0)
                content = stream.getvalue()
                self.assertIn("PRIVATE_OWNER_PUBLIC_MARKET_REPORT_SENT", content)
                for secret in ("VERY_SECRET", str(OWNER), TAG, MINT):
                    self.assertNotIn(secret, content)
        with patch.dict(subject.os.environ, {
            "TELEGRAM_BOT_TOKEN": "VERY_SECRET",
            "TELEGRAM_ALLOWED_USER_ID": ""}, clear=True):
            with patch.object(subject, "execute_once") as execute:
                self.assertEqual(subject.main(), 1)
                execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
