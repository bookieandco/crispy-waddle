#!/usr/bin/env python3
"""SHARK-LIVE.ACCEPT.12–.15: SYNTHETIC multi-cycle/recovery certification.

This is a zero-network deterministic rehearsal of the canonical public SHARK
worker. Synthetic prices and timing are fixture values, NEVER market results.
It reopens an owner-private SQLite database between cycles, proves conservative
24–30h paper marks and censoring, interruption rollback and at-most-once
Telegram-OUTPUT semantics. An existing real ledger may be audited read-only
at the application level (no provider requests or Telegram calls).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import sqlite3
import sys
import tempfile

import public_mint_dossier as dossier
import shark_live_commission as commission
import shark_live_intelligence as worker

SCHEMA = "SHARK-LIVE-ACCEPTANCE-12-15-SYNTHETIC-V1"
BASE = dt.datetime(2026, 10, 17, 12, 0, tzinfo=dt.timezone.utc)
WSOL = "So11111111111111111111111111111111111111112"
MINT_A = dossier.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
MINT_B = dossier.authority.native.pool_probe.encode_pubkey(bytes([6]) * 32)
PAIR_A = dossier.authority.native.pool_probe.encode_pubkey(bytes([8]) * 32)
PAIR_B = dossier.authority.native.pool_probe.encode_pubkey(bytes([7]) * 32)


def timestamp(hours: int, *, seconds: int) -> str:
    return (BASE + dt.timedelta(hours=hours, seconds=seconds)).isoformat().replace("+00:00", "Z")


def sample_public_dossier(mint: str, *, hours: int, price: str) -> dict:
    """Construct explicitly SYNTHETIC public-schema test evidence; not a lookup."""
    if mint not in (MINT_A, MINT_B) or hours not in (0, 3, 4, 24):
        raise ValueError("synthetic_fixture_outside_bounds")
    pair = PAIR_A if mint == MINT_A else PAIR_B
    account = {"context": {"slot": 12345 + hours}, "value": {
        "owner": dossier.authority.LEGACY,
        "data": {"parsed": {"type": "mint", "info": {
            "supply": "900000000", "mintAuthority": None,
            "freezeAuthority": None,
        }}}}}
    pairs = [{
        "chainId": "solana", "pairAddress": pair, "dexId": "pumpswap",
        "baseToken": {"address": mint}, "quoteToken": {"address": WSOL},
        "priceUsd": price, "liquidity": {"usd": 12000},
        "pairCreatedAt": 1790000000000,
    }]
    stamp = timestamp(hours, seconds=3)
    return dossier.compose_public_dossier(
        mint, account=account, pairs=pairs,
        rpc_observed_at=stamp, rpc_available_at=stamp,
        market_observed_at=stamp, market_available_at=stamp,
        information_cutoff=stamp,
    )


def _feed():
    return ([{"chainId": "solana", "tokenAddress": MINT_A},
             {"chainId": "solana", "tokenAddress": MINT_B}], [])


def _run_cycle(db_path: str, hour: int, reader, deliver=None) -> dict:
    with worker.local_database(db_path) as db:
        profiles, boosts = _feed() if hour == 0 else ([], [])
        return worker.tick(
            db, now=timestamp(hour, seconds=7), profiles=profiles,
            boosts=boosts, read_dossier=reader, deliver=deliver,
        )


def _assert_research_only(result: dict) -> None:
    if (result.get("canTrade") is not False or
            result.get("canSign") is not False or
            result.get("canBroadcast") is not False or
            result.get("telegramDataIngested") is not False or
            result.get("providerEvidenceIndependentlyAttested") is not False or
            result["paper"]["actualProfitsVerified"] is not False or
            result["paper"]["calibratedEntryOrExitSignal"] is not False):
        raise ValueError("synthetic_rehearsal_authority_violation")


def rehearse() -> dict:
    """Certify separated local process-like opens; no data leaves temp storage."""
    with tempfile.TemporaryDirectory(prefix="shark-multicycle-synthetic-") as root:
        db_path = str(Path(root) / "public-ledger.sqlite3")
        send_attempts: list[str] = []

        def uncertain_first_alert(body: str) -> bool:
            send_attempts.append(body)
            return len(send_attempts) != 1  # simulates first uncertain ACK

        first = _run_cycle(
            db_path, 0,
            lambda mint: sample_public_dossier(
                mint, hours=0, price="0.001" if mint == MINT_A else "0.005"),
            deliver=uncertain_first_alert,
        )
        _assert_research_only(first)
        if (first["newlyDiscovered"] != 2 or first["checkedPublicMints"] != 2
                or first["paper"]["openProspectiveCases"] != 2
                or first["alertsAttempted"] != 2 or first["alertsAcknowledged"] != 1):
            raise ValueError("synthetic_first_cycle_contract_failed")
        with worker.local_database(db_path) as db:
            restored_before = commission.restore_drill(db)
            if restored_before["sourceRecords"] != 2:
                raise ValueError("synthetic_initial_restore_failed")

        early = _run_cycle(
            db_path, 3,
            lambda mint: sample_public_dossier(
                mint, hours=3, price="0.0011" if mint == MINT_A else "0.0045"),
            deliver=uncertain_first_alert,
        )
        _assert_research_only(early)
        if (early["paper"]["priceOnlyPaperMarks"] != 0
                or early["paper"]["openProspectiveCases"] != 2):
            raise ValueError("synthetic_pre_horizon_wrongly_graded")

        # Simulate a crash AFTER a pending read; a missing cycle must not be
        # manufactured as an early observation or sent as a new notification.
        try:
            _run_cycle(
                db_path, 4,
                lambda mint: (_ for _ in ()).throw(
                    RuntimeError("synthetic_injected_process_crash")),
                deliver=uncertain_first_alert,
            )
        except RuntimeError:
            pass
        else:
            raise ValueError("synthetic_crash_did_not_interrupt")
        with worker.local_database(db_path) as db:
            count = db.execute("SELECT COUNT(*) FROM cycles").fetchone()[0]
            if count != 2:
                raise ValueError("synthetic_interrupted_cycle_was_persisted")
            status = db.execute(
                "SELECT delivery FROM outbox WHERE delivery='UNCERTAIN_NO_RETRY'"
            ).fetchall()
            if len(status) != 1:
                raise ValueError("synthetic_uncertain_delivery_replayed")
        replay = _run_cycle(
            db_path, 4,
            lambda mint: sample_public_dossier(
                mint, hours=4, price="0.00115" if mint == MINT_A else "0.0046"),
            deliver=uncertain_first_alert,
        )
        _assert_research_only(replay)
        if replay["priceOnlyCasesGraded"] != 0 or replay["alertsAttempted"] != 0:
            raise ValueError("synthetic_recovery_replayed_alerts")

        def late(mint: str) -> dict:
            if mint == MINT_B:
                raise ValueError("synthetic_missing_later_provider_evidence")
            return sample_public_dossier(mint, hours=24, price="0.0012")

        later = _run_cycle(db_path, 24, late, deliver=uncertain_first_alert)
        _assert_research_only(later)
        if later["priceOnlyCasesGraded"] != 1 or later["quarantined"] != 1:
            raise ValueError("synthetic_valid_or_missing_paper_not_classified")
        censored = _run_cycle(
            db_path, 37,
            lambda _: (_ for _ in ()).throw(
                AssertionError("expired_public_case_must_not_be_researched")),
            deliver=uncertain_first_alert,
        )
        _assert_research_only(censored)
        if (censored["paper"]["priceOnlyPaperMarks"] != 1 or
                censored["paper"]["missingOrCensored"] != 1 or
                censored["paper"]["openProspectiveCases"] != 0 or
                censored["paper"]["noEdgeReferenceBrier"] is not None):
            raise ValueError("synthetic_unobserved_followup_treated_as_alpha")

        with worker.local_database(db_path) as db:
            restored_after = commission.restore_drill(db)
            paper_rows = db.execute(
                "SELECT mint,study_json,status FROM tokens ORDER BY mint").fetchall()
            outcomes = []
            for mint, raw, state in paper_rows:
                if not raw:
                    raise ValueError("synthetic_missing_first_public_case")
                study = worker.paper.check_study(json.loads(raw))
                outcomes.append((mint, study, state))
            grades = [(m, s) for m, s, _ in outcomes if s["status"] == "CLOSED"]
            if len(grades) != 1 or grades[0][0] != MINT_A:
                raise ValueError("synthetic_paper_case_invalid")
            final = grades[0][1]["events"][-1]
            if (final["type"] != "PRICE_ONLY_UNVERIFIED"
                    or final["priceOnlyReturnPct"] != 20
                    or final["executableReturnPct"] is not None
                    or final["realizedFill"] is not False):
                raise ValueError("synthetic_executable_return_invented")
            if len([x for x in outcomes if x[2] == "CENSORED_NO_FOLLOWUP"]) != 1:
                raise ValueError("synthetic_censored_case_missing")
            if db.execute("SELECT COUNT(*) FROM cycles").fetchone()[0] != 5:
                raise ValueError("synthetic_cycles_not_preserved")
            outbox = dict(db.execute(
                "SELECT delivery,COUNT(*) FROM outbox GROUP BY delivery").fetchall())
            if outbox.get("UNCERTAIN_NO_RETRY") != 1:
                raise ValueError("synthetic_uncertain_alert_lost")

        return {
            "schema": SCHEMA,
            "status": "SYNTHETIC_MULTICYCLE_AND_LOCAL_RESTORE_PROVED_NOT_LIVE",
            "publicMarketLiveDataUsed": False,
            "syntheticPriceOnlyMarks": 1,
            "syntheticMissedOrCensored": 1,
            "syntheticCyclesAcrossSeparateDatabaseOpens": 5,
            "interruptedPendingCycleRolledBack": True,
            "uncertainTelegramOutputNeverRetried": True,
            "localSnapshotRestoreBeforeAndAfterVerified": (
                restored_before["status"] == restored_after["status"]
                == "LOCAL_SNAPSHOT_RESTORE_PROVEN"
            ),
            "offHostEncryptedRestoreVerified": False,
            "phonePrivateTelegramDeliveryVerified": False,
            "telegramMessagesRead": False,
            "telegramMessageBasedAiTraining": False,
            "providerIndependentAttestation": False,
            "marketAlphaOrProfitVerified": False,
            "continuousProductionHostCommissioned": False,
            "canTrade": False, "canSign": False, "canBroadcast": False,
        }


def audit_owner_ledger(path: str) -> dict:
    """Non-network, no Telegram, EXISTING private SQLite file only."""
    commission._secure_file(path, must_exist=True)
    with worker.local_database(path) as db:
        validity = commission.audit_db(db)
        # Never log public mint IDs or source rows.
        result = {
            "schema": SCHEMA,
            "status": "LOCAL_PUBLIC_LEDGER_AUDITED_NOT_EXTERNAL_PROOF",
            "publicMintCount": validity["totalPublicMints"],
            "priceOnlyPaperMarks": validity["priceOnlyCases"],
            "localLedgerFingerprint": validity["fingerprint"],
            "providerEvidenceIndependentlyAttested": False,
            "offHostEncryptedRestoreVerified": False,
            "phonePrivateTelegramDeliveryVerified": False,
            "canTrade": False,
        }
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["synthetic-rehearsal", "audit-existing"],
                        required=True)
    parser.add_argument("--state", default="")
    args = parser.parse_args(argv)
    try:
        if args.mode == "synthetic-rehearsal" and not args.state:
            data = rehearse()
        elif args.mode == "audit-existing" and args.state:
            data = audit_owner_ledger(args.state)
        else:
            raise ValueError("acceptance_mode_invalid")
        print(json.dumps(data, sort_keys=True))
        return 0
    except (ValueError, TypeError, KeyError, OSError, sqlite3.Error, RuntimeError,
            AssertionError):
        print("SHARK_MULTICYCLE_ACCEPTANCE_FAIL_CLOSED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
