"""SHARK-RUG-DATA.14 — bounded Token / Token-2022 mint-control forensics.

Pure offline analysis of an explicitly supplied Solana getAccountInfo jsonParsed
mint response. Reuses existing SHARK mint owner/slot parsing. No RPC requests,
external licenses, signers, swaps, owner claims, model promotion or safety
certification. A negative flag is never proof of unrestricted transfers.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
def _load(name):
    sp=importlib.util.spec_from_file_location("rug_auth_"+name,HERE/(name+".py"))
    obj=importlib.util.module_from_spec(sp);sp.loader.exec_module(obj);return obj

probe=_load("solana_risk_probe")
native=_load("rug_native_shadow")

SCHEMA="SHARK-RUG-SPL-AUTHORITY-14-V1"
LEGACY="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

# Names normalized from commonly exposed jsonParsed / token-2022 extension
# types. This is NOT exhaustive; unknown types fail closed as review-needed.
KNOWN_EXTENSIONS={
    "transferfeeconfig":"TRANSFER_FEE_CONTROL",
    "transferhook":"TRANSFER_HOOK_RESTRICTION_POSSIBLE",
    "nontransferable":"NON_TRANSFERABLE_TOKEN",
    "permanentdelegate":"PERMANENT_DELEGATE_AUTHORITY",
    "defaultaccountstate":"DEFAULT_ACCOUNT_STATE_CONTROL",
    "pausableconfig":"PAUSABLE_TRANSFERS",
    "confidentialtransfermint":"CONFIDENTIAL_TRANSFER_VISIBILITY",
    "confidentialtransferfeeconfig":"CONFIDENTIAL_TRANSFER_FEE_CONTROL",
    "metadatapointer":"MUTABLE_METADATA_POINTER",
    "grouppointer":"MUTABLE_GROUP_POINTER",
    "groupmemberpointer":"GROUP_MEMBER_POINTER",
    "mintcloseauthority":"MINT_CLOSE_CONTROL",
    "interestbearingconfig":"INTEREST_BEARING_CONFIG",
    "scaleduiamountconfig":"SCALED_AMOUNT_PRESENTATION",
    "transferhookaccount":"TRANSFER_HOOK_ACCOUNT_EXTENSION",
    "transferfeeamount":"TRANSFER_FEE_ACCOUNT_EXTENSION",
    "confidentialtransferaccount":"CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION",
    "memotransfer":"MEMO_TRANSFER_ACCOUNT_EXTENSION",
    "cpiguard":"CPI_GUARD_ACCOUNT_EXTENSION",
}
CONTROL_EXTENSIONS={
    "TRANSFER_FEE_CONTROL","TRANSFER_HOOK_RESTRICTION_POSSIBLE",
    "NON_TRANSFERABLE_TOKEN","PERMANENT_DELEGATE_AUTHORITY",
    "DEFAULT_ACCOUNT_STATE_CONTROL","PAUSABLE_TRANSFERS",
    "CONFIDENTIAL_TRANSFER_VISIBILITY","CONFIDENTIAL_TRANSFER_FEE_CONTROL",
    "MINT_CLOSE_CONTROL",
}
MAX_EXTENSIONS=48
MAX_MINT_JSON=80_000

def _err(code):raise ValueError("rug_auth_"+code)

def _sha(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False).encode()).hexdigest()

def _safe_bool(receipt):
    if receipt.get("canTrade") is not False or receipt.get("canSign") is not False or receipt.get("canBroadcast") is not False or receipt.get("rugVerdict")!="UNDETERMINED":
        _err("mint_claims_authority")

def _name(value):
    if not isinstance(value,str) or not value.strip() or len(value)>90:
        _err("extension_name_invalid")
    return "".join(c.lower() for c in value if c.isalnum())

def _authority(info,key):
    x=info.get(key)
    if x is not None: native._pubkey(x,key)
    return x is not None

def _slot(account):
    context=account.get("context")
    if not isinstance(context,dict) or type(context.get("slot")) is not int or context["slot"]<1:
        _err("slot_missing")
    return context["slot"]

def audit_mint_account(mint,account,*,observed_at,available_at,information_cutoff):
    native._pubkey(mint,"mint")
    start=native._utc(observed_at,"auth_observed")
    at=native._utc(available_at,"auth_available")
    stop=native._utc(information_cutoff,"auth_cutoff")
    if not start<=at<=stop:
        _err("future_or_unordered_evidence")
    if not isinstance(account,dict) or len(json.dumps(account))>MAX_MINT_JSON:
        _err("account_size_or_type_invalid")
    parsed=probe.verify_mint(mint,account,None,available_at)
    _safe_bool(parsed)
    slot=_slot(account)
    value=account["value"]
    token_program=value["owner"]
    info=value["data"]["parsed"]["info"]
    mint_active=_authority(info,"mintAuthority")
    freeze_active=_authority(info,"freezeAuthority")
    findings=[]
    if mint_active:findings.append("MINT_AUTHORITY_ACTIVE")
    if freeze_active:findings.append("FREEZE_AUTHORITY_ACTIVE")

    # Some RPC jsonParsed providers omit extensions entirely; absence is
    # incomplete visibility rather than "no extensions".
    extensions=info.get("extensions")
    if extensions is None:
        findings.append("EXTENSION_VISIBILITY_UNVERIFIED")
        extension_coverage="UNKNOWN"
        extensions=[]
    elif not isinstance(extensions,list) or len(extensions)>MAX_EXTENSIONS:
        _err("extension_list_invalid")
    else:
        extension_coverage="RPC_JSONPARSED_PARTIAL"
    if token_program==LEGACY and extensions:
        _err("legacy_extension_shape_unexpected")
    families=[]
    seen=set()
    for ext in extensions:
        if not isinstance(ext,dict) or len(json.dumps(ext))>16_000:
            _err("extension_shape_invalid")
        raw=ext.get("extension") if "extension" in ext else ext.get("extensionType")
        norm=_name(raw)
        if norm in seen:_err("duplicate_extension")
        seen.add(norm)
        label=KNOWN_EXTENSIONS.get(norm)
        if label is None:
            label="UNKNOWN_EXTENSION_REQUIRES_REVIEW"
        families.append(label)
        if label in CONTROL_EXTENSIONS or label=="UNKNOWN_EXTENSION_REQUIRES_REVIEW":
            findings.append(label)
        if norm=="defaultaccountstate":
            state=ext.get("state")
            if state is None or not isinstance(state,dict):
                findings.append("DEFAULT_ACCOUNT_STATE_UNPARSED")
            elif str(state.get("state","")).lower()=="frozen":
                findings.append("DEFAULT_ACCOUNT_STATE_FROZEN")
            elif str(state.get("state","")).lower() not in ("initialized","uninitialized"):
                findings.append("DEFAULT_ACCOUNT_STATE_UNRECOGNIZED")
        if norm=="transferfeeconfig":
            findings.append("FEE_SCHEDULE_AMOUNTS_NOT_ATTESTED")
        if norm=="transferhook":
            findings.append("HOOK_PROGRAM_EXECUTION_NOT_SIMULATED")
    if token_program==TOKEN_2022 and extension_coverage=="UNKNOWN":
        findings.append("TOKEN2022_EXTENSIONS_UNVERIFIED")
    if token_program not in (LEGACY,TOKEN_2022):
        _err("unsupported_program")

    status="REVIEW_CONTROLLED_OR_UNVERIFIED" if findings else "UNKNOWN_NOT_CERTIFIED"
    outcome={
        "schema":SCHEMA,"status":status,
        "mint":mint,"slot":slot,"tokenProgram":token_program,
        "observedAt":observed_at,"availableAt":available_at,
        "informationCutoff":information_cutoff,
        "mintAuthorityActive":mint_active,"freezeAuthorityActive":freeze_active,
        "extensionCoverage":extension_coverage,
        "extensionFamilies":sorted(families),"findings":sorted(set(findings)),
        "mintReceiptDigest":_sha(parsed),
        "evidenceSource":"OWNER_SUPPLIED_RPC_JSONPARSED_UNWITNESSED",
        "securityClaimsIndependentlyVerified":False,
        "tokenTransferabilityVerified":False,"sellabilityVerified":False,
        "safeTokenCertified":False,"rugConfirmed":False,
        "feeScheduleAttested":False,"transferHooksExecuted":False,
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,
    }
    return {**outcome,"receiptDigest":_sha(outcome)}
