"""SHARK-RUG-DATA.15–.16: offline pool-drain candidates and quote-route cross checks.

Reuses merged WATCHKEEPER receipts. Public RPC transaction payloads and quote
source claims are *unwitnessed*: these functions cannot confirm rug pulls,
executed sells, LP ownership, mint safety, or trading authority.
No network requests, signing, simulation, transfers, credentials or paid APIs.
"""
from __future__ import annotations
from datetime import datetime,timezone
import importlib.util
from pathlib import Path

HERE=Path(__file__).parent
def _load(name):
    spec=importlib.util.spec_from_file_location("rug_1516_"+name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

fusion=_load("rug_watchkeeper_fusion")
native=fusion.native
dual=fusion.dual
route=fusion.route
authority=fusion.authority
SCHEMA="SHARK-RUG-EVIDENCE-15-16-V1"
B58=native.pool_probe.B58
MAX_U64=(1<<64)-1
MAX_DELAY_SECONDS=600
MAX_EXTERNS=3

def _err(why):raise ValueError("rug_1516_"+why)

def _sha(v):return dual.single.sha(v)
def _time(t,key):return native._utc(t,key)

def _pub(value,length,field):
    if not isinstance(value,str) or not 40<=len(value)<=100:
        _err(field+"_invalid")
    n=0
    for c in value:
        if c not in B58:_err(field+"_invalid")
        n=n*58+B58.index(c)
    blob=b"\0"*(len(value)-len(value.lstrip("1")))+n.to_bytes((n.bit_length()+7)//8,"big")
    if len(blob)!=length:_err(field+"_invalid")
    return value

def _atoms(value,field,zero=True):
    if not isinstance(value,str) or not value.isascii() or not value.isdecimal():
        _err(field+"_invalid")
    number=int(value)
    if number>MAX_U64 or (not zero and number==0):
        _err(field+"_invalid")
    return number

def _noexec(receipt,kind):
    if not isinstance(receipt,dict) or receipt.get("authority")!="RESEARCH_ONLY" or (
        any(receipt.get(key) is not False for key in ("canTrade","canSign","canBroadcast"))
        or receipt.get("canAuthorizeLive") is not False
    ):_err(kind+"_execution_authority")

def _pool_snapshot(x,asof):
    fusion._verified_receipt(x,"pool_snapshot",_sha)
    if (x.get("schema")!=dual.SCHEMA or
        x.get("status")!="TWO_PUBLIC_ENDPOINTS_CONSISTENT_NOT_CRYPTO_VERIFIED" or
        x.get("publicEndpointsCompared")!=list(dual.PROVIDERS) or
        x.get("independentlyAuthenticatedProviders") is not False or
        x.get("sameSlot") is not True or x.get("sameAccountImages") is not True or
        x.get("reasonCodes")!=[] or x.get("canEnterPaper") is not False or
        x.get("lpOwnershipVerified") is not False or
        x.get("sameRouteSellabilityVerified") is not False or
        x.get("actualFillVerified") is not False):
        _err("snapshot_untrusted")
    for k in ("pool","mint","quoteMint"):
        native._pubkey(x.get(k),k)
    s=x.get("comparedSlots")
    if not isinstance(s,list) or len(s)!=2 or any(type(v) is not int or v<1 for v in s) or s[0]!=s[1]:
        _err("snapshot_slots_invalid")
    _time(x.get("asOf"),"snapshot_time")
    if _time(x["asOf"],"snapshot_time")>asof:_err("future_pool_snapshot")
    for k in ("observedBaseAtomic","observedQuoteAtomic"):
        _atoms(x.get(k),k)
    proof=x.get("sourceReceiptDigests")
    if not isinstance(proof,list) or len(proof)!=2 or not all(isinstance(p,str) and native.SHA.fullmatch(p) for p in proof):
        _err("snapshot_sources_invalid")
    return s[0]

def _tx_vault_balances(tx_result,idx,mint):
    meta=tx_result["meta"]
    results=[]
    for name in ("preTokenBalances","postTokenBalances"):
        balances=meta.get(name)
        if not isinstance(balances,list) or len(balances)>200:
            _err("tx_token_balance_shape")
        match=[b for b in balances if isinstance(b,dict) and b.get("accountIndex")==idx]
        if len(match)!=1 or match[0].get("mint")!=mint or not isinstance(match[0].get("uiTokenAmount"),dict):
            _err("tx_vault_mint_or_index_mismatch")
        results.append(_atoms(match[0]["uiTokenAmount"].get("amount"),name))
    return results

def _tx_check(tx, before,after,pool_proof,cutoff,pre_slot,post_slot):
    if not isinstance(tx,dict) or set(tx)!={"source","signature","availableAt","result"}:
        _err("tx_shape_invalid")
    if tx["source"]!="PUBLIC_SOLANA_GET_TRANSACTION_UNWITNESSED":
        _err("tx_source_not_allowlisted")
    _pub(tx["signature"],64,"signature")
    at=_time(tx["availableAt"],"tx_available")
    if not _time(before["asOf"],"before")<=at<=_time(after["asOf"],"after")<=cutoff:
        _err("tx_future_or_outside_snapshot_window")
    r=tx.get("result")
    if not isinstance(r,dict) or type(r.get("slot")) is not int or not pre_slot<r["slot"]<post_slot:
        _err("tx_slot_not_between_snapshots")
    if not isinstance(r.get("meta"),dict) or not isinstance(r.get("transaction"),dict):
        _err("tx_missing_meta")
    if r["meta"].get("err") is not None:
        _err("tx_failed_or_meta_missing")
    transaction=r["transaction"]
    if transaction.get("signatures") is None or not isinstance(transaction["signatures"],list) or tx["signature"] not in transaction["signatures"]:
        _err("tx_signature_not_bound")
    message=transaction.get("message")
    if not isinstance(message,dict):
        _err("tx_message_missing")
    keys=message.get("accountKeys")
    if not isinstance(keys,list) or not 1<=len(keys)<=200:
        _err("tx_keys_invalid")
    addresses=[]
    for x in keys:
        addr=x.get("pubkey") if isinstance(x,dict) else x
        native._pubkey(addr,"tx_account")
        addresses.append(addr)
    ins=message.get("instructions")
    if not isinstance(ins,list) or len(ins)>150:
        _err("tx_instructions_invalid")
    if not any(isinstance(x,dict) and x.get("programId")==pool_proof["poolProgram"] for x in ins):
        # CPI-only/inner calls are deliberately unresolved; never infer from
        # an outer signature that the pool DEX itself processed withdrawal.
        _err("tx_no_direct_pool_program_instruction")
    expected={
        pool_proof["baseVault"]["address"]: (before["mint"],before["observedBaseAtomic"],after["observedBaseAtomic"]),
        pool_proof["quoteVault"]["address"]: (before["quoteMint"],before["observedQuoteAtomic"],after["observedQuoteAtomic"])
    }
    for address,(mint,pre,post) in expected.items():
        if addresses.count(address)!=1:_err("tx_vault_account_index_missing")
        before_tx,after_tx=_tx_vault_balances(r,addresses.index(address),mint)
        if before_tx!=_atoms(pre,"pre") or after_tx!=_atoms(post,"post"):
            _err("tx_changes_disagree_with_snapshots")
    return tx["signature"]

def assess_liquidity_withdrawal(before,after,pool_proof,as_of,transaction=None):
    now=_time(as_of,"asof")
    a=_pool_snapshot(before,now)
    b=_pool_snapshot(after,now)
    if a>=b or _time(before["asOf"],"before")>=_time(after["asOf"],"after"):
        _err("nonforward_or_duplicate_pool_slots")
    if any(before.get(k)!=after.get(k) for k in ("mint","quoteMint","pool")):
        _err("pool_identity_changed")
    # An independently created canonical source receipt supplies actual vault
    # addresses. WATCHKEEPER aggregate summaries do not include these keys.
    native.assess_solana_evidence(
        mint=before["mint"],information_cutoff=before["asOf"],pool_proof=pool_proof
    )
    if (pool_proof.get("pool")!=before["pool"] or
        pool_proof.get("quoteVault",{}).get("mint")!=before["quoteMint"] or
        pool_proof["poolSlot"]>a or
        pool_proof["baseVault"]["atoms"]!=before["observedBaseAtomic"] or
        pool_proof["quoteVault"]["atoms"]!=before["observedQuoteAtomic"]):
        _err("pool_proof_not_bound_to_starting_reserves")
    old_b=_atoms(before["observedBaseAtomic"],"old_base")
    old_q=_atoms(before["observedQuoteAtomic"],"old_quote")
    new_b=_atoms(after["observedBaseAtomic"],"new_base")
    new_q=_atoms(after["observedQuoteAtomic"],"new_quote")
    decrease_b=old_b-new_b
    decrease_q=old_q-new_q
    candidate=(decrease_b>0 and decrease_q>0)
    # Even simultaneous drops can be pool migrations, fees, rebalancing,
    # conversions, or temporarily reported data. They are not proof of rug.
    if transaction is not None:
        if not candidate:_err("tx_claim_without_two_asset_decline")
        sig=_tx_check(transaction,before,after,pool_proof,now,a,b)
        status="TWO_VAULT_DECLINES_TX_PATTERN_UNVERIFIED"
    else:
        sig=None
        status="TWO_VAULT_DECLINES_NO_TX" if candidate else "NO_DUAL_VAULT_DECLINE"
    output={
        "schema":SCHEMA,"status":status,"mint":before["mint"],"pool":before["pool"],
        "observedFromSlot":a,"observedToSlot":b,
        "priorSnapshotDigest":before["receiptDigest"],
        "laterSnapshotDigest":after["receiptDigest"],
        "canonicalPoolProofDigest":native._hash(pool_proof),
        "transactionSignature":sig,"asOf":as_of,
        "twoAssetReserveDeclineObserved":candidate,
        "baseAtomsDelta":str(new_b-old_b),"quoteAtomsDelta":str(new_q-old_q),
        "snapshotSourceTrust":"TWO_PUBLIC_ENDPOINTS_NOT_CRYPTOGRAPHICALLY_ATTESTED",
        "transactionSourceTrust":"UNWITNESSED_PUBLIC_RPC" if sig else "NO_TRANSACTION",
        "lpOwnershipVerified":False,"lpBurnOrLockVerified":False,
        "withdrawalCauseProven":False,"rugConfirmed":False,
        "actorAttributionVerified":False,
        "canTrainCalibratedModel":False,
        "canEnterPaper":False,"canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,"authority":"RESEARCH_ONLY",
    }
    return {**output,"receiptDigest":_sha(output)}

def assess_exit_routes(canonical_route,other_quotes,authority_receipt,as_of):
    """Independent-looking source claims stay *indicative*, not executable."""
    cutoff=_time(as_of,"asof")
    fusion._verified_receipt(canonical_route,"canonical_route",_sha)
    _noexec(canonical_route,"route")
    if canonical_route.get("schema")!=route.SCHEMA or any(canonical_route.get(x) is not False for x in (
        "singlePoolRouteVerified","sellabilityVerified","actualFillVerified","canAuthorizeLive"
    )):_err("route_escalation")
    if _time(canonical_route.get("asOf"),"route_time")>cutoff or (
        cutoff-_time(canonical_route["asOf"],"route_time")
    ).total_seconds()>route.MAX_LAG_SECONDS:
        _err("route_stale")
    mint=canonical_route.get("mint")
    # The canonical absent-direction path gives no mint: incomplete, not safe.
    if mint is not None:native._pubkey(mint,"mint")
    if authority_receipt is not None:
        fusion._verified_receipt(authority_receipt,"authority",authority._sha)
        _noexec(authority_receipt,"authority")
        if authority_receipt.get("mint")!=mint or authority_receipt.get("schema")!=authority.SCHEMA or (
            authority_receipt.get("safeTokenCertified") is not False or
            authority_receipt.get("tokenTransferabilityVerified") is not False or
            _time(authority_receipt["availableAt"],"authority")>cutoff
        ):_err("authority_identity_or_claim_invalid")
    if not isinstance(other_quotes,list) or len(other_quotes)>MAX_EXTERNS:
        _err("other_sources_invalid")
    matched,conflict,sources=set(),False,set()
    if canonical_route["status"]=="TWO_AGGREGATOR_DIRECTIONS_INDICATIVE_NOT_EXECUTABLE":
        expected=_atoms(canonical_route["reverseInputTokenAtoms"],"reverse_input",False)
        original=_atoms(canonical_route["reverseOutputSolAtoms"],"reverse_output",False)
    elif canonical_route["status"]=="NO_TWO_SIDED_EVIDENCE":
        expected=original=None
    else:_err("canonical_route_status_invalid")
    for quote in other_quotes:
        if not isinstance(quote,dict) or set(quote)!={
            "sourceFamily","quoteId","sourceContentDigest","availableAt",
            "inputMint","outputMint","inputAtoms","outputAtoms",
            "status","authority","canTrade","canSign","canBroadcast","canAuthorizeLive"
        }:_err("external_quote_shape_invalid")
        _noexec(quote,"external_quote")
        family=quote["sourceFamily"]
        if family not in ("SECOND_PUBLIC_AGGREGATOR","DIRECT_POOL_PUBLIC_QUOTE"):
            _err("unrecognized_independence_claim")
        if family in sources:_err("duplicated_provider_family")
        sources.add(family)
        if not isinstance(quote["sourceContentDigest"],str) or not native.SHA.fullmatch(quote["sourceContentDigest"]):
            _err("quote_digest_unverified")
        if not isinstance(quote["quoteId"],str) or not 1<=len(quote["quoteId"])<=128:
            _err("quote_id_invalid")
        t=_time(quote["availableAt"],"quote_time")
        if t>cutoff or (cutoff-t).total_seconds()>route.MAX_LAG_SECONDS:
            _err("external_quote_future_or_stale")
        if mint is None:_err("quote_without_canonical_mint")
        if quote["inputMint"]!=mint or quote["outputMint"]!=route.forward.SOL:
            _err("quote_mint_mismatch")
        in_atoms=_atoms(quote["inputAtoms"],"external_input",False)
        out_atoms=_atoms(quote["outputAtoms"],"external_output")
        if in_atoms!=expected:_err("quote_size_mismatch")
        if quote["status"]!="INDICATIVE_SELL_QUOTE_ONLY" or not out_atoms:
            conflict=True
        elif out_atoms>0:
            matched.add(family)
    has_controls=authority_receipt is None or bool(authority_receipt.get("findings")) or (
        authority_receipt.get("extensionCoverage")=="UNKNOWN"
    )
    if canonical_route["status"]=="NO_TWO_SIDED_EVIDENCE":
        status="ABSTAIN_NO_TWO_SIDED_ROUTE"
    elif conflict:
        status="QUOTE_SOURCES_CONFLICT"
    elif has_controls:
        status="REVIEW_TRANSFER_RESTRICTIONS_UNVERIFIED"
    elif matched:
        status="MULTI_PROVIDER_INDICATIVE_EXIT_ONLY"
    else:
        status="ABSTAIN_ONE_AGGREGATOR_ONLY"
    output={
        "schema":SCHEMA,"status":status,"mint":mint,"asOf":as_of,
        "canonicalRouteDigest":canonical_route["receiptDigest"],
        "otherQuoteSourceFamilies":sorted(sources),
        "indicativeIndependentFamilies":len(matched),
        "referenceReverseSolAtoms":str(original) if original is not None else None,
        "providerIndependenceAttested":False,"quotePayloadsIndependentlyAuthenticated":False,
        "token2022TransferRequirementsResolved":False,
        "routeExecutableVerified":False,"simulatedSwapSucceeded":False,
        "sellabilityVerified":False,"realizedFillVerified":False,
        "canEnterPaper":False,"canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,"authority":"RESEARCH_ONLY",
    }
    return {**output,"receiptDigest":_sha(output)}
