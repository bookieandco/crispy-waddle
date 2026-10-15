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
    health=record.get("health",{})
    lines.append("- Observation completeness: "+health.get("status","LEGACY_UNSPECIFIED"))
    for issue in health.get("issues",[]):
        lines.append("- Research blocker: "+str(issue))
    for source,receipt in record.get("feeds",{}).items():
        features=receipt.get("domain_evidence") or {}
        if features.get("kind")=="market_spread_research_only":
            lines.append(f"- {source} observed bid/ask spread: {features.get('spread_bps','UNAVAILABLE')} bps (not a paper trade)")
        elif features.get("kind")=="apple_catalog_metadata_not_streaming_or_engagement":
            lines.append(f"- {source} public catalog sample: {features.get('sample_count',0)} unique records; simple term matches: {features.get('simple_query_match_count',0)} (not audience engagement)")
        elif features.get("kind")=="posted_grants_search_metadata_not_qualified_leads":
            lines.append(f"- {source} public grant sample: {features.get('sample_count',0)} unqualified research candidates")
    lines.append(f"- Cross-day comparable public catalog samples: {len(record.get('domain_changes',{}))}")
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
