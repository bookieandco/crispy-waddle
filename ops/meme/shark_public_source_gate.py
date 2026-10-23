"""Public-market SHARK research gate; Telegram is not a data source here.

Use canonical public_alpha_canary_once rather than building a second coin
scanner. No Telegram content, imported session, AI training, sniper execution,
wallet credentials, network server or trade authorization.
"""
from __future__ import annotations

import json
from typing import Callable

import public_alpha_canary_once as canary

SCHEMA = "jhadina.shark.public-only-research-admission.v1"
ORIGIN = "OWNER_ENTERED_INDEPENDENT_PUBLIC_MARKET"
DISALLOWED_SOURCE_TYPES = {"TELEGRAM", "TELEGRAM_FORWARD", "PRIVATE_CHAT",
                           "TELEGRAM_USER_SESSION", "BOT_INBOX"}


class PublicOnlySourceDenied(ValueError):
    pass


def public_market_probe(*, source_kind: str, mint: str, confirm: str,
                        reader: Callable | None = None) -> dict:
    """Sends only explicitly owner-entered public mint to existing canary.

    This gate cannot prove why the owner selected a mint; it MUST NOT be
    represented as automatic provider discovery, Telegram AI permission, or
    an execution permit. Caller is responsible for honest source attribution.
    """
    if source_kind != ORIGIN or source_kind in DISALLOWED_SOURCE_TYPES:
        raise PublicOnlySourceDenied("PUBLIC_MARKET_INDEPENDENT_SOURCE_REQUIRED")
    if not isinstance(mint, str) or len(mint) > 44:
        raise PublicOnlySourceDenied("PUBLIC_MARKET_MINT_FORMAT_REQUIRED")
    # Existing canonical canary validates explicit confirmation, RPC/DEX
    # dossier chronology and reference assets. No alternative data adapter.
    if reader is None:
        evaluated = canary.run(mint, confirm=confirm)
    else:
        evaluated = canary.run(mint, confirm=confirm, reader=reader)
    status = evaluated["status"]
    partial = (
        status == "PUBLIC_MARKET_PARTIAL_NOT_ALPHA"
        and evaluated["observationUsableForLocalPaperStudy"] is True
        and evaluated["telegramDataUsed"] is False
        and evaluated["aiModelUsed"] is False
        and evaluated["canTrade"] is False
        and evaluated["canSign"] is False
        and evaluated["canBroadcast"] is False
    )
    return {
        "schema": SCHEMA,
        "sourceClass": "OWNER_ATTESTED_INDEPENDENT_PUBLIC_PROBE",
        "status": "PAPER_REVIEW_ELIGIBLE" if partial else "QUARANTINED_OR_REFERENCE_ONLY",
        "marketProviderHealth": status,
        "publicResearchPartial": partial,
        "providerOriginIndependentlyAttested": False,
        "sourceIndependenceProvenByCode": False,
        "telegramRead": False,
        "telegramDataImported": False,
        "modelTraining": False,
        "persistentSignal": False,
        "sharkAutomatedIngressStarted": False,
        "sniperTradeIntent": False,
        "canTrade": False,
        "canSign": False,
        "canBroadcast": False,
    }


def classify_without_network(*, source_kind: str, mint: str,
                             confirm: str, reader: Callable) -> str:
    """Explicit injected reader only; useful for offline tests, not runtime."""
    return json.dumps(public_market_probe(source_kind=source_kind, mint=mint,
                     confirm=confirm, reader=reader), sort_keys=True)
