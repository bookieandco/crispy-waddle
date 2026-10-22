#!/usr/bin/env python3
"""SHARK-CLOSE.03: verify *persisted* final state before disabling the collector.

Source-only validation; GitHub workflow fetches the data branch after push.
No state repair, inferred END, false finalization, wallet or external spending.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("shark_cutoff_final", HERE / "final_evaluation.py")
final = importlib.util.module_from_spec(spec)
spec.loader.exec_module(final)
obs = final.obs


def verify(state: dict, report: str, now: str) -> dict:
    """Only return canDisableWorkflow=True after exact same-head final proof."""
    obs.audit(state)
    at, cutoff = obs.timestamp(now), obs.timestamp(obs.END)
    if at < cutoff:
        raise ValueError("shark_cutoff_not_reached")
    if state.get("status") != "COMPLETED":
        raise ValueError("shark_cutoff_uncompleted")
    end_events = [e for e in state["events"] if e.get("type") == "END"]
    if len(end_events) != 1:
        raise ValueError("shark_cutoff_requires_exactly_one_end")
    end_at = obs.timestamp(end_events[0]["availableAt"])
    if not (cutoff <= end_at <= at):
        raise ValueError("shark_cutoff_invalid_end_time")
    if not isinstance(report, str) or not report.strip():
        raise ValueError("shark_cutoff_missing_persisted_report")
    evaluation = final.build(state, now)
    if not evaluation.get("final") or not evaluation.get("eligible"):
        raise ValueError("shark_cutoff_final_not_eligible")
    # Stronger than grepping for a digest: full current-main evaluator render
    # must exactly reproduce the file stored on the *data branch*.
    if final.render(evaluation) != report:
        raise ValueError("shark_cutoff_final_report_not_matching_ledger")
    return {
        "status": "PERSISTED_END_AND_FINAL_VERIFIED",
        "ledgerHead": state["lastDigest"],
        "endAvailableAt": end_events[0]["availableAt"],
        "canDisableWorkflow": True,
        "canTrade": False,
        "canLaunch": False,
        "canSign": False,
        "canBroadcast": False,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--state", required=True, help="Freshly fetched data-branch ledger")
    p.add_argument("--final", required=True, help="Freshly fetched data-branch report")
    a = p.parse_args()
    state = json.loads(Path(a.state).read_text(encoding="utf-8"))
    report = Path(a.final).read_text(encoding="utf-8")
    print(json.dumps(verify(state, report, obs.now_utc()), sort_keys=True))


if __name__ == "__main__":
    main()
