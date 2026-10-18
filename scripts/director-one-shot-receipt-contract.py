#!/usr/bin/env python3
"""Offline Director One Shot receipt and no-auto-create contract.

Validates the exact jq filter embedded in the workflow for a state matrix.
Does NOT claim a GitHub-hosted, RunPod, Supabase, or production runtime test.
"""
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / ".github/workflows/director-runpod-one-shot.yml").read_text()
if shutil.which("jq") is None:
    raise SystemExit("DIRECTOR_RECEIPT_JQ_REQUIRED")
if "\n  commission:" in source or "uses: ./.github/workflows/director-runpod-replacement.yml" in source:
    raise SystemExit("DIRECTOR_AUTOMATIC_BILLABLE_REPLACEMENT_FORBIDDEN")
if 'commission=true' in source or 'mode: create' in source:
    raise SystemExit("DIRECTOR_ONE_SHOT_CREATION_ADMISSION_FORBIDDEN")
if "Initialize fail-closed preflight receipt" not in source or "if-no-files-found: error" not in source:
    raise SystemExit("DIRECTOR_MISSING_OR_SILENT_RECEIPT_FORBIDDEN")
if "jq -e --arg sourceSha" not in source:
    raise SystemExit("DIRECTOR_RECEIPT_VALIDATION_REQUIRED")

matches = [
    line.strip().split("'", 2)[1]
    for line in source.splitlines()
    if "'{schemaVersion:1,sourceSha:$sourceSha,event:$event,observedAt:" in line
]
if len(matches) != 1:
    raise SystemExit("DIRECTOR_RECEIPT_EXACTLY_ONE_JQ_FILTER_REQUIRED")
jq_filter = matches[0]
if "select(length>0)" in jq_filter:
    raise SystemExit("DIRECTOR_RECEIPT_DROP_ON_EMPTY_FORBIDDEN")

cases = [
    ("no-existing-pod", "replacement-required-waiting-approval", "BLOCKED", "", False),
    ("registered-no-recovery", "generation-ready", "NO_BILLABLE_MUTATION_REQUIRED", "", False),
    ("single-healthy-recovered", "existing-runtime-ready-swlc-recovery", "NO_BILLABLE_MUTATION_REQUIRED", "podabc1", False),
    ("ambiguous-healthy", "ambiguous-existing-pods", "BLOCKED", "", False),
    ("failed-authority", "waiting-swlc-recovery", "BLOCKED", "", False),
    ("failed-preflight-status", "billable-action-waiting-owner-approval", "BLOCKED", "", False),
    ("registered-reconcile", "reconcile-human-media", "RECONCILE_EXISTING", "", True),
    ("recovered-reconcile", "reconcile-human-media-recovered", "RECONCILE_EXISTING", "podabc1", True),
]
for label, state, decision, pod_id, reconcile in cases:
    args = {
        "sourceSha": "a" * 40,
        "event": "schedule",
        "decision": decision,
        "state": state,
        "blocker": state if decision == "BLOCKED" else "",
        "reconcile": "true" if reconcile else "false",
        "observedAt": "2026-10-14T22:34:00Z",
        "origin": "https://example.invalid",
        "provisionHttp": "401" if state == "waiting-swlc-recovery" else "200",
        "provisionAuthorized": "false" if state == "waiting-swlc-recovery" else "true",
        "directorHttp": "503" if decision == "BLOCKED" else "200",
        "runtimeReady": "false" if decision == "BLOCKED" else "true",
        "generationEnabled": "false",
        "governedGenerationReady": "false",
        "governedGenerationError": "",
        "inventoryState": label,
        "inventoryCandidates": "2" if label == "ambiguous-healthy" else "1",
        "healthyCandidates": "2" if label == "ambiguous-healthy" else ("1" if pod_id else "0"),
        "recoveredPodId": pod_id,
        "locatorSource": "runpod-inventory",
    }
    command = ["jq", "-cn"]
    for name, value in args.items():
        command.extend(["--arg", name, value])
    command.append(jq_filter)
    result = subprocess.run(command, text=True, capture_output=True, check=True)
    lines = result.stdout.splitlines()
    if len(lines) != 1:
        raise SystemExit(f"DIRECTOR_RECEIPT_COUNT_INVALID:{label}:{len(lines)}")
    receipt = json.loads(lines[0])
    assert receipt["schemaVersion"] == 1, label
    assert receipt["sourceSha"] == "a" * 40, label
    assert receipt["state"] == state, label
    assert receipt["decision"] == decision, label
    assert receipt["billableCreationAuthorized"] is False, label
    assert receipt["reconcileExistingAllowed"] is reconcile, label
    assert receipt["blocker"] == (state if decision == "BLOCKED" else None), label
    assert receipt["runpodRecovery"]["recoveredPodId"] == (pod_id or None), label
    assert receipt["runpodRecovery"]["healthyCandidateCount"] >= 0, label

print(f"DIRECTOR_ONE_SHOT_RECEIPT_MATRIX_PASS:{len(cases)}")
