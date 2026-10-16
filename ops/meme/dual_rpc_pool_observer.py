"""WATCHKEEPER.12 — compare two pinned public Solana read-only RPC account sets.

One atomic getMultipleAccounts per endpoint: pool + base vault + quote vault.
Snapshots are compared only at the *same* slot and with equal raw SPL reserves.
Public node agreement is NOT cryptographically independent authentication of
history, mint authority, token transfer restrictions, pool fees, LP control,
owner identity, executable quotes, or sellability. No signing or spending.
"""
from __future__ import annotations
import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path
import importlib.util

HERE=Path(__file__).resolve().parent
def module(name):
    spec=importlib.util.spec_from_file_location("wk12_"+name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
single=module("single_slot_pool_observer")
obs=single.obs
SCHEMA="SHARK-DUAL-RPC-POOL-12"
PROVIDERS=("SOLANA_PUBLIC_MAINNET","PUBLICNODE_PUBLIC")
MAX_SLOT_DRIFT=0
LIMIT=single.MAX_RPC_RESPONSE

def fetch_one(index:int,candidate:dict,opener=urllib.request.urlopen)->dict:
    single.validate_candidate(candidate)
    if type(index) is not int or index not in (0,1):
        raise ValueError("wk12_provider_index_invalid")
    if len(single.RPCS)!=2:raise ValueError("wk12_pinned_provider_configuration_invalid")
    addresses=[candidate["pair"],candidate["baseVault"],candidate["quoteVault"]]
    payload=single.canonical({"jsonrpc":"2.0","id":1,
        "method":"getMultipleAccounts",
        "params":[addresses,{"encoding":"base64","commitment":"confirmed"}]})
    req=urllib.request.Request(single.RPCS[index],data=payload,method="POST",
      headers={"Content-Type":"application/json","Accept":"application/json",
        "User-Agent":"JhadinaDualReadOnly/1.0"})
    try:
        with opener(req,timeout=12) as response:
            if response.status!=200:raise ValueError("wk12_bad_rpc_status")
            content=response.read(LIMIT+1)
        if len(content)>LIMIT:raise ValueError("wk12_rpc_payload_over_limit")
        raw=json.loads(content)
        if not isinstance(raw,dict) or raw.get("error") or not isinstance(raw.get("result"),dict):
            raise ValueError("wk12_rpc_result_unverified")
        return {"provider":PROVIDERS[index],"result":raw["result"]}
    except (OSError,ValueError,TypeError,urllib.error.URLError,json.JSONDecodeError) as exc:
        raise ValueError("wk12_public_node_unavailable") from exc

def compare(candidate:dict,a:dict,b:dict,asof:str)->dict:
    single.validate_candidate(candidate)
    t=obs.timestamp(asof)
    if t<obs.timestamp(candidate["sourceAvailableAt"]):
        raise ValueError("wk12_asof_before_source")
    for index,receipt in enumerate((a,b)):
        if not isinstance(receipt,dict) or receipt.get("schema")!=single.SCHEMA:
            raise ValueError("wk12_unverified_input")
        if receipt.get("status")!="SINGLE_RPC_CONTEXT_PARTIAL_UNVERIFIED":
            raise ValueError("wk12_source_status_invalid")
        if receipt.get("receiptDigest")!=single.sha({k:v for k,v in receipt.items() if k!="receiptDigest"}):
            raise ValueError("wk12_source_checksum_bad")
        if receipt.get("rpcProvider")!=PROVIDERS[index]:
            raise ValueError("wk12_provider_identity_mismatch")
        if (receipt.get("pool")!=candidate["pair"] or receipt.get("baseMint")!=candidate["mint"]
          or receipt.get("quoteMint")!=candidate["quoteMint"] or receipt.get("sourceMarketDigest")!=candidate["sourceMarketDigest"]
          or receipt.get("sourceAvailableAt")!=candidate["sourceAvailableAt"]):
            raise ValueError("wk12_identity_mismatch")
        if receipt.get("poolProgramId")!=single.PROGRAMS[candidate["dex"]][0]:
            raise ValueError("wk12_pool_program_not_trusted")
        for vault,mint,address in (("baseVault","mint","baseVault"),("quoteVault","quoteMint","quoteVault")):
            if not isinstance(receipt.get(vault),dict) or receipt[vault].get("address")!=candidate[address] or receipt[vault].get("mint")!=candidate[mint]:
                raise ValueError("wk12_vault_binding_invalid")
        if any(receipt.get(flag) is not False for flag in ("canEnterPaper","canTrade","canSign","canBroadcast",
          "sellabilityVerified","realizedFillVerified","feeScheduleVerified","poolControlVerified","independentRpcAgreementVerified")):
            raise ValueError("wk12_source_escalation")
        available=obs.timestamp(receipt.get("availableAt"))
        if not obs.timestamp(receipt["observedAt"])<=available<=t or (t-available).total_seconds()>30:
            raise ValueError("wk12_mismatched_observation_window")
        if obs.timestamp(receipt["observedAt"])>t:
            raise ValueError("wk12_future_read")
        if type(receipt.get("slot")) is not int or receipt["slot"]<=0:
            raise ValueError("wk12_slot_invalid")
    same_slot=a["slot"]==b["slot"]
    fields=("poolProgramId","baseMint","quoteMint")
    equal=(all(a.get(f)==b.get(f) for f in fields) and
      all(a[v].get(f)==b[v].get(f) for v in ("baseVault","quoteVault")
         for f in ("mint","address","tokenProgram","vaultAuthority","amountAtomic","frozen")))
    reasons=[]
    if not same_slot:reasons.append("DIFFERENT_RPC_CONTEXT_SLOTS")
    if not equal:reasons.append("ACCOUNT_IMAGE_OR_BALANCE_DISAGREEMENT")
    if any(a[v]["frozen"] or b[v]["frozen"] for v in ("baseVault","quoteVault")):
        reasons.append("FROZEN_ACCOUNT")
    if any(int(a[v]["amountAtomic"])<=0 or int(b[v]["amountAtomic"])<=0 for v in ("baseVault","quoteVault")):
        reasons.append("ZERO_RESERVE")
    status="TWO_PUBLIC_ENDPOINTS_CONSISTENT_NOT_CRYPTO_VERIFIED" if not reasons else "RPC_COMPARISON_UNVERIFIED"
    result={
        "schema":SCHEMA,"status":status,"reasonCodes":reasons,
        "pool":candidate["pair"],"mint":candidate["mint"],"quoteMint":candidate["quoteMint"],
        "sourceMarketDigest":candidate["sourceMarketDigest"],"asOf":asof,
        "comparedSlots":[a["slot"],b["slot"]],
        "sameSlot":same_slot,"sameAccountImages":equal,
        "publicEndpointsCompared":list(PROVIDERS),
        "sourceReceiptDigests":[a["receiptDigest"],b["receiptDigest"]],
        "observedBaseAtomic":a["baseVault"]["amountAtomic"] if status.startswith("TWO_") else None,
        "observedQuoteAtomic":a["quoteVault"]["amountAtomic"] if status.startswith("TWO_") else None,
        "independentlyAuthenticatedProviders":False,
        "feeScheduleVerified":False,"lpOwnershipVerified":False,
        "tokenTransferRestrictionsVerified":False,"sameRouteSellabilityVerified":False,
        "canEnterPaper":False,"actualFillVerified":False,
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False}
    result["receiptDigest"]=single.sha(result)
    return result

def snapshot(candidate:dict,fetch=fetch_one,clock=obs.now_utc):
    single.validate_candidate(candidate)
    begin=clock()
    results=[]
    for index in (0,1):
        response=fetch(index,candidate)
        end=clock()
        obs.timestamp(end)
        if not 0<=(obs.timestamp(end)-obs.timestamp(begin)).total_seconds()<=30:
            raise ValueError("wk12_read_window_expired")
        record=single.collect(candidate,response,begin,end)
        results.append(record)
        begin=end
    # Preserve original receipt timestamps; same context slot is necessary
    # but not proof of synchronized network capture or provider independence.
    return compare(candidate,*results,results[-1]["availableAt"])

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--candidate",required=True)
    p.add_argument("--out",required=True)
    args=p.parse_args()
    target=Path(args.out)
    if target.exists() or target.resolve()==Path(args.candidate).resolve():
        raise ValueError("wk12_output_overwrite_forbidden")
    candidate=json.loads(Path(args.candidate).read_text(encoding="utf-8"))
    try: result=snapshot(candidate)
    except (ValueError,KeyError,TypeError,OverflowError,OSError) as exc:
        result={"schema":SCHEMA,"status":"RPC_COMPARISON_UNVERIFIED",
            "reasonCodes":[str(exc)],"sameSlot":False,
            "actualFillVerified":False,"canEnterPaper":False,
            "authority":"RESEARCH_ONLY","canTrade":False,
            "canSign":False,"canBroadcast":False,"canAuthorizeLive":False}
        result["receiptDigest"]=single.sha(result)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(result["status"])
if __name__=="__main__":
    main()
