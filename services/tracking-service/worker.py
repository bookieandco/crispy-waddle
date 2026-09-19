"""Sandboxed SAM2 worker boundary for Director Studio.

The worker owns model inference only. It receives already-governed bounded work and
returns evidence; it never approves tracks or makes Jhadina policy decisions.
"""
from dataclasses import dataclass
from typing import Any, Protocol

ALLOWED_CLASSES={"character","clothing","hair","hand","prop","environment"}

@dataclass(frozen=True)
class Sam2Request:
    source_asset_id:str
    frame_start:int
    frame_end:int
    classes:tuple[str,...]
    seed_annotations:tuple[dict[str,Any],...]=()

class Sam2Engine(Protocol):
    def track_video(self, request:Sam2Request)->dict[str,Any]: ...

def parse_request(body:dict[str,Any])->Sam2Request:
    source=body.get("sourceAssetId")
    start=body.get("frameStart")
    end=body.get("frameEnd")
    classes=body.get("classes")
    if not isinstance(source,str) or not source:
        raise ValueError("sourceAssetId is required")
    if not isinstance(start,int) or start<0 or not isinstance(end,int) or end<start:
        raise ValueError("invalid frame range")
    if not isinstance(classes,list) or not classes or any(c not in ALLOWED_CLASSES for c in classes):
        raise ValueError("invalid tracking classes")
    seeds=body.get("seedAnnotations",[])
    if not isinstance(seeds,list):
        raise ValueError("seedAnnotations must be an array")
    return Sam2Request(source,start,end,tuple(classes),tuple(seeds))

def run_sam2(engine:Sam2Engine, body:dict[str,Any])->dict[str,Any]:
    request=parse_request(body)
    raw=engine.track_video(request)
    tracks=raw.get("tracks")
    if not isinstance(tracks,list):
        raise ValueError("SAM2 engine returned invalid tracks")
    normalized=[]
    for track in tracks:
        if track.get("class") not in request.classes:
            raise ValueError("SAM2 returned unrequested class")
        if track.get("frameStart",request.frame_start)<request.frame_start or track.get("frameEnd",request.frame_end)>request.frame_end:
            raise ValueError("SAM2 exceeded governed frame range")
        # Model inference can never mint human approval.
        normalized.append({**track,"source":"model","approved":False})
    return {
        "artifactId":raw["artifactId"],
        "tracks":normalized,
        "segmentationRefs":list(raw.get("segmentationRefs",[])),
        "keypointRefs":list(raw.get("keypointRefs",[])),
    }
