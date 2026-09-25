"""Governed runtime boundary for Director character dataset, LoRA, and video upscale work.

This service executes already-authorized work only. It does not approve assets,
choose policies, or promote LoRAs into production inference state.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Protocol

ALLOWED_DATASET_KINDS={"angle","expression","pose","wardrobe","environment","motion-frame"}
ALLOWED_MODALITIES={"image","video"}
ALLOWED_EFFECTS={"chromatic-aberration","sharpen","bloom","grain"}


class CharacterTrainingBackend(Protocol):
    name: str
    production_ready: bool
    def generate_dataset(self, request: dict[str, Any]) -> dict[str, Any]: ...
    def train_lora(self, request: dict[str, Any]) -> dict[str, Any]: ...
    def upscale_video(self, request: dict[str, Any]) -> dict[str, Any]: ...


@dataclass(frozen=True)
class RuntimeStatus:
    mode: str
    backend: str
    production_ready: bool


def validate_dataset_plan(body: dict[str, Any]) -> None:
    for key in ("id","projectId","characterId","continuityRef","canonicalAssetId","triggerWord"):
        if not isinstance(body.get(key),str) or not body[key].strip():
            raise ValueError(f"{key} is required")
    if body.get("authority")!="DIRECTOR_CHARACTER_DATASET_PLAN":
        raise ValueError("Director character dataset authority required")
    tasks=body.get("tasks")
    if not isinstance(tasks,list) or not tasks:
        raise ValueError("dataset tasks are required")
    for index,task in enumerate(tasks):
        if not isinstance(task,dict):
            raise ValueError(f"task {index} must be an object")
        if task.get("kind") not in ALLOWED_DATASET_KINDS:
            raise ValueError(f"task {index} has invalid kind")
        sources=task.get("sourceAssetIds")
        if not isinstance(sources,list) or not sources or any(not isinstance(x,str) or not x for x in sources):
            raise ValueError(f"task {index} sourceAssetIds are required")
        if not isinstance(task.get("instruction"),str) or not task["instruction"].strip():
            raise ValueError(f"task {index} instruction is required")
    stages=body.get("stages")
    if stages!=["generate","curate","caption","upscale","optional-train-lora"]:
        raise ValueError("dataset stage order changed")


def validate_lora_request(body: dict[str, Any]) -> None:
    for key in ("id","projectId","characterId","continuityRef","datasetId","triggerWord","baseModel"):
        if not isinstance(body.get(key),str) or not body[key].strip():
            raise ValueError(f"{key} is required")
    modalities=body.get("modalities")
    if not isinstance(modalities,list) or not modalities or any(x not in ALLOWED_MODALITIES for x in modalities):
        raise ValueError("invalid LoRA modalities")
    for key in ("maxTrainingResolution","saveEverySteps","sampleEverySteps"):
        value=body.get(key)
        if not isinstance(value,int) or value<=0:
            raise ValueError(f"{key} must be a positive integer")
    prompts=body.get("samplePrompts")
    if not isinstance(prompts,list) or not prompts or any(not isinstance(x,str) or body["triggerWord"] not in x for x in prompts):
        raise ValueError("sample prompts must include trigger word")
    evidence=body.get("evidenceIds")
    if not isinstance(evidence,list) or not evidence or any(not isinstance(x,str) or not x for x in evidence):
        raise ValueError("training evidence is required")


def validate_upscale_plan(body: dict[str, Any]) -> None:
    for key in ("id","projectId","sourceAssetId"):
        if not isinstance(body.get(key),str) or not body[key].strip():
            raise ValueError(f"{key} is required")
    for key in ("sourceWidth","sourceHeight","targetWidth","targetHeight","frameCount","maxFramesPerChunk"):
        value=body.get(key)
        if not isinstance(value,int) or value<=0:
            raise ValueError(f"{key} must be a positive integer")
    fps=body.get("fps")
    if not isinstance(fps,(int,float)) or fps<=0:
        raise ValueError("fps must be positive")
    if body["targetWidth"]<body["sourceWidth"] or body["targetHeight"]<body["sourceHeight"]:
        raise ValueError("upscale target cannot be smaller than source")
    if body.get("preserveFrameCount") is not True or body.get("preserveTiming") is not True:
        raise ValueError("frame count and timing preservation are mandatory")
    chunks=body.get("chunks")
    if not isinstance(chunks,list) or not chunks:
        raise ValueError("upscale chunks are required")
    cursor=0
    for index,chunk in enumerate(chunks):
        if not isinstance(chunk,dict):
            raise ValueError(f"chunk {index} must be an object")
        start,end=chunk.get("startFrame"),chunk.get("endFrameExclusive")
        if not isinstance(start,int) or not isinstance(end,int) or start!=cursor or end<=start or end>body["frameCount"]:
            raise ValueError(f"chunk {index} changed governed frame coverage")
        if end-start>body["maxFramesPerChunk"]:
            raise ValueError(f"chunk {index} exceeds maxFramesPerChunk")
        if chunk.get("sourceAssetId")!=body["sourceAssetId"]:
            raise ValueError(f"chunk {index} changed source lineage")
        cursor=end
    if cursor!=body["frameCount"]:
        raise ValueError("upscale chunks do not cover every frame")
    for effect in body.get("effects",[]):
        if not isinstance(effect,dict) or effect.get("kind") not in ALLOWED_EFFECTS:
            raise ValueError("invalid finishing effect")
        strength=effect.get("strength")
        if not isinstance(strength,(int,float)) or strength<0 or strength>1:
            raise ValueError("invalid finishing effect strength")


def run_dataset(backend: CharacterTrainingBackend, body: dict[str, Any]) -> dict[str, Any]:
    validate_dataset_plan(body)
    raw=backend.generate_dataset(body)
    if raw.get("planId")!=body["id"]:
        raise ValueError("backend changed dataset plan identity")
    candidates=raw.get("candidateAssetIds")
    evidence=raw.get("evidenceIds")
    if not isinstance(candidates,list) or not candidates or any(not isinstance(x,str) or not x for x in candidates):
        raise ValueError("backend returned invalid candidate assets")
    if not isinstance(evidence,list) or not evidence or any(not isinstance(x,str) or not x for x in evidence):
        raise ValueError("backend returned invalid dataset evidence")
    if not isinstance(raw.get("artifactId"),str) or not raw["artifactId"]:
        raise ValueError("backend returned invalid dataset artifact")
    return {
        "artifactId":raw["artifactId"],
        "planId":body["id"],
        "candidateAssetIds":candidates,
        "provider":backend.name,
        "evidenceIds":[*evidence,f"runtime-mode:{'production' if backend.production_ready else 'contract-certification'}"],
    }


def run_lora(backend: CharacterTrainingBackend, body: dict[str, Any]) -> dict[str, Any]:
    validate_lora_request(body)
    raw=backend.train_lora(body)
    if raw.get("trainingRequestId")!=body["id"]:
        raise ValueError("backend changed training request identity")
    checkpoints=raw.get("checkpoints")
    if not isinstance(checkpoints,list) or not checkpoints:
        raise ValueError("backend returned no checkpoints")
    for index,checkpoint in enumerate(checkpoints):
        if not isinstance(checkpoint,dict):
            raise ValueError(f"checkpoint {index} invalid")
        if checkpoint.get("trainingRequestId")!=body["id"]:
            raise ValueError(f"checkpoint {index} changed training lineage")
        for key in ("id","assetUri","sha256"):
            if not isinstance(checkpoint.get(key),str) or not checkpoint[key]:
                raise ValueError(f"checkpoint {index} missing {key}")
        if not isinstance(checkpoint.get("step"),int) or checkpoint["step"]<=0:
            raise ValueError(f"checkpoint {index} invalid step")
        for key in ("sampleIdentityScore","sampleQualityScore","overfitScore"):
            value=checkpoint.get(key)
            if not isinstance(value,(int,float)) or value<0 or value>1:
                raise ValueError(f"checkpoint {index} invalid {key}")
        evidence=checkpoint.get("evidenceIds")
        if not isinstance(evidence,list) or not evidence:
            raise ValueError(f"checkpoint {index} missing evidence")
    evidence=raw.get("evidenceIds")
    if not isinstance(evidence,list) or not evidence:
        raise ValueError("backend returned invalid training evidence")
    if not isinstance(raw.get("artifactId"),str) or not raw["artifactId"]:
        raise ValueError("backend returned invalid training artifact")
    return {
        "artifactId":raw["artifactId"],
        "trainingRequestId":body["id"],
        "checkpoints":checkpoints,
        "provider":backend.name,
        "evidenceIds":[*evidence,f"runtime-mode:{'production' if backend.production_ready else 'contract-certification'}"],
    }


def run_upscale(backend: CharacterTrainingBackend, body: dict[str, Any]) -> dict[str, Any]:
    validate_upscale_plan(body)
    raw=backend.upscale_video(body)
    result=raw.get("result")
    if not isinstance(result,dict):
        raise ValueError("backend returned invalid upscale result")
    if result.get("planId")!=body["id"]:
        raise ValueError("backend changed upscale plan identity")
    expected={
        "width":body["targetWidth"],
        "height":body["targetHeight"],
        "fps":body["fps"],
        "frameCount":body["frameCount"],
    }
    for key,value in expected.items():
        if result.get(key)!=value:
            raise ValueError(f"backend changed governed upscale {key}")
    if body.get("preserveAudio",True) and result.get("audioPreserved") is not True:
        raise ValueError("backend dropped required audio")
    chunks=result.get("chunkArtifactIds")
    if not isinstance(chunks,list) or len(chunks)!=len(body["chunks"]):
        raise ValueError("backend returned wrong chunk artifact count")
    evidence=result.get("evidenceIds")
    if not isinstance(evidence,list) or not evidence:
        raise ValueError("backend returned no upscale evidence")
    if not isinstance(result.get("outputAssetId"),str) or not result["outputAssetId"]:
        raise ValueError("backend returned invalid upscale asset")
    if not isinstance(raw.get("artifactId"),str) or not raw["artifactId"]:
        raise ValueError("backend returned invalid upscale artifact")
    return {
        "artifactId":raw["artifactId"],
        "provider":backend.name,
        "result":result,
        "evidenceIds":[*list(raw.get("evidenceIds",[])),f"runtime-mode:{'production' if backend.production_ready else 'contract-certification'}"],
    }


class CertificationBackend:
    """Deterministic contract backend for live boundary certification only."""

    name="director-contract-certification"
    production_ready=False

    def generate_dataset(self, request: dict[str, Any]) -> dict[str, Any]:
        digest=_digest(request["id"],request["canonicalAssetId"])
        candidates=[f"cert://dataset/{digest}/{index+1}" for index,_ in enumerate(request["tasks"])]
        return {
            "artifactId":f"cert:dataset:{digest}",
            "planId":request["id"],
            "candidateAssetIds":candidates,
            "evidenceIds":["certification:dataset-contract","certification:no-model-inference"],
        }

    def train_lora(self, request: dict[str, Any]) -> dict[str, Any]:
        digest=_digest(request["id"],request["datasetId"],request["baseModel"])
        step=request["saveEverySteps"]
        return {
            "artifactId":f"cert:lora-training:{digest}",
            "trainingRequestId":request["id"],
            "checkpoints":[{
                "id":f"cert-step-{step}",
                "trainingRequestId":request["id"],
                "step":step,
                "assetUri":f"cert://lora/{digest}/{step}.safetensors",
                "sha256":sha256(f"{digest}:{step}".encode()).hexdigest(),
                "sampleIdentityScore":0.95,
                "sampleQualityScore":0.92,
                "overfitScore":0.08,
                "evidenceIds":["certification:lora-contract","certification:no-model-training"],
            }],
            "evidenceIds":["certification:training-contract","certification:no-model-training"],
        }

    def upscale_video(self, request: dict[str, Any]) -> dict[str, Any]:
        digest=_digest(request["id"],request["sourceAssetId"])
        return {
            "artifactId":f"cert:upscale:{digest}",
            "provider":self.name,
            "result":{
                "planId":request["id"],
                "outputAssetId":f"cert://video/{digest}/{request['targetWidth']}x{request['targetHeight']}",
                "width":request["targetWidth"],
                "height":request["targetHeight"],
                "fps":request["fps"],
                "frameCount":request["frameCount"],
                "audioPreserved":bool(request.get("preserveAudio",True)),
                "chunkArtifactIds":[f"cert:chunk:{digest}:{index+1}" for index,_ in enumerate(request["chunks"])],
                "evidenceIds":["certification:upscale-contract","certification:no-pixel-processing"],
            },
            "evidenceIds":["certification:upscale-runtime"],
        }


def _digest(*values: str) -> str:
    return sha256(":".join(values).encode()).hexdigest()[:20]
