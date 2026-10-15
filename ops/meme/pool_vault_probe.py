#!/usr/bin/env python3
"""Read-only Solana DEX pool/vault evidence; never a sellability or LP lock verdict.

PumpSwap and Raydium AMM V4 offsets mirror the repository's TypeScript
dex-liquidity-decoder.ts. No guessed accounts or USD reserve valuations.
"""
from __future__ import annotations
import argparse
import base64
import importlib.util
import json
import pathlib
import re

HERE=pathlib.Path(__file__).parent
def module(name):
    s=importlib.util.spec_from_file_location(name,HERE/(name+".py"))
    o=importlib.util.module_from_spec(s);s.loader.exec_module(o);return o
observer=module("experiment_7day")
solana=module("solana_risk_probe")
PUMPSWAP="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
RAYDIUM_AMM_V4="675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
PROGRAMS={"pumpswap":(PUMPSWAP,243,(43,75,139,171)),
          "raydium":(RAYDIUM_AMM_V4,752,(400,432,336,368))}
B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
ADDRESS=observer.ADDRESS


def encode_pubkey(blob: bytes)->str:
    if len(blob)!=32:raise ValueError("public_key_length")
    n=int.from_bytes(blob,"big")
    out=""
    while n:
        n,r=divmod(n,58);out=B58[r]+out
    zeros=len(blob)-len(blob.lstrip(b"\x00"))
    return ("1"*zeros+out) or "1"


def decode_base64_account(account:dict,program:str,min_length:int)->bytes:
    if account.get("owner")!=program:
        raise ValueError("pool_owner_program_mismatch")
    data=account.get("data")
    if not isinstance(data,list) or len(data)!=2 or data[1]!="base64" or not isinstance(data[0],str):
        raise ValueError("pool_account_not_raw_base64")
    if len(data[0])>2500:raise ValueError("pool_account_too_large")
    try:raw=base64.b64decode(data[0],validate=True)
    except (ValueError,base64.binascii.Error):raise ValueError("pool_account_invalid_base64")
    if len(raw)<min_length or len(raw)>1800:raise ValueError("pool_account_length_invalid")
    return raw


def parsed_token_account(result:dict,address:str,mint:str,pool_slot:int)->dict:
    if not isinstance(result,dict) or not isinstance(result.get("context"),dict):
        raise ValueError("vault_context_missing")
    slot=result["context"].get("slot")
    if not isinstance(slot,int) or isinstance(slot,bool) or slot<pool_slot:
        raise ValueError("vault_slot_older_than_pool")
    account=result.get("value")
    if not isinstance(account,dict) or account.get("owner") not in solana.TOKEN_PROGRAMS:
        raise ValueError("vault_token_program_unverified")
    raw=account.get("data")
    if not isinstance(raw,dict) or not isinstance(raw.get("parsed"),dict) or raw["parsed"].get("type")!="account":
        raise ValueError("vault_account_not_parsed_token")
    info=raw["parsed"].get("info")
    if not isinstance(info,dict) or info.get("mint")!=mint or not isinstance(info.get("owner"),str):
        raise ValueError("vault_mint_or_authority_mismatch")
    amount=info.get("tokenAmount")
    if not isinstance(amount,dict) or not isinstance(amount.get("amount"),str) or not amount["amount"].isdigit():
        raise ValueError("vault_amount_unverified")
    decimals=amount.get("decimals")
    if not isinstance(decimals,int) or isinstance(decimals,bool) or not 0<=decimals<=18:
        raise ValueError("vault_decimals_unverified")
    if not ADDRESS.fullmatch(info["owner"]):raise ValueError("vault_authority_invalid")
    return {"address":address,"mint":mint,"tokenProgram":account["owner"],
            "ownerAuthority":info["owner"],"atoms":amount["amount"],"decimals":decimals,"slot":slot}


def attest_pool(pair:dict,pool:dict,vault_a:dict,vault_b:dict,at:str)->dict:
    observer.timestamp(at)
    venue=pair.get("dex")
    if venue not in PROGRAMS:raise ValueError("unsupported_dex_venue")
    prog,minimum,offsets=PROGRAMS[venue]
    for field in ("pair","mint","quoteMint"):
        if not isinstance(pair.get(field),str) or not ADDRESS.fullmatch(pair[field]):
            raise ValueError("pair_identity_missing")
    ctx=pool.get("context")
    if not isinstance(ctx,dict) or not isinstance(ctx.get("slot"),int) or isinstance(ctx["slot"],bool) or ctx["slot"]<1:
        raise ValueError("pool_context_invalid")
    if not isinstance(pool.get("value"),dict):raise ValueError("pool_account_missing")
    raw=decode_base64_account(pool["value"],prog,minimum)
    pkeys=[encode_pubkey(raw[i:i+32]) for i in offsets]
    base,quote,base_vault,quote_vault=pkeys
    if base!=pair["mint"] or quote!=pair["quoteMint"]:
        raise ValueError("pool_mint_identity_mismatch")
    if base_vault==quote_vault or base==quote:
        raise ValueError("pool_vault_or_mint_not_independent")
    if base_vault in {base,quote} or quote_vault in {base,quote}:
        raise ValueError("pool_vault_is_mint")
    a=parsed_token_account(vault_a,base_vault,base,ctx["slot"])
    b=parsed_token_account(vault_b,quote_vault,quote,ctx["slot"])
    return {
        "mint":base,"pool":pair["pair"],"dex":venue,
        "observedAt":at,"availableAt":at,"source":"solana_public_mainnet_rpc",
        "sourceMarketDigest":pair.get("digest"),"poolProgram":prog,"poolSlot":ctx["slot"],
        "baseVault":a,"quoteVault":b,
        "status":"ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED",
        "riskSignals":[],
        "coverage":{"poolProgramOwner":True,"poolMintMapping":True,
                    "tokenVaultMintMapping":True,"vaultRawBalances":True,
                    "liquidityControl":False,"lpTokenOwnership":False,
                    "sellability":False,"holderIndependence":False,
                    "operatorIdentity":False},
        "unverified":["LP_TOKEN_DISTRIBUTION","LP_LOCK_OR_BURN","VAULT_WITHDRAW_AUTHORITY",
                      "VAULT_BALANCE_PRICE_VALUATION","SELLABILITY_AND_SLIPPAGE",
                      "HOLDER_OPERATOR_INDEPENDENCE","POOL_TRANSACTION_HISTORY"],
        "rugVerdict":"UNDETERMINED","canTrade":False,"canSign":False,
        "canBroadcast":False,"isRugConfirmed":False,
    }


def probe_pair(pair:dict,rpc_fn=None,at=None)->dict:
    fn=rpc_fn or solana.rpc
    at=at or observer.now_utc()
    if pair.get("dex") not in PROGRAMS:raise ValueError("unsupported_dex_venue")
    pool=fn("getAccountInfo",[pair["pair"],{"encoding":"base64","commitment":"confirmed"}])
    program,min_length,offsets=PROGRAMS[pair["dex"]]
    if not isinstance(pool.get("value"),dict):raise ValueError("pool_account_missing")
    raw=decode_base64_account(pool["value"],program,min_length)
    keys=[encode_pubkey(raw[i:i+32]) for i in offsets]
    if keys[0]!=pair["mint"] or keys[1]!=pair["quoteMint"]:
        raise ValueError("pool_mint_identity_mismatch")
    a=fn("getAccountInfo",[keys[2],{"encoding":"jsonParsed","commitment":"confirmed"}])
    b=fn("getAccountInfo",[keys[3],{"encoding":"jsonParsed","commitment":"confirmed"}])
    return attest_pool(pair,pool,a,b,at)


def recent_pair(state:dict)->dict|None:
    # Single current-cycle pair per scheduled run to bound free public RPC.
    cycle=next((e for e in reversed(state["events"]) if e["type"]=="CYCLE"),None)
    if not cycle:return None
    choices=[e for e in state["events"] if e.get("type")=="MARKET_OBSERVATION"
             and e["availableAt"]==cycle["availableAt"] and e.get("dex") in PROGRAMS
             and isinstance(e.get("quoteMint"),str) and ADDRESS.fullmatch(e["quoteMint"])]
    if not choices:return None
    turn=sum(e.get("type")=="POOL_VAULT_PROBE" for e in state["events"])
    candidate=sorted(choices,key=lambda x:x["mint"])[turn%len(choices)]
    return {"pair":candidate["pair"],"mint":candidate["mint"],
            "quoteMint":candidate["quoteMint"],"dex":candidate["dex"],
            "digest":candidate["digest"]}


def reconcile(state:dict,at:str,prober=probe_pair)->dict:
    observer.audit(state)
    if not observer.timestamp(observer.START)<=observer.timestamp(at)<observer.timestamp(observer.END):
        return {"newProbe":0,"status":"OUTSIDE_WINDOW"}
    cycle=next((e for e in reversed(state["events"]) if e["type"]=="CYCLE"),None)
    if cycle is None:return {"newProbe":0,"status":"NO_MARKET_CYCLES"}
    if any(e.get("type")=="POOL_VAULT_PROBE" and e.get("cycleDigest")==cycle["digest"]
           for e in state["events"]):
        return {"newProbe":0,"status":"ALREADY_PROBED"}
    pair=recent_pair(state)
    if not pair:return {"newProbe":0,"status":"NO_SUPPORTED_POOL"}
    try:
        evidence=prober(pair)
        if evidence.get("status")!="ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED" or evidence.get("canTrade") is not False:
            raise ValueError("unsafe_pool_verdict")
    except (ValueError,TypeError,KeyError,OverflowError,OSError):
        evidence={"status":"POOL_RPC_UNVERIFIED","mint":pair["mint"],
                  "observedAt":at,"availableAt":at,"riskSignals":[],
                  "rugVerdict":"UNDETERMINED","canTrade":False,"canSign":False,
                  "canBroadcast":False,"isRugConfirmed":False}
    observer.append_event(state,{"type":"POOL_VAULT_PROBE","cycleDigest":cycle["digest"],
                                 "sourceMarketDigest":pair["digest"],"pair":pair["pair"],
                                 "observedAt":at,"availableAt":at,"authority":"RESEARCH_ONLY",**evidence})
    observer.audit(state)
    return {"newProbe":1,"status":evidence["status"],"canTrade":False}


def main():
    p=argparse.ArgumentParser();p.add_argument("--state",required=True);a=p.parse_args()
    file=pathlib.Path(a.state);state=json.loads(file.read_text())
    result=reconcile(state,observer.now_utc())
    observer.write_json(file,state)
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":main()
