"""WATCHKEEPER.03 paper-only candidate-proposal journal.

No LLM invocation, wallet, RPC, trading/strategy mutations, owner impersonation.
Hash chain is *tamper-evident when externally anchored*, not independently immutable.
A typed operator "review" is NOT proof of owner identity or authorization.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
def _load_watchkeeper():
    s = importlib.util.spec_from_file_location("shark_strategy_watchkeeper", HERE / "strategy_watchkeeper.py")
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m
watch = _load_watchkeeper()
SCHEMA = "SHARK-COACH-JOURNAL-03"
ZERO = "0" * 64
EVENTS = {"PROPOSED", "REVIEW_DECLARED"}
CONTROLLED = ("canExecute", "canSign", "canBroadcast", "canRewriteRules",
              "canChangeHardLimits", "canAuthorizeLive")
def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("utf-8")
def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()
def _id(value, field):
    if not isinstance(value, str) or not value.strip() or len(value) > 160:
        raise ValueError(field + "_invalid")
    return value
def _digest(value, field):
    if not isinstance(value, str) or len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
        raise ValueError(field + "_invalid")
    return value
def _time(value):
    return watch._time(value)

def propose(scorecard: dict, draft: dict) -> dict:
    outcome = watch.assess(scorecard)
    if outcome["verdict"] != "PROPOSE_STRATEGY_REVIEW":
        raise ValueError("coach_unreviewable_calibration")
    if not isinstance(draft, dict) or set(draft) != {
        "proposalId", "strategyId", "marketRegime", "hardLimitsHash", "proposedAt",
        "candidateRuleText", "rationale", "sourceClass", "evidenceIds",
        "authority", "canExecute", "canSign", "canBroadcast",
        "canRewriteRules", "canChangeHardLimits", "canAuthorizeLive"
    }:
        raise ValueError("coach_draft_fields_not_allowlisted")
    for field in ("proposalId", "strategyId", "marketRegime"):
        _id(draft[field], field)
    if draft["strategyId"] != outcome["strategyId"] or draft["marketRegime"] != outcome["marketRegime"]:
        raise ValueError("coach_strategy_binding_mismatch")
    if _digest(draft["hardLimitsHash"], "hardLimitsHash") != outcome["hardLimitsHash"]:
        raise ValueError("coach_hard_limits_mismatch")
    t = _time(draft["proposedAt"])
    if t < _time(outcome["asOf"]):
        raise ValueError("coach_proposal_before_evidence")
    if draft["sourceClass"] not in ("OWNER_TEXT", "LLM_UNTRUSTED_TEXT"):
        raise ValueError("coach_source_invalid")
    for field in ("candidateRuleText", "rationale"):
        value = draft[field]
        if not isinstance(value, str) or not value.strip() or len(value) > 1000:
            raise ValueError("coach_" + field + "_invalid")
    evidence = draft["evidenceIds"]
    if not isinstance(evidence, list) or len(evidence) < 1 or len(evidence) > 100 or any(not isinstance(x, str) or not x.strip() for x in evidence) or len(set(evidence)) != len(evidence):
        raise ValueError("coach_evidence_invalid")
    if draft["authority"] != "RESEARCH_ONLY" or any(draft[k] is not False for k in CONTROLLED):
        raise ValueError("coach_draft_authority_invalid")
    return {
        "schema": SCHEMA, "proposalId": draft["proposalId"],
        "strategyId": outcome["strategyId"], "marketRegime": outcome["marketRegime"],
        "hardLimitsHash": outcome["hardLimitsHash"], "proposedAt": draft["proposedAt"],
        "candidateRuleText": draft["candidateRuleText"],
        "rationale": draft["rationale"], "sourceClass": draft["sourceClass"],
        "evidenceIds": sorted(evidence), "watchkeeperReceiptDigest": outcome["receiptDigest"],
        "scorecardDigest": digest(scorecard), "status": "AWAITING_OWNER_REVIEW",
        "operatorIdentityVerified": False, "tradePerformanceCertified": False,
        "authority": "RESEARCH_ONLY", **{k: False for k in CONTROLLED}
    }

def review_assertion(proposal: dict, review: dict) -> dict:
    if not isinstance(proposal, dict) or proposal.get("schema") != SCHEMA:
        raise ValueError("coach_proposal_invalid")
    if not isinstance(review, dict) or set(review) != {"proposalId", "decision", "reviewedAt", "hardLimitsHash", "authority", "canAuthorizeLive"}:
        raise ValueError("coach_review_shape_invalid")
    if review["proposalId"] != proposal["proposalId"] or review["hardLimitsHash"] != proposal["hardLimitsHash"]:
        raise ValueError("coach_review_binding_mismatch")
    if review["decision"] not in ("REQUEST_PAPER_TEST", "REJECT"):
        raise ValueError("coach_review_decision_invalid")
    if review["authority"] != "RESEARCH_ONLY" or review["canAuthorizeLive"] is not False:
        raise ValueError("coach_review_authority_invalid")
    if _time(review["reviewedAt"]) < _time(proposal["proposedAt"]):
        raise ValueError("coach_review_time_invalid")
    return {"schema": SCHEMA, "proposalId": proposal["proposalId"],
            "proposalDigest": digest(proposal),
            "decision": review["decision"], "reviewedAt": review["reviewedAt"],
            "hardLimitsHash": proposal["hardLimitsHash"],
            "ownerIdentityVerified": False, "approvalSignatureVerified": False,
            "mayRunUnattendedPaper": False, "mayTrade": False,
            "authority": "RESEARCH_ONLY", **{k: False for k in CONTROLLED}}

def audit(events: list[dict]) -> str:
    if not isinstance(events, list):
        raise ValueError("coach_journal_not_list")
    last, prev_time = ZERO, None
    proposed, reviewed = {}, set()
    for n, event in enumerate(events, 1):
        if not isinstance(event, dict) or set(event) != {"seq", "type", "at", "payload", "prevHash", "hash"}:
            raise ValueError("coach_event_invalid")
        if event["seq"] != n or type(event["seq"]) is not int or event["prevHash"] != last or event["type"] not in EVENTS:
            raise ValueError("coach_chain_disconnected")
        t = _time(event["at"])
        if prev_time is not None and t < prev_time:
            raise ValueError("coach_events_out_of_order")
        prev_time = t
        base = {k: event[k] for k in ("seq", "type", "at", "payload", "prevHash")}
        actual = digest(base)
        if event["hash"] != actual:
            raise ValueError("coach_chain_hash_mismatch")
        payload = event["payload"]
        if not isinstance(payload, dict) or payload.get("schema") != SCHEMA:
            raise ValueError("coach_payload_invalid")
        if event["type"] == "PROPOSED":
            pid = _id(payload.get("proposalId"), "coach_proposal_id")
            if pid in proposed or payload.get("status") != "AWAITING_OWNER_REVIEW":
                raise ValueError("coach_duplicate_or_unsealed_proposal")
            if payload.get("authority") != "RESEARCH_ONLY" or any(payload.get(k) is not False for k in CONTROLLED):
                raise ValueError("coach_proposal_authority_invalid")
            if _time(payload.get("proposedAt")) != t:
                raise ValueError("coach_proposal_time_mismatch")
            proposed[pid] = payload
        else:
            pid = payload.get("proposalId")
            if pid not in proposed or pid in reviewed or payload.get("proposalDigest") != digest(proposed[pid]):
                raise ValueError("coach_review_unlinked")
            expected = {"schema", "proposalId", "proposalDigest", "decision", "reviewedAt",
                        "hardLimitsHash", "ownerIdentityVerified", "approvalSignatureVerified",
                        "mayRunUnattendedPaper", "mayTrade", "authority", *CONTROLLED}
            if set(payload) != expected or payload["decision"] not in ("REQUEST_PAPER_TEST", "REJECT"):
                raise ValueError("coach_review_fields_invalid")
            if any(payload[k] is not False for k in ("ownerIdentityVerified", "approvalSignatureVerified", "mayRunUnattendedPaper", "mayTrade", *CONTROLLED)):
                raise ValueError("coach_review_unverified_authority")
            if payload["hardLimitsHash"] != proposed[pid]["hardLimitsHash"] or _time(payload["reviewedAt"]) != t:
                raise ValueError("coach_review_hard_limits_or_time_invalid")
            reviewed.add(pid)
        last = event["hash"]
    return last

def append(events: list[dict], event_type: str, payload: dict, at: str) -> list[dict]:
    prev = audit(events)
    if event_type not in EVENTS:
        raise ValueError("coach_event_type_invalid")
    now = _time(at)
    if events and now < _time(events[-1]["at"]):
        raise ValueError("coach_event_out_of_order")
    base = {"seq": len(events)+1, "type": event_type, "at": at,
            "payload": payload, "prevHash": prev}
    e = {**base, "hash": digest(base)}
    result = [*events, e]
    audit(result)
    return result

def load(path: Path) -> list[dict]:
    if path.is_symlink():
        raise ValueError("coach_symlink_journal_forbidden")
    if not path.exists():
        return []
    if not path.is_file() or path.stat().st_size > 4_000_000:
        raise ValueError("coach_journal_too_large")
    events = [json.loads(s) for s in path.read_text(encoding="utf-8").splitlines() if s.strip()]
    audit(events)
    return events

def write_next(path: Path, original: list[dict], updated: list[dict]) -> str:
    # Single-writer offline journal. NOT an atomic multi-host lock or external witness.
    if path.is_symlink() or updated[:len(original)] != original or len(updated) != len(original) + 1:
        raise ValueError("coach_append_only_required")
    audit(updated)
    path.parent.mkdir(parents=True, exist_ok=True)
    flag = os.O_WRONLY | os.O_APPEND | os.O_CREAT
    fd = os.open(path, flag, 0o600)
    try:
        with os.fdopen(fd, "a", encoding="utf-8") as f:
            f.write(json.dumps(updated[-1], sort_keys=True, separators=(",", ":")) + "\n")
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        raise
    return updated[-1]["hash"]

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--journal", required=True)
    sub = p.add_subparsers(dest="action", required=True)
    s = sub.add_parser("propose");s.add_argument("--scorecard", required=True);s.add_argument("--draft", required=True)
    r = sub.add_parser("review");r.add_argument("--proposal-id", required=True);r.add_argument("--review", required=True)
    sub.add_parser("verify")
    a = p.parse_args()
    path = Path(a.journal)
    events = load(path)
    if a.action == "verify":
        print(json.dumps({"events":len(events),"headHash":audit(events),"authority":"RESEARCH_ONLY"}));return
    if a.action == "propose":
        proposal = propose(json.loads(Path(a.scorecard).read_text()), json.loads(Path(a.draft).read_text()))
        typ, payload, at = "PROPOSED", proposal, proposal["proposedAt"]
    else:
        matches = [e["payload"] for e in events if e["type"]=="PROPOSED" and e["payload"]["proposalId"]==a.proposal_id]
        if len(matches) != 1:
            raise ValueError("coach_review_proposal_not_found")
        payload = review_assertion(matches[0], json.loads(Path(a.review).read_text()))
        typ, at = "REVIEW_DECLARED", payload["reviewedAt"]
    next_events = append(events, typ, payload, at)
    print(json.dumps({"headHash":write_next(path, events, next_events),"events":len(next_events),"authority":"RESEARCH_ONLY"}))

if __name__=="__main__":
    main()
