#!/usr/bin/env python3
"""Offline exact-source Director supervisor diagnostic classifier contract."""
import json
from pathlib import Path
import shutil
import subprocess

SOURCE = (Path(__file__).resolve().parents[1] / ".github/workflows/director-background-supervisor.yml").read_text()
if not shutil.which("jq"):
    raise SystemExit("DIRECTOR_BACKGROUND_JQ_REQUIRED")
filters = [
    line.strip().split("'", 2)[1]
    for line in SOURCE.splitlines()
    if "'{schemaVersion:1,admitted:false,deployment:" in line
]
if len(filters) != 1:
    raise SystemExit("DIRECTOR_BACKGROUND_EXACTLY_ONE_RECEIPT_FILTER_REQUIRED")
if 'jq \'.admitted=true\'' not in SOURCE:
    raise SystemExit("DIRECTOR_BACKGROUND_READY_RECEIPT_MUST_MATCH_ADMISSION")
for marker in (
    'DIRECTOR_DEPLOYMENT_MISMATCH',
    'DIRECTOR_DEPLOYMENT_ENVIRONMENT_MISMATCH',
    'DIRECTOR_BACKGROUND_HEALTH_NOT_ADMITTED',
    'DIRECTOR_BACKGROUND_AUTHORITY_REJECTED',
    'storage_observed=',
    'deployment_verified=',
    'if: steps.health.outputs.ready == \'true\'',
):
    if marker not in SOURCE:
        raise SystemExit("DIRECTOR_BACKGROUND_SEPARATE_GATE_MISSING:" + marker)

cases = (
    # Label, http, storage, deployed, expected authority blocker
    ("stale-deployment", "503", "false", "false", False, "DIRECTOR_BACKGROUND_STORAGE_NOT_PROVEN"),
    ("recovery-unauthorized", "401", "false", "true", True, "DIRECTOR_BACKGROUND_AUTHORITY_REJECTED"),
    ("forbidden", "403", "false", "true", True, "DIRECTOR_BACKGROUND_AUTHORITY_REJECTED"),
    ("schema-missing", "503", "false", "true", False, "DIRECTOR_BACKGROUND_STORAGE_NOT_PROVEN"),
    ("storage-admitted", "200", "true", "true", False, None),
    ("health-not-admitted", "200", "true", "true", False, None),
)
for label, http, storage, deployed, rejected, blocker in cases:
    pairs = {
        "expectedSha": "a" * 40,
        "observedSha": "b" * 40 if deployed == "false" else "a" * 40,
        "environment": "production",
        "deployed": deployed,
        "http": http,
        "storage": storage,
        "error": "DIRECTOR_BACKGROUND_STORAGE_NOT_PROVEN",
    }
    args = ["jq", "-cn"]
    for key, value in pairs.items():
        args.extend(["--arg", key, value])
    args.append(filters[0])
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    if len(result.stdout.splitlines()) != 1:
        raise SystemExit(f"DIRECTOR_BACKGROUND_RECEIPT_NOT_UNIQUE:{label}")
    receipt = json.loads(result.stdout)
    assert receipt["schemaVersion"] == 1, label
    assert receipt["admitted"] is False, label
    assert receipt["deployment"]["containsExpected"] is (deployed == "true"), label
    assert receipt["transport"]["authorityRejected"] is rejected, label
    assert receipt["storage"]["observedReady"] is (storage == "true"), label
    assert receipt["storage"]["blocker"] == blocker, label

print(f"DIRECTOR_BACKGROUND_DIAGNOSTIC_MATRIX_PASS:{len(cases)}")
