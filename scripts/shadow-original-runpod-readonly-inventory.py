#!/usr/bin/env python3
"""Sanitize read-only RunPod inventory. Never infer filesystem persistence from pod metadata.

All incoming JSON is untrusted and potentially includes secrets. Only an explicit
allowlist may enter stdout and the artifact. No RunPod request is made here.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "shadow.original.runpod-readonly-inventory.v1"
SHA40 = re.compile(r"^[a-f0-9]{40}$", re.I)


def extract(raw: object, keys: tuple[str, ...]) -> list[dict]:
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if not isinstance(raw, dict):
        raise ValueError("RUNPOD_INVENTORY_NOT_OBJECT_OR_ARRAY")
    for key in keys:
        v = raw.get(key)
        if isinstance(v, list):
            return [x for x in v if isinstance(x, dict)]
    if isinstance(raw.get("data"), dict):
        return extract(raw["data"], keys)
    raise ValueError("RUNPOD_INVENTORY_COLLECTION_MISSING")


def field(item: dict, *keys: str) -> str | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, (str, int, float)) and str(value).strip():
            return str(value).strip()[:256]
    return None


def sanitized(source: str, cpu: object, gpu: object, volumes: object,
              source_sha: str, observed_at: str) -> dict:
    if not SHA40.fullmatch(source_sha):
        raise ValueError("SOURCE_COMMIT_NOT_40_HEX")
    pod_rows=[]
    for kind, raw in (("CPU",cpu),("GPU",gpu)):
        for p in extract(raw, ("pods","items")):
            id_=field(p,"id","podId")
            if not id_:
                raise ValueError("POD_ID_MISSING")
            pod_rows.append({
                "podId":id_, "name":field(p,"name"),
                "computeType":kind,
                "desiredStatus":field(p,"desiredStatus","status"),
                "runtimeStatus":field(p,"runtimeStatus"),
                "networkVolumeId":field(p,"networkVolumeId") or (
                    field(p["networkVolume"],"id") if isinstance(p.get("networkVolume"),dict) else None),
                "createdAt":field(p,"createdAt"),
            })
    vols=[]
    for v in extract(volumes,("networkVolumes","volumes","items")):
        id_=field(v,"id","networkVolumeId")
        if not id_:raise ValueError("NETWORK_VOLUME_ID_MISSING")
        vols.append({"networkVolumeId":id_,"name":field(v,"name"),
            "sizeGb":field(v,"size","sizeGb","sizeInGb"),
            "dataCenterId":field(v,"dataCenterId")})
    pods=list({p["podId"]:p for p in pod_rows}.values())
    pod_ids={p["podId"] for p in pods}
    volume_ids={v["networkVolumeId"] for v in vols}
    matches=[p for p in pods if any(k in (p["name"] or "").lower() for k in (
        "shadow","shark","money"))]
    matches.sort(key=lambda x:x["podId"])
    linked=[p for p in matches if p["networkVolumeId"] in volume_ids]
    # Explicitly no private environment variables, exposed IPs, SSH keys or logs.
    return {
        "schema":SCHEMA,"observedAt":observed_at,"sourceCommitSha":source_sha,
        "source":source,
        "podCount":len(pod_ids),"networkVolumeCount":len(volume_ids),
        "matchingShadowPodCount":len(matches),"matchedVolumeCount":len(linked),
        "matchingPods":matches,
        "matchingVolumes":[v for v in vols if v["networkVolumeId"] in
                           {x["networkVolumeId"] for x in linked}],
        "inventoryHash":hashlib.sha256(json.dumps(
            {"pods":pods,"volumes":vols},sort_keys=True,
            separators=(",",":")).encode()).hexdigest(),
        "candidateStatus":"POD_METADATA_ONLY_ORIGINAL_DATA_UNVERIFIED",
        "historicalLedgerRecovered":False,
        "backupRestored":False,
        "canExecute":False,
        "canAuthorizeLive":False,
    }


def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--cpu",type=Path,required=True)
    parser.add_argument("--gpu",type=Path,required=True)
    parser.add_argument("--volumes",type=Path,required=True)
    parser.add_argument("--commit",required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    try:
        inputs=[json.loads(x.read_text()) for x in (args.cpu,args.gpu,args.volumes)]
        result=sanitized("RUNPOD_AUTHENTICATED_READ_ONLY_LIST",*inputs,args.commit,
                         datetime.now(timezone.utc).isoformat())
        args.output.write_text(json.dumps(result,sort_keys=True,indent=2)+"\n")
        print(json.dumps({"schema":SCHEMA,"state":result["candidateStatus"],
            "podCount":result["podCount"],"matchingShadowPodCount":result["matchingShadowPodCount"],
            "networkVolumeCount":result["networkVolumeCount"],
            "matchedVolumeCount":result["matchedVolumeCount"],
            "inventoryHash":result["inventoryHash"],"canExecute":False}))
        return 0
    except Exception as exc:
        print("SHADOW_READ_ONLY_INVENTORY_NOT_VERIFIED:"+type(exc).__name__,file=sys.stderr)
        return 2


if __name__=="__main__":
    sys.exit(main())
