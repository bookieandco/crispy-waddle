"""SHARK-RUG-DATA.12–.13 — canonical Watchkeeper + SHARK evidence fusion.

Calls existing, independently tested WATCHKEEPER dual-RPC / Jupiter quote / cost
modules and the existing Solana mint+pool parsers. Does not add a collector,
signer, wallet, RPC client, trade path, Supabase writer, or permission.
Agreement of two PUBLIC hosts is not cryptographic attestation; two Jupiter
quotes are not executable sellability. Output is research-only.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path

HERE=Path(__file__).parent
def _load(name):
    sp=importlib.util.spec_from_file_location("shark_rug_fusion_"+name,HERE/(name+".py"))
    o=importlib.util.module_from_spec(sp);sp.loader.exec_module(o);return o

native=_load("rug_native_shadow")
authority=_load("token_authority_forensics")
dual=_load("dual_rpc_pool_observer")
route=_load("paired_route_evidence")
cost=_load("paired_route_cost_stress")
SCHEMA="SHARK-RUG-WATCHKEEPER-FUSION-11-14-V1"
MAX_DUAL_AGE_SECONDS=30

def _fail(message):raise ValueError("shark_rug_fusion_"+message)

def _verified_receipt(record,kind,sha):
    if not isinstance(record,dict) or record.get("receiptDigest")!=sha({
        k:v for k,v in record.items() if k!="receiptDigest"
    }):_fail(kind+"_digest_invalid")
    if record.get("authority")!="RESEARCH_ONLY" or any(record.get(x) is not False for x in (
        "canTrade","canSign","canBroadcast","canAuthorizeLive"
    )):_fail(kind+"_authority_invalid")

def _dual_receipt(record,mint,pool,cutoff):
    _verified_receipt(record,"dual",dual.single.sha)
    if (record.get("schema")!=dual.SCHEMA or
        record.get("mint")!=mint or record.get("pool")!=pool or
        record.get("publicEndpointsCompared")!=list(dual.PROVIDERS) or
        record.get("independentlyAuthenticatedProviders") is not False or
        record.get("lpOwnershipVerified") is not False or
        record.get("tokenTransferRestrictionsVerified") is not False or
        record.get("sameRouteSellabilityVerified") is not False or
        record.get("canEnterPaper") is not False or
        record.get("actualFillVerified") is not False):
        _fail("dual_identity_or_proof_escalation")
    at=native._utc(record.get("asOf"),"dual_asof")
    if at>cutoff or (cutoff-at).total_seconds()>MAX_DUAL_AGE_SECONDS:
        _fail("dual_snapshot_future_or_stale")
    ok=(record.get("status")=="TWO_PUBLIC_ENDPOINTS_CONSISTENT_NOT_CRYPTO_VERIFIED" and
        record.get("sameSlot") is True and
        record.get("sameAccountImages") is True and
        record.get("reasonCodes")==[] and
        isinstance(record.get("sourceReceiptDigests"),list) and
        len(record["sourceReceiptDigests"])==2 and
        all(isinstance(x,str) and len(x)==64 for x in record["sourceReceiptDigests"]))
    if not ok and record.get("status")!="RPC_COMPARISON_UNVERIFIED":
        _fail("dual_unrecognized_status")
    return ok

def fuse(*,mint,information_cutoff,mint_proof=None,pool_proof=None,
         authority_receipt=None,dual_receipt=None,
         state=None,cycle_digest=None,stress_assumptions=None):
    cutoff=native._utc(information_cutoff,"information_cutoff")
    native_result=native.assess_solana_evidence(
        mint=mint,information_cutoff=information_cutoff,
        mint_proof=mint_proof,pool_proof=pool_proof
    )
    reasons=set(native_result["reasons"])
    evidence=list(native_result["evidenceIds"])
    flags=[]
    auth_status="MISSING"
    dual_status="MISSING"
    route_status="MISSING"
    stress_status="NOT_REQUESTED"
    conflict=False
    control=False
    if authority_receipt is None:
        reasons.add("TOKEN_2022_AUTHORITY_REVIEW_MISSING")
    else:
        _verified_receipt(authority_receipt,"authority",authority._sha)
        if (authority_receipt.get("schema")!=authority.SCHEMA or
            authority_receipt.get("mint")!=mint or
            authority_receipt.get("securityClaimsIndependentlyVerified") is not False or
            authority_receipt.get("safeTokenCertified") is not False or
            authority_receipt.get("rugConfirmed") is not False or
            authority_receipt.get("tokenTransferabilityVerified") is not False):
            _fail("authority_proof_escalation")
        if mint_proof is None or authority_receipt.get("mintReceiptDigest")!=authority._sha(mint_proof):
            _fail("authority_mint_receipt_not_bound")
        if (authority_receipt.get("tokenProgram")!=mint_proof.get("tokenProgram") or
            authority_receipt.get("slot")!=mint_proof.get("slot") or
            native._utc(authority_receipt.get("availableAt"),"authority_available")>cutoff):
            _fail("authority_identity_or_time_mismatch")
        auth_status=authority_receipt["status"]
        flags=list(authority_receipt["findings"])
        if auth_status not in ("UNKNOWN_NOT_CERTIFIED","REVIEW_CONTROLLED_OR_UNVERIFIED"):
            _fail("authority_status_unrecognized")
        if flags:
            control=True
            reasons.update(flags)
        evidence.append("authority:"+authority_receipt["receiptDigest"])

    if dual_receipt is None:
        reasons.add("INDEPENDENT_POOL_COMPARISON_MISSING")
    else:
        if pool_proof is None:
            _fail("dual_without_bound_pool_receipt")
        agreement=_dual_receipt(dual_receipt,mint,pool_proof["pool"],cutoff)
        dual_status=dual_receipt["status"]
        evidence.append("dual:"+dual_receipt["receiptDigest"])
        if not agreement:
            conflict=True
            reasons.update(dual_receipt.get("reasonCodes") or ["PUBLIC_RPC_MISMATCH"])
        else:
            # Reconcile WATCHKEEPER's same-slot reserves to the older
            # canonical SHARK pool/vault observation. A two-host agreement
            # on DIFFERENT balances or an older slot is not independent proof.
            slots=dual_receipt.get("comparedSlots")
            if (not isinstance(slots,list) or len(slots)!=2 or
                any(type(s) is not int for s in slots) or
                min(slots)<pool_proof["poolSlot"] or
                dual_receipt.get("quoteMint")!=pool_proof["quoteVault"]["mint"] or
                dual_receipt.get("observedBaseAtomic")!=pool_proof["baseVault"]["atoms"] or
                dual_receipt.get("observedQuoteAtomic")!=pool_proof["quoteVault"]["atoms"]):
                conflict=True
                reasons.add("CROSS_SOURCE_POOL_SLOT_OR_RESERVE_DISAGREEMENT")
            else:
                reasons.add("TWO_PUBLIC_HOSTS_AGREE_NOT_CRYPTOGRAPHICALLY_INDEPENDENT")

    if (state is None)!=(cycle_digest is None):
        _fail("route_cycle_and_ledger_required_together")
    if stress_assumptions is not None and state is None:
        _fail("cost_stress_requires_ledger_route")
    if state is not None:
        # Replays the canonical append-only and source-identity checks. It
        # cannot accept a caller-supplied fake "verified route" flag.
        route_receipt=route.evaluate(state,cycle_digest,information_cutoff,dual_receipt)
        _verified_receipt(route_receipt,"route",dual.single.sha)
        if (route_receipt.get("schema")!=route.SCHEMA or
            route_receipt.get("sellabilityVerified") is not False or
            route_receipt.get("actualFillVerified") is not False or
            route_receipt.get("singlePoolRouteVerified") is not False):
            _fail("route_proof_escalation")
        if route_receipt.get("mint") is not None and route_receipt["mint"]!=mint:
            _fail("route_mint_mismatch")
        route_status=route_receipt["status"]
        evidence.append("route:"+route_receipt["receiptDigest"])
        reasons.update(route_receipt["reasonCodes"])
        if stress_assumptions is not None:
            stressed=cost.model(route_receipt,stress_assumptions)
            _verified_receipt(stressed,"stress",dual.single.sha)
            if (stressed.get("canScoreForwardReturn") is not False or
                stressed.get("actualFillVerified") is not False or
                stressed.get("isExecutablePnL") is not False or
                stressed.get("canAuthorizeLive") is not False):
                _fail("stress_pnl_escalation")
            stress_status=stressed["status"]
            evidence.append("stress:"+stressed["receiptDigest"])
    else:
        reasons.add("TWO_SIDED_ROUTE_NOT_VERIFIED")
    if native_result["status"]=="REVIEW_HIGH_RISK":
        control=True
    if conflict:
        verdict="QUARANTINE_CONFLICTED_EVIDENCE"
    elif control:
        verdict="REVIEW_RISK_CONTROLS"
    elif (native_result["status"]=="ABSTAIN" or
          authority_receipt is None or dual_receipt is None or state is None or
          route_status!="TWO_AGGREGATOR_DIRECTIONS_INDICATIVE_NOT_EXECUTABLE"):
        verdict="ABSTAIN_INCOMPLETE_EVIDENCE"
    else:
        verdict="WATCH_UNCERTIFIED_NO_TRADE"
    output={
        "schema":SCHEMA,"status":verdict,"mint":mint,
        "informationCutoff":information_cutoff,
        "nativeStatus":native_result["status"],
        "authorityStatus":auth_status,"dualRpcStatus":dual_status,
        "indicativeRouteStatus":route_status,"hypotheticalCostStatus":stress_status,
        "flags":sorted(set(flags)),"reasonCodes":sorted(reasons),
        "evidenceIds":sorted(evidence),
        "sourceIntegrity":"PUBLIC_HOST_AND_LEDGER_RECEIPTS_UNWITNESSED",
        "independentHistoryAuthenticated":False,"lpControlVerified":False,
        "tokenTransferabilityVerified":False,"sellabilityVerified":False,
        "rugConfirmed":False,"safeTokenCertified":False,
        "canPromoteModel":False,"canEnterPaper":False,"canTrade":False,
        "canSign":False,"canBroadcast":False,"canAuthorizeExit":False,
        "canAuthorizeLive":False,"authority":"RESEARCH_ONLY",
    }
    return {**output,"receiptDigest":dual.single.sha(output)}
