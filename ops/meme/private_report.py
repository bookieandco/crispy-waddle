#!/usr/bin/env python3
"""Optional, owner-only SHARK memecoin summary. No private inbox reading.

Default disabled. Uses existing owner-scoped Telegram secrets when explicitly
enabled with ENABLE_SHARK_MEME_DIGEST=true in repository Actions variables.
Never logs auth tokens, chat IDs, mint-owner identities or private messages.
"""
from __future__ import annotations
import argparse
import datetime as dt
import importlib.util
import json
import os
import pathlib
import urllib.error
import urllib.parse
import urllib.request

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("risk_digest",HERE/"solana_risk_probe.py")
digest=importlib.util.module_from_spec(spec)
spec.loader.exec_module(digest)


def message(summary:dict) -> str:
    return (
        "Jhadina SHARK — private 7-day research update\n"
        f"Status: {summary['status']}\n"
        f"Token candidates: {summary['discoveredMints']}; market observations: {summary['sampledMarketObservations']}\n"
        f"Suspected market warning observations (NOT confirmed rugs): "
        f"{summary['suspiciousMarketObservationsNotConfirmedRugs']}\n"
        f"Partial mint checks: {summary['onchainPartialProbes']}; unavailable: "
        f"{summary['onchainUnavailableProbes']}\n"
        f"24h price-only marks: {summary['priceOnly24hMarks']}; "
        f"sealed NO_TRADE decisions: {summary['prospectivelySealedNoTradeDecisions']}\n"
        "No real orders, certified safe tokens or executable P&L."
    )


def report_enabled(now:dt.datetime, event:str, enabled:str) -> bool:
    # Exactly one planned delivery slot daily, based on actual UTC time.
    # GitHub cron can be delayed or skipped; never backdate a missed report.
    return (event=="schedule" and enabled=="true" and
            now.hour==23 and 0<=now.minute<35)


def send_private(text:str, token:str, owner_id:str, opener=urllib.request.urlopen) -> bool:
    if not token or not isinstance(owner_id,str) or not owner_id.isdecimal() or len(owner_id)>20:
        return False
    if not text or len(text)>3800:
        return False
    body=urllib.parse.urlencode({
        "chat_id":owner_id,"text":text,"disable_web_page_preview":"true",
    }).encode()
    request=urllib.request.Request(
        "https://api.telegram.org/bot"+token+"/sendMessage",
        data=body,headers={"Content-Type":"application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with opener(request,timeout=12) as reply:
            if reply.status!=200:
                return False
            raw=reply.read(5000)
        answer=json.loads(raw)
        return isinstance(answer,dict) and answer.get("ok") is True
    except (OSError,ValueError,urllib.error.URLError,json.JSONDecodeError):
        return False


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--state",required=True)
    parser.add_argument("--mode",choices=["dry-run","send"],required=True)
    args=parser.parse_args()
    state=json.loads(pathlib.Path(args.state).read_text())
    s=digest.summarize(state)
    if args.mode=="dry-run":
        print(message(s))
        return
    now=dt.datetime.now(dt.timezone.utc)
    if not report_enabled(now,os.getenv("GITHUB_EVENT_NAME",""),os.getenv("ENABLE_SHARK_MEME_DIGEST","false")):
        print("MEME_PRIVATE_DIGEST_NOT_ENABLED_OR_NOT_IN_WINDOW")
        return
    delivered=send_private(message(s),os.getenv("TELEGRAM_BOT_TOKEN",""),
                           os.getenv("TELEGRAM_ALLOWED_USER_ID",""))
    print("MEME_PRIVATE_DIGEST_DELIVERED" if delivered else "MEME_PRIVATE_DIGEST_NOT_DELIVERED")


if __name__=="__main__":
    main()
