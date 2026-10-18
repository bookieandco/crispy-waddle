"""SHARK-LIVE.INTELLIGENCE.01–05 public-only pipeline acceptance; no network."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import experiment_7day as source
import public_mint_dossier as public
import shark_live_intelligence as live

MINT = public.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
PAIR = public.authority.native.pool_probe.encode_pubkey(bytes([8]) * 32)
OTHER_PAIR = public.authority.native.pool_probe.encode_pubkey(bytes([7]) * 32)
WSOL = "So11111111111111111111111111111111111111112"
START = dt.datetime(2026, 10, 17, 12, 0, tzinfo=dt.timezone.utc)


def at(hours=0, minutes=0, seconds=0):
    return (START + dt.timedelta(hours=hours, minutes=minutes, seconds=seconds)).isoformat().replace("+00:00", "Z")


def discovery(*mints):
    return ([{"chainId": "solana", "tokenAddress": x} for x in mints], [])


def report(*, mint=MINT, hours=0, minutes=0, price="0.001",
           liq=12000, pair=PAIR, mint_authority=False,
           freeze=False, include_pair=True, include_mint=True):
    stamp = at(hours=hours, minutes=minutes, seconds=3)
    info = {"supply": "100000000", "mintAuthority": MINT if mint_authority else None,
            "freezeAuthority": MINT if freeze else None}
    rpc = {"context": {"slot": 12345}, "value": {
        "owner": public.authority.LEGACY,
        "data": {"parsed": {"type": "mint", "info": info}}}} if include_mint else None
    pairs = ([{"chainId": "solana", "pairAddress": pair, "dexId": "pumpswap",
              "baseToken": {"address": mint}, "quoteToken": {"address": WSOL},
              "priceUsd": price, "liquidity": {"usd": liq},
              "pairCreatedAt": 1790000000000}] if include_pair else [])
    return public.compose_public_dossier(
        mint, account=rpc, pairs=pairs, rpc_observed_at=stamp,
        rpc_available_at=stamp, market_observed_at=stamp,
        market_available_at=stamp, information_cutoff=stamp)


class LivePublicIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = str(Path(self.tmp.name) / "local-public.sqlite")

    def database(self):
        return live.local_database(self.path)

    def test_first_public_observation_is_sealed_with_no_trade_authority(self):
        profiles, boosts = discovery(MINT)
        sent = []
        with self.database() as db:
            out = live.tick(db, now=at(seconds=7), profiles=profiles, boosts=boosts,
                            read_dossier=lambda mint: report(), deliver=lambda body: sent.append(body) or True)
            self.assertEqual(out["newlyDiscovered"], 1)
            self.assertEqual(out["checkedPublicMints"], 1)
            self.assertEqual(out["alertsAttempted"], 1)
            self.assertEqual(out["alertsAcknowledged"], 1)
            self.assertIs(out["canTrade"], False)
            self.assertIs(out["telegramDataIngested"], False)
            self.assertEqual(out["paper"]["openProspectiveCases"], 1)
            self.assertEqual(out["paper"]["priceOnlyPaperMarks"], 0)
            stored = db.execute("SELECT study_json,status FROM tokens WHERE mint=?", (MINT,)).fetchone()
            self.assertEqual(stored[1], "PUBLIC_PARTIAL_UNVERIFIED")
            self.assertEqual(json.loads(stored[0])["authority"], "RESEARCH_ONLY")
            self.assertNotIn("BUY", sent[0])
            self.assertNotIn("execute", sent[0].lower())
        self.assertEqual(Path(self.path).stat().st_mode & 0o777, 0o600)

    def test_24h_same_pool_price_only_outcome_never_executable(self):
        p,b = discovery(MINT)
        with self.database() as db:
            live.tick(db, now=at(seconds=7), profiles=p, boosts=b, read_dossier=lambda _: report())
            second = live.tick(db, now=at(hours=24, seconds=7), profiles=p, boosts=b,
                               read_dossier=lambda _: report(hours=24, price="0.0012", liq=13200))
            self.assertEqual(second["priceOnlyCasesGraded"], 1)
            self.assertEqual(second["paper"]["priceOnlyPaperMarks"], 1)
            self.assertIsNone(second["paper"]["noEdgeReferenceBrier"])
            self.assertEqual(second["paper"]["calibrationStatus"],
                             "INSUFFICIENT_PROSPECTIVE_PRICE_ONLY_OUTCOMES")
            self.assertFalse(second["paper"]["actualProfitsVerified"])
            study = json.loads(db.execute("SELECT study_json FROM tokens WHERE mint=?", (MINT,)).fetchone()[0])
            self.assertEqual(study["events"][-1]["priceOnlyReturnPct"], 20)
            self.assertIsNone(study["events"][-1]["hypotheticalNetReturnPct"])
            self.assertFalse(study["canTrade"])

    def test_early_poll_stays_unscored(self):
        p,b = discovery(MINT)
        with self.database() as db:
            live.tick(db, now=at(seconds=7), profiles=p, boosts=b, read_dossier=lambda _: report())
            out = live.tick(db, now=at(hours=3, seconds=7), profiles=p, boosts=b,
                            read_dossier=lambda _: report(hours=3, price="0.002"))
            self.assertEqual(out["priceOnlyCasesGraded"], 0)
            self.assertEqual(out["paper"]["openProspectiveCases"], 1)
            self.assertEqual(out["paper"]["priceOnlyPaperMarks"], 0)

    def test_pair_switch_is_censored_and_not_profitable(self):
        p,b = discovery(MINT)
        with self.database() as db:
            live.tick(db, now=at(seconds=7), profiles=p, boosts=b, read_dossier=lambda _: report())
            out = live.tick(db, now=at(hours=25,seconds=7), profiles=p, boosts=b,
                            read_dossier=lambda _: report(hours=25, pair=OTHER_PAIR, price="0.3"))
            self.assertEqual(out["paper"]["priceOnlyPaperMarks"], 0)
            self.assertEqual(out["paper"]["missingOrCensored"], 1)
            self.assertIsNone(out["paper"]["noEdgeReferenceBrier"])

    def test_unavailable_provider_does_not_create_false_case_or_alert(self):
        p,b = discovery(MINT)
        with self.database() as db:
            out = live.tick(db,now=at(seconds=7),profiles=p,boosts=b,
                            read_dossier=lambda _: report(include_mint=False),
                            deliver=lambda _: self.fail("should not notify"))
            self.assertEqual(out["quarantined"], 1)
            self.assertEqual(out["alertsAttempted"], 0)
            self.assertEqual(out["paper"]["openProspectiveCases"], 0)
            self.assertEqual(out["paper"]["missingOrCensored"], 1)

    def test_private_telegram_input_cannot_be_discovery_feed(self):
        with self.database() as db:
            fake = {"chat_id": 1234, "text": "/research-token " + MINT,
                    "forward_origin": {"private": True}}
            # Existing public candidate parser validates *list of public
            # chainId/tokenAddress objects*, not raw forwarded Telegram records.
            out = live.tick(db,now=at(seconds=7),profiles=[fake],boosts=[],
                            read_dossier=lambda _: self.fail("telegram leak"))
            self.assertEqual(out["newlyDiscovered"], 0)
            self.assertEqual(out["checkedPublicMints"], 0)

    def test_reference_tokens_filtered_and_non_solana_rejected(self):
        p,b = ([{"chainId": "solana", "tokenAddress": WSOL},
                 {"chainId": "ethereum", "tokenAddress": MINT}], [])
        with self.database() as db:
            out = live.tick(db,now=at(seconds=7),profiles=p,boosts=b,
                            read_dossier=lambda _: self.fail("reference should never reach RPC"))
            self.assertEqual(out["newlyDiscovered"], 0)
            self.assertEqual(out["checkedPublicMints"], 0)

    def test_dedupe_does_not_realert_same_public_mint(self):
        p,b = discovery(MINT)
        alerts = []
        with self.database() as db:
            live.tick(db,now=at(seconds=7),profiles=p,boosts=b,read_dossier=lambda _: report(),
                      deliver=lambda msg: alerts.append(msg) or True)
            out = live.tick(db,now=at(minutes=11,seconds=7),profiles=p,boosts=b,
                            read_dossier=lambda _: report(minutes=11),
                            deliver=lambda msg: alerts.append(msg) or True)
            self.assertEqual(out["newlyDiscovered"], 0)
            self.assertEqual(out["alertsAttempted"], 0)
            self.assertEqual(len(alerts), 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM tokens").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0], 1)

    def test_severity_change_is_new_research_alert_not_an_entry_signal(self):
        p,b = discovery(MINT)
        sent=[]
        with self.database() as db:
            live.tick(db,now=at(seconds=7),profiles=p,boosts=b,read_dossier=lambda _: report(),
                      deliver=lambda msg: sent.append(msg) or True)
            out = live.tick(db,now=at(minutes=11,seconds=7),profiles=p,boosts=b,
                            read_dossier=lambda _: report(minutes=11,mint_authority=True),
                            deliver=lambda msg: sent.append(msg) or True)
            self.assertEqual(out["alertsAttempted"], 1)
            self.assertIn("MINT_AUTHORITY_ACTIVE", sent[-1])
            self.assertIn("NOT a trade alert", sent[-1])

    def test_uncertain_notification_is_at_most_once_not_replayed(self):
        p,b = discovery(MINT)
        attempts=[]
        with self.database() as db:
            live.tick(db,now=at(seconds=7),profiles=p,boosts=b,read_dossier=lambda _: report(),
                      deliver=lambda _: (attempts.append(True), False)[1])
            self.assertEqual(db.execute("SELECT delivery FROM outbox").fetchone()[0],
                             "UNCERTAIN_NO_RETRY")
            live.tick(db,now=at(minutes=11,seconds=7),profiles=p,boosts=b,
                      read_dossier=lambda _: report(minutes=11),
                      deliver=lambda _: (attempts.append(True), True)[1])
            self.assertEqual(len(attempts), 1)

    def test_caps_limit_public_requests_and_notification_volume(self):
        mints=[public.authority.native.pool_probe.encode_pubkey(bytes([n])*32)
               for n in range(1,12)]
        p,b=discovery(*mints)
        seen=[]
        sent=[]
        with self.database() as db:
            out=live.tick(db,now=at(seconds=7),profiles=p,boosts=b,
                          read_dossier=lambda mint: (seen.append(mint),report(mint=mint))[1],
                          deliver=lambda body: sent.append(body) or True)
            self.assertEqual(out["newlyDiscovered"], live.MAX_NEW)
            self.assertEqual(len(seen), live.MAX_NEW)
            self.assertLessEqual(len(sent), live.MAX_ALERTS_PER_CYCLE)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM tokens").fetchone()[0],live.MAX_NEW)

    def test_missed_outcome_is_censored_and_capacity_recycled(self):
        p,b=discovery(MINT)
        with self.database() as db:
            live.tick(db,now=at(seconds=7),profiles=p,boosts=b,read_dossier=lambda _: report())
            out=live.tick(db,now=at(hours=37,seconds=7),profiles=[],boosts=[],
                          read_dossier=lambda _:self.fail("expired should not be rechecked"))
            self.assertEqual(out["paper"]["openProspectiveCases"],0)
            self.assertEqual(out["paper"]["missingOrCensored"],1)
            self.assertEqual(db.execute("SELECT status FROM tokens").fetchone()[0],"CENSORED_NO_FOLLOWUP")

    def test_higher_than_one_day_missed_price_not_backfilled(self):
        p,b=discovery(MINT)
        with self.database() as db:
            live.tick(db,now=at(seconds=7),profiles=p,boosts=b,read_dossier=lambda _: report())
            out=live.tick(db,now=at(hours=31,seconds=7),profiles=[],boosts=[],
                          read_dossier=lambda _:report(hours=31,price="100"))
            self.assertEqual(out["paper"]["priceOnlyPaperMarks"],0)
            self.assertEqual(out["paper"]["missingOrCensored"],1)

    def test_tick_rejects_untrusted_future_quote_and_prevents_scoring(self):
        p,b=discovery(MINT)
        with self.database() as db:
            out=live.tick(db,now=at(seconds=7),profiles=p,boosts=b,
                          read_dossier=lambda _:report(hours=1),
                          clock_now=lambda:at(seconds=7))
            self.assertEqual(out["quarantined"],1)
            self.assertEqual(out["paper"]["priceOnlyPaperMarks"],0)

    def test_local_permissions_invalid_paths_and_owner_alert_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,"absolute_existing_parent"):
                with live.local_database("relative.db"): pass
            bad = Path(tmp)/"bad.db"
            bad.write_bytes(b"")
            bad.chmod(0o644)
            with self.assertRaisesRegex(ValueError,"insecure_file"):
                with live.local_database(str(bad)): pass
        with patch.dict(live.os.environ,{},clear=True):
            with self.assertRaisesRegex(ValueError, "not_enabled"):
                live._private_sender()
        with patch.dict(live.os.environ,{"ENABLE_SHARK_PUBLIC_ALERTS":"true"},clear=True):
            with self.assertRaisesRegex(ValueError,"credentials_invalid"):
                live._private_sender()

    def test_audit_does_not_contact_any_provider(self):
        with self.database() as db:
            self.assertEqual(live._read_summary(db)["observedPublicTokens"],0)
            self.assertFalse(live._read_summary(db)["calibratedEntryOrExitSignal"])
        with patch.object(live,"read_public_feeds",side_effect=AssertionError("network")):
            self.assertEqual(live.main(["--mode","audit","--state",self.path]),0)

    def test_replay_cycle_receipts_unique(self):
        p,b=discovery(MINT)
        with self.database() as db:
            live.tick(db,now=at(seconds=7),profiles=p,boosts=b,read_dossier=lambda _:report())
            with self.assertRaisesRegex(ValueError, "duplicate_public_cycle_timestamp"):
                live.tick(db,now=at(seconds=7),profiles=p,boosts=b,
                          read_dossier=lambda _:self.fail("duplicate must not read providers"))
            self.assertEqual(db.execute("SELECT COUNT(*) FROM cycles").fetchone()[0],1)


if __name__=="__main__":
    unittest.main()
