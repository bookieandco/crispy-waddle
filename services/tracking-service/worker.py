"""Sandboxed SAM2 worker boundary for Director Studio.

The worker owns model inference only. It receives already-governed bounded work and
returns evidence; it never approves tracks or makes Jhadina policy decisions.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

REQUIRED_SAM2_ARTIFACT_ID="sam2:runtime-checkpoint"
REQUIRED_SAM2_PIN_ID="artifact:sam2:checkpoint"

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

@dataclass(frozen=True)
class ArtifactDeploymentProof:
    artifact_id:str
    pin_id:str
    runtime_instance_id:str
    admission_id:str
    admission_receipt_hash:str
    attestation_id:str
    attestation_hash:str
    artifact_digest:str
    session_id:str
    session_hash:str
    heartbeat_expires_at:str
    revocation_snapshot_hash:str
    revocation_snapshot_expires_at:str

def _parse_utc(value:str)->datetime:
    parsed=datetime.fromisoformat(value.replace("Z","+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("SAM2 runtime lease timestamp must include timezone")
    return parsed.astimezone(timezone.utc)

def validate_sam2_deployment_proof(proof:ArtifactDeploymentProof)->None:
    if proof.artifact_id != REQUIRED_SAM2_ARTIFACT_ID:
        raise ValueError("SAM2 artifact deployment proof required")
    if proof.pin_id != REQUIRED_SAM2_PIN_ID:
        raise ValueError("SAM2 artifact pin proof required")
    for value in (
        proof.runtime_instance_id,
        proof.admission_id,
        proof.admission_receipt_hash,
        proof.attestation_id,
        proof.attestation_hash,
        proof.artifact_digest,
        proof.session_id,
        proof.session_hash,
        proof.revocation_snapshot_hash,
    ):
        if not isinstance(value,str) or not value:
            raise ValueError("SAM2 durable artifact attestation required")
    if not proof.artifact_digest.startswith("sha256:"):
        raise ValueError("SAM2 artifact digest must be sha256")
    now=datetime.now(timezone.utc)
    if _parse_utc(proof.heartbeat_expires_at) <= now:
        raise ValueError("SAM2 runtime lease heartbeat expired")
    if _parse_utc(proof.revocation_snapshot_expires_at) <= now:
        raise ValueError("SAM2 revocation snapshot expired")

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

def run_sam2(engine:Sam2Engine, body:dict[str,Any], deployment_proof:ArtifactDeploymentProof)->dict[str,Any]:
    validate_sam2_deployment_proof(deployment_proof)
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
