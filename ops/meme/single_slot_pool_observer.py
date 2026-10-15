"""WATCHKEEPER.06: single-context, read-only Solana pool/vault observation.

No wallet, key, private RPC, transaction building, simulation of real fills or fees.
Uses trusted pool offsets from the existing project probe; three account images
share one getMultipleAccounts slot. Snapshot alone never verifies LP ownership,
DEX fees, liquidity control, actual sellability or trade execution.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.error
import urllib.request

HERE=Path(__file__).resolve().parent
def module(name):
    s=importlib.util.spec_from_file_location("w06_"+name,HERE/(name+".py"))
    obj=importlib.util.module_from_spec(s)
    s.loader.exec_module(obj)
    return obj
probe=module("pool_vault_probe")
risk=module("solana_risk_probe")
obs=module("experiment_7day")
SCHEMA="SHARK-RPC-POOL-OBSERVATION-06"
PROGRAMS=probe.PROGRAMS
RPCS=risk.RPC_URLS
MAX_RPC_RESPONSE=25000
MAX_DURATION_S=15

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
def sha(value):
    return hashlib.sha256(canonical(value)).hexdigest()
def require_addr(address, field):
    if not isinstance(address,str) or not obs.ADDRESS.fullmatch(address):
        raise ValueError("w06_"+field+"_invalid")
    return address
def require_hash(value,field):
    if not isinstance(value,str) or len(value)!=64 or any(x not in "0123456789abcdef" for x in value):
        raise ValueError("w06_"+field+"_invalid")
    return value
def _raw(account:dict,maxsize:int)->bytes:
    if not isinstance(account,dict):
        raise ValueError("w06_missing_account")
    data=account.get("data")
    if not isinstance(data,list) or len(data)!=2 or data[1]!="base64" or not isinstance(data[0],str) or len(data[0])>maxsize*2:
        raise ValueError("w06_raw_base64_required")
    try: raw=base64.b64decode(data[0],validate=True)
    except (ValueError,base64.binascii.Error) as exc:raise ValueError("w06_bad_base64") from exc
    if not 165<=len(raw)<=maxsize:
        raise ValueError("w06_account_size_out_of_range")
    return raw
def token_vault(account:dict, expected_mint:str, expected_address:str)->dict:
    if not isinstance(account,dict) or account.get("owner") not in risk.TOKEN_PROGRAMS:
        raise ValueError("w06_token_program_unverified")
    raw=_raw(account,800)
    mint=probe.encode_pubkey(raw[0:32])
    owner=probe.encode_pubkey(raw[32:64])
    atoms=int.from_bytes(raw[64:72],"little")
    state=raw[108]
    if mint!=expected_mint or state not in (1,2):
        raise ValueError("w06_token_mint_or_state_mismatch")
    return {"address":expected_address,"mint":mint,"tokenProgram":account["owner"],
        "vaultAuthority":owner,"amountAtomic":str(atoms),
        "frozen":state==2,"authorityIndependentlyVerified":False}

def validate_candidate(candidate:dict)->None:
    keys={"schema","dex","pair","mint","quoteMint","baseVault",
          "quoteVault","sourceMarketDigest","sourceAvailableAt","authority",
          "canTrade","canSign","canBroadcast"}
    if not isinstance(candidate,dict) or set(candidate)!=keys or candidate.get("schema")!=SCHEMA:
        raise ValueError("w06_candidate_shape_invalid")
    if candidate["dex"] not in PROGRAMS:
        raise ValueError("w06_venue_not_supported")
    for k in ("pair","mint","quoteMint","baseVault","quoteVault"):
        require_addr(candidate[k],k)
    if len({candidate[k] for k in ("pair","mint","quoteMint","baseVault","quoteVault")})!=5:
        raise ValueError("w06_duplicate_account_identity")
    require_hash(candidate["sourceMarketDigest"],"sourceMarketDigest")
    obs.timestamp(candidate["sourceAvailableAt"])
    if candidate["authority"]!="RESEARCH_ONLY" or any(candidate[k] is not False for k in ("canTrade","canSign","canBroadcast")):
        raise ValueError("w06_authority_escalation")

def public_rpc(method,params,opener=urllib.request.urlopen):
    if method!="getMultipleAccounts" or not isinstance(params,list) or len(params)!=2:
        raise ValueError("w06_rpc_method_not_allowlisted")
    addresses,options=params
    if (not isinstance(addresses,list) or len(addresses)!=3
      or len(set(addresses))!=3 or any(not isinstance(x,str) or not obs.ADDRESS.fullmatch(x) for x in addresses)
      or options!={"encoding":"base64","commitment":"confirmed"}):
        raise ValueError("w06_rpc_params_not_allowlisted")
    post=canonical({"jsonrpc":"2.0","id":1,"method":method,"params":params})
    for index,url in enumerate(RPCS):
        try:
            req=urllib.request.Request(url,data=post,method="POST",headers={
                "Accept":"application/json","Content-Type":"application/json",
                "User-Agent":"JhadinaWatchkeeperReadOnly/1.0"})
            with opener(req,timeout=12) as response:
                if response.status!=200:raise ValueError("w06_rpc_http_unavailable")
                body=response.read(MAX_RPC_RESPONSE+1)
            if len(body)>MAX_RPC_RESPONSE:raise ValueError("w06_rpc_oversized")
            payload=json.loads(body)
            if not isinstance(payload,dict) or payload.get("error") or not isinstance(payload.get("result"),dict):
                raise ValueError("w06_rpc_result_invalid")
            return {"result":payload["result"],"provider":"SOLANA_PUBLIC_MAINNET" if index==0 else "PUBLICNODE_PUBLIC"}
        except (ValueError,TypeError,KeyError,json.JSONDecodeError,urllib.error.URLError,OSError):
            if index==len(RPCS)-1:raise ValueError("w06_public_rpc_unavailable")
    raise ValueError("w06_no_rpc_sources")

def collect(candidate:dict,response:dict,started_at:str,received_at:str)->dict:
    """Parse an injected complete Solana JSON-RPC response, never infer other slots."""
    validate_candidate(candidate)
    began=obs.timestamp(started_at);received=obs.timestamp(received_at)
    source=obs.timestamp(candidate["sourceAvailableAt"])
    if not source<=began<=received or (received-began).total_seconds()>MAX_DURATION_S:
        raise ValueError("w06_future_source_or_slow_read")
    if not isinstance(response,dict) or response.get("provider") not in ("SOLANA_PUBLIC_MAINNET","PUBLICNODE_PUBLIC"):
        raise ValueError("w06_untrusted_rpc_provider")
    body=response.get("result")
    if not isinstance(body,dict) or not isinstance(body.get("context"),dict) or not isinstance(body.get("value"),list):
        raise ValueError("w06_context_or_accounts_missing")
    slot=body["context"].get("slot")
    accounts=body["value"]
    if isinstance(slot,bool) or not isinstance(slot,int) or slot<=0 or len(accounts)!=3:
        raise ValueError("w06_context_slot_invalid")
    program,min_length,offsets=PROGRAMS[candidate["dex"]]
    raw=probe.decode_base64_account(accounts[0],program,min_length)
    keys=[probe.encode_pubkey(raw[i:i+32]) for i in offsets]
    expected=[candidate["mint"],candidate["quoteMint"],candidate["baseVault"],candidate["quoteVault"]]
    if keys!=expected:
        raise ValueError("w06_pool_decoded_accounts_mismatch")
    base=token_vault(accounts[1],candidate["mint"],candidate["baseVault"])
    quote=token_vault(accounts[2],candidate["quoteMint"],candidate["quoteVault"])
    reasons=[]
    if base["frozen"] or quote["frozen"]:reasons.append("FROZEN_VAULT")
    if int(base["amountAtomic"])<=0 or int(quote["amountAtomic"])<=0:reasons.append("ZERO_RAW_RESERVE")
    result={
        "schema":SCHEMA,"dex":candidate["dex"],"pool":candidate["pair"],
        "poolProgramId":program,"slot":slot,"rpcProvider":response["provider"],
        "sourceMarketDigest":candidate["sourceMarketDigest"],
        "sourceAvailableAt":candidate["sourceAvailableAt"],
        "observedAt":started_at,"availableAt":received_at,"baseMint":candidate["mint"],
        "quoteMint":candidate["quoteMint"],"baseVault":base,"quoteVault":quote,
        "reasonCodes":reasons,"status":"SINGLE_RPC_CONTEXT_PARTIAL_UNVERIFIED",
        "singleRpcSlotObserved":True,"independentRpcAgreementVerified":False,
        "feeScheduleVerified":False,"poolControlVerified":False,"lpOwnershipVerified":False,
        "sellabilityVerified":False,"realizedFillVerified":False,
        "canEnterPaper":False,"authority":"RESEARCH_ONLY",
        "canTrade":False,"canSign":False,"canBroadcast":False}
    result["receiptDigest"]=sha(result)
    return result

def sample(candidate:dict,provider=public_rpc,clock=obs.now_utc)->dict:
    validate_candidate(candidate)
    start=clock()
    options={"encoding":"base64","commitment":"confirmed"}
    response=provider("getMultipleAccounts",[[candidate["pair"],candidate["baseVault"],candidate["quoteVault"]],options])
    end=clock()
    return collect(candidate,response,start,end)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--candidate",required=True)
    p.add_argument("--out",required=True)
    args=p.parse_args()
    dest=Path(args.out)
    if dest.exists() or dest.resolve()==Path(args.candidate).resolve():
        raise ValueError("w06_output_overwrite_forbidden")
    candidate=json.loads(Path(args.candidate).read_text(encoding="utf-8"))
    try: verdict=sample(candidate)
    except (ValueError,TypeError,KeyError,OverflowError,OSError) as error:
        verdict={"schema":SCHEMA,"status":"UNVERIFIED_NO_PAPER_ADMISSION",
          "reason":str(error),"authority":"RESEARCH_ONLY","canTrade":False,
          "canSign":False,"canBroadcast":False,"canEnterPaper":False,
          "sellabilityVerified":False,"realizedFillVerified":False}
        verdict["receiptDigest"]=sha(verdict)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(verdict,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(verdict["status"])

if __name__=="__main__":
    main()
