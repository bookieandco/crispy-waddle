#!/usr/bin/env python3
"""GitHub Actions human-readable summary, derived strictly from sealed evidence."""
import json
import pathlib
import sys

def render(record):
    lines=[
        "## Jhadina five-lab research receipt",
        f"- UTC date: {record['date']} | preflight: {record['preflight']} | prior: {record['prior_state']}",
        f"- Sealed next-day predictions: {len(record['predictions'])} | scored previous-day cases: {len(record['outcomes'])}",
    ]
    for result in record["results"]:
        lines.append(f"- {result['lab']}: software tests {result['status']} (not a real-world outcome)")
    for name,receipt in record["feeds"].items():
        lines.append(f"- {name}: {receipt['observation_status']} (attempts: {receipt.get('attempts','unknown')})")
    lines.extend((
        "- Investment/market rights, social engagement, licensed TV playback and phone audio performance: NOT CERTIFIED",
        "- Trading/publication/payment authority: NONE",
        "- Provenance record SHA-256: "+record["record_sha256"],
    ))
    return "\n".join(lines)

if __name__=="__main__":
    record=json.loads(pathlib.Path(sys.argv[1]).read_text())
    print(render(record))
