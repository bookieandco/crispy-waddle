"""Prospective public-market paper research: offline, fail closed, no Telegram."""
from __future__ import annotations
import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent
sp = importlib.util.spec_from_file_location("alpha_04_05", HERE / "public_alpha_study.py")
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)

from public_mint_dossier import authority, compose_public_dossier
MINT = authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
PAIR = authority.native.pool_probe.encode_pubkey(bytes([8]) * 32)
PAIR2 = authority.native.pool_probe.encode_pubkey(bytes([7]) * 32)
WSOL = "So11111111111111111111111111111111111111112"
BASE = dt.datetime(2026, 10, 17, 0, 0, tzinfo=dt.timezone.utc)


def at(hours=0, seconds=0):
    return (BASE + dt.timedelta(hours=hours, seconds=seconds)).isoformat().replace("+00:00", "Z")


def dossier(*, hours=0, price="0.001", liq=12000, mint=MINT, pair=PAIR,
            empty=False, reference=False):
    mint = WSOL if reference else mint
    info = {"supply": "100000000", "mintAuthority": None, "freezeAuthority": None}
    account = {"context": {"slot": 12345}, "value": {
        "owner": authority.LEGACY, "data": {"parsed": {"type": "mint", "info": info}}}}
    pairs = [] if empty else [{"chainId": "solana", "pairAddress": pair,
        "baseToken": {"address": mint}, "quoteToken": {"address": WSOL},
        "priceUsd": price, "liquidity": {"usd": liq}, "dexId": "pumpswap",
        "pairCreatedAt": 1790000000000}]
    return compose_public_dossier(
        mint, account=account, pairs=pairs,
        rpc_observed_at=at(hours), rpc_available_at=at(hours, 1),
        market_observed_at=at(hours, 2), market_available_at=at(hours, 3),
        information_cutoff=at(hours, 5))


class AlphaPublicStudyTests(unittest.TestCase):
    def test_first_receipt_is_price_only_and_tamper_evident(self):
        d = dossier()
        snapshot = copy.deepcopy(d)
        study = m.start(d)
        self.assertEqual(d, snapshot)
        self.assertEqual(study["status"], "OPEN")
        self.assertEqual(study["events"][0]["type"], "FIRST_UNATTESTED_PUBLIC_MARKET")
        self.assertIs(m.check_study(study), study)
        self.assertFalse(study["canTrade"])
        self.assertFalse(study["backtestAuthorized"])
        self.assertEqual(m.summary(study)["mark"], "UNSCORED_OPEN")
        corrupted = copy.deepcopy(study)
        corrupted["events"][0]["priceUsd"] *= 50
        with self.assertRaisesRegex(ValueError, "digest_invalid"):
            m.check_study(corrupted)

    def test_true_24_hour_same_pair_price_mark_only(self):
        first = m.start(dossier())
        initial_copy = copy.deepcopy(first)
        out = m.follow(first, dossier(hours=24, price="0.0012", liq=13200))
        self.assertEqual(first, initial_copy)
        self.assertEqual(out["status"], "CLOSED")
        item = out["events"][-1]
        self.assertEqual(item["type"], "PRICE_ONLY_UNVERIFIED")
        self.assertEqual(item["priceOnlyReturnPct"], 20)
        self.assertEqual(item["liquidityChangePctReported"], 10)
        summary = m.summary(out)
        self.assertEqual(summary["priceOnlyReturnPct"], 20)
        self.assertIsNone(summary["executableReturnPct"])
        self.assertIsNone(summary["hypotheticalNetReturnPct"])
        self.assertIsNone(summary["profitableTradeCount"])
        self.assertEqual(summary["paperEntries"], 0)
        self.assertEqual(summary["executedTrades"], 0)
        self.assertFalse(summary["providerEvidenceCryptographicallyAttested"])

    def test_early_followup_does_not_pregrade_and_later_mark_closes(self):
        start = m.start(dossier())
        early = m.follow(start, dossier(hours=12, price="0.0011"))
        self.assertEqual(early["status"], "OPEN")
        self.assertIsNone(early["events"][-1]["priceOnlyReturnPct"])
        self.assertEqual(early["events"][-1]["type"], "PRE_HORIZON_OBSERVATION")
        later = m.follow(early, dossier(hours=27, price="0.0007"))
        self.assertEqual(later["status"], "CLOSED")
        self.assertEqual(m.summary(later)["priceOnlyReturnPct"], -30)
        with self.assertRaisesRegex(ValueError, "already_closed"):
            m.follow(later, dossier(hours=28))

    def test_missed_horizon_and_pair_switch_are_censored(self):
        a = m.follow(m.start(dossier()), dossier(hours=31))
        self.assertEqual(m.summary(a)["mark"], "HORIZON_MISSED_CENSORED")
        self.assertIsNone(m.summary(a)["priceOnlyReturnPct"])
        b = m.follow(m.start(dossier()), dossier(hours=25, pair=PAIR2, price="0.05"))
        self.assertEqual(m.summary(b)["mark"], "PAIR_SWITCH_CENSORED")
        self.assertIsNone(m.summary(b)["priceOnlyReturnPct"])

    def test_reference_mint_cannot_enter_study(self):
        with self.assertRaisesRegex(ValueError, "reference_or_source"):
            m.start(dossier(reference=True))

    def test_market_missing_and_stale_dossier_rejected(self):
        with self.assertRaisesRegex(ValueError, "incomplete_or_stale"):
            m.start(dossier(empty=True))
        with self.assertRaisesRegex(ValueError, "incomplete_or_stale"):
            m.follow(m.start(dossier()), dossier(empty=True, hours=25))

    def test_idempotent_exact_replay_but_out_of_order_new_evidence_rejected(self):
        first = m.start(dossier())
        early = dossier(hours=12)
        event = m.follow(first, early)
        self.assertEqual(m.follow(event, early), event)
        with self.assertRaisesRegex(ValueError, "nonprospective_clock"):
            m.follow(event, dossier(hours=2))

    def test_mint_mismatch_digest_mismatch_and_forged_authority_rejected(self):
        base = dossier()
        with self.assertRaisesRegex(ValueError, "digest_invalid"):
            m.start({**base, "mint": PAIR2})
        forged = dict(base)
        forged["canTrade"] = True
        forged["receiptDigest"] = m.digest({k:v for k,v in forged.items() if k != "receiptDigest"})
        with self.assertRaisesRegex(ValueError, "authority_invalid"):
            m.start(forged)
        first = m.start(base)
        with self.assertRaisesRegex(ValueError, "mint_mismatch"):
            m.follow(first, dossier(hours=24, mint=PAIR2))

    def test_public_only_origin_and_forged_telegram_provenance_rejected(self):
        bad = dossier()
        bad["origin"] = "FORWARDED_TELEGRAM"
        bad["receiptDigest"] = m.digest({k:v for k,v in bad.items() if k != "receiptDigest"})
        with self.assertRaisesRegex(ValueError, "reference_or_source"):
            m.start(bad)

    def test_exclusive_permissions_no_overwrite_and_summary(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "study.json"
            study = m.start(dossier())
            m.write_new(str(p), study)
            self.assertEqual(m.check_study(m.read_json(str(p))), study)
            self.assertEqual(p.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                m.write_new(str(p), study)
            p2 = Path(td) / "link.json"
            p2.symlink_to(p)
            with self.assertRaisesRegex(ValueError, "missing_or_unsafe"):
                m.read_json(str(p2))
            self.assertEqual(m.main(["summary", "--study", str(p)]), 0)


if __name__ == "__main__":
    unittest.main()
