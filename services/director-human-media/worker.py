"""MuseTalk 1.5 execution worker for Director human-media lip-sync jobs.

This service is intentionally a transport/runtime adapter. Director owns Product Truth,
rights, QC, acceptance, spend and publication authority.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import threading
from typing import Any
from urllib.parse import urlparse
import urllib.request

PINNED_MUSETALK_CODE_REVISION="0a89dec45a0192b824e3cf4daf96c239440c5ed8"
SOURCE_MANIFEST_SCHEMA="DIRECTOR-HUMAN-MEDIA-MUSETALK-SOURCES-1"
MIN_GPU_MEMORY_MB=4096
SHA256_RE=re.compile(r"^(?:sha256:)?[0-9a-f]{64}$",re.IGNORECASE)
ALLOWED_VISUAL_ROLES={"source-video","source-image"}
ALLOWED_AUDIO_ROLES={"driving-audio","source-audio"}
ALLOWED_MEDIA_TYPES={"image","video","audio"}

def _now()->str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")

def _normalize_sha(value:str)->str:
    return value.strip().lower().removeprefix("sha256:")

def _valid_sha(value:str)->bool:
    return bool(SHA256_RE.fullmatch(value.strip()))

def _nonempty(value:Any,code:str)->str:
    if not isinstance(value,str) or not value.strip():
        raise ValueError(code)
    return value.strip()

def _unique_nonempty(values:Any)->list[str]:
    if not isinstance(values,list):
        return []
    result:list[str]=[]
    for raw in values:
        value=str(raw).strip()
        if value and value not in result:
            result.append(value)
    return result

@dataclass(frozen=True)
class MuseTalkRuntimeConfig:
    repo_dir:Path
    output_dir:Path
    runtime_instance_id:str
    image_digest:str
    source_revision:str
    source_manifest_path:Path

    @classmethod
    def from_env(cls)->"MuseTalkRuntimeConfig":
        required={
            "DIRECTOR_MUSETALK_REPO_DIR":os.getenv("DIRECTOR_MUSETALK_REPO_DIR",""),
            "DIRECTOR_MUSETALK_OUTPUT_DIR":os.getenv("DIRECTOR_MUSETALK_OUTPUT_DIR",""),
            "DIRECTOR_HUMAN_MEDIA_RUNTIME_INSTANCE_ID":os.getenv("DIRECTOR_HUMAN_MEDIA_RUNTIME_INSTANCE_ID",""),
            "DIRECTOR_HUMAN_MEDIA_IMAGE_DIGEST":os.getenv("DIRECTOR_HUMAN_MEDIA_IMAGE_DIGEST",""),
        }
        missing=[key for key,value in required.items() if not value.strip()]
        if missing:
            raise ValueError("DIRECTOR_MUSETALK_RUNTIME_NOT_CONFIGURED:"+",".join(missing))
        image_digest=required["DIRECTOR_HUMAN_MEDIA_IMAGE_DIGEST"].strip()
        if not _valid_sha(image_digest):
            raise ValueError("DIRECTOR_MUSETALK_RUNTIME_DIGEST_INVALID")
        repo_dir=Path(required["DIRECTOR_MUSETALK_REPO_DIR"])
        manifest=Path(os.getenv(
            "DIRECTOR_MUSETALK_SOURCE_MANIFEST",
            str(repo_dir/"DIRECTOR_RUNTIME_SOURCES.json"),
        ))
        return cls(
            repo_dir=repo_dir,
            output_dir=Path(required["DIRECTOR_MUSETALK_OUTPUT_DIR"]),
            runtime_instance_id=required["DIRECTOR_HUMAN_MEDIA_RUNTIME_INSTANCE_ID"].strip(),
            image_digest=image_digest,
            source_revision=os.getenv(
                "DIRECTOR_MUSETALK_SOURCE_REVISION",
                PINNED_MUSETALK_CODE_REVISION,
            ).strip(),
            source_manifest_path=manifest,
        )

def _read_manifest(config:MuseTalkRuntimeConfig)->tuple[dict[str,Any]|None,list[str],list[str]]:
    path=config.source_manifest_path
    if not path.is_file():
        return None,[],[]
    try:
        payload=json.loads(path.read_text())
    except Exception:
        return None,[],[]
    if payload.get("schemaVersion")!=SOURCE_MANIFEST_SCHEMA:
        return None,[],[]
    if payload.get("sourceRevision")!=config.source_revision:
        return None,[],[]
    artifacts=payload.get("modelArtifacts")
    if not isinstance(artifacts,list) or not artifacts:
        return None,[],[]
    hashes:list[str]=[]
    evidence:list[str]=[]
    ids:set[str]=set()
    for artifact in artifacts:
        if not isinstance(artifact,dict):
            return None,[],[]
        artifact_id=artifact.get("id")
        digest=artifact.get("sha256")
        licenses=_unique_nonempty(artifact.get("licenseEvidenceIds"))
        if not isinstance(artifact_id,str) or not artifact_id.strip() or artifact_id in ids:
            return None,[],[]
        ids.add(artifact_id)
        if not isinstance(digest,str) or not _valid_sha(digest) or not licenses:
            return None,[],[]
        hashes.append(_normalize_sha(digest))
        evidence.extend(licenses)
    return payload,sorted(set(hashes)),sorted(set(evidence))

def _git_revision(repo:Path)->str|None:
    try:
        return subprocess.check_output(
            ["git","-C",str(repo),"rev-parse","HEAD"],
            stderr=subprocess.DEVNULL,
            timeout=10,
            text=True,
        ).strip()
    except Exception:
        return None

def _gpu_health()->dict[str,Any]:
    try:
        output=subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total",
                "--format=csv,noheader,nounits",
            ],
            stderr=subprocess.DEVNULL,
            timeout=10,
            text=True,
        )
    except Exception:
        return {"vendor":"cpu","count":0}
    rows=[line.strip() for line in output.splitlines() if line.strip()]
    if not rows:
        return {"vendor":"cpu","count":0}
    memories:list[int]=[]
    names:list[str]=[]
    for row in rows:
        parts=[part.strip() for part in row.rsplit(",",1)]
        if len(parts)!=2:
            continue
        names.append(parts[0])
        try:
            memories.append(int(parts[1]))
        except ValueError:
            memories.append(0)
    if not memories:
        return {"vendor":"cpu","count":0}
    return {
        "vendor":"nvidia",
        "model":names[0] if names else "NVIDIA GPU",
        "count":len(memories),
        "vramGiBPerDevice":round(min(memories)/1024,2),
    }

def runtime_health(config:MuseTalkRuntimeConfig)->dict[str,Any]:
    manifest,artifact_hashes,license_evidence=_read_manifest(config)
    reasons:list[str]=[]
    revision=_git_revision(config.repo_dir)
    if revision!=config.source_revision:
        reasons.append("DIRECTOR_MUSETALK_SOURCE_REVISION_MISMATCH")
    required=[
        config.repo_dir/"scripts/inference.py",
        config.repo_dir/"models/musetalkV15/unet.pth",
        config.repo_dir/"models/musetalkV15/musetalk.json",
        config.repo_dir/"models/sd-vae/config.json",
        config.repo_dir/"models/sd-vae/diffusion_pytorch_model.bin",
        config.repo_dir/"models/whisper/config.json",
        config.repo_dir/"models/whisper/pytorch_model.bin",
        config.repo_dir/"models/whisper/preprocessor_config.json",
        config.repo_dir/"models/face-parse-bisent/79999_iter.pth",
        config.repo_dir/"models/face-parse-bisent/resnet18-5c106cde.pth",
    ]
    if any(not path.is_file() for path in required):
        reasons.append("DIRECTOR_MUSETALK_MODEL_TREE_INCOMPLETE")
    if manifest is None or not artifact_hashes or not license_evidence:
        reasons.append("DIRECTOR_MUSETALK_SOURCE_MANIFEST_INVALID")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        reasons.append("DIRECTOR_MUSETALK_FFMPEG_REQUIRED")
    gpu=_gpu_health()
    if gpu.get("vendor")!="nvidia" or float(gpu.get("vramGiBPerDevice",0))*1024<MIN_GPU_MEMORY_MB:
        reasons.append("DIRECTOR_MUSETALK_GPU_BELOW_4GB_OR_UNAVAILABLE")
    return {
        "schema":"director.human-media-health.v1",
        "runtimeInstanceId":config.runtime_instance_id,
        "engine":"musetalk",
        "productionReady":not reasons,
        "imageDigest":_normalize_sha(config.image_digest),
        "sourceRevision":config.source_revision,
        "modelArtifactSha256s":artifact_hashes,
        "gpu":gpu,
        "licenseEvidenceIds":license_evidence,
        "observedAt":_now(),
        "reasons":reasons,
        "authority":"DIRECTOR_HUMAN_MEDIA_HEALTH",
    }

def validate_request(request:dict[str,Any])->None:
    if request.get("schema")!="director.human-media-job.v1":
        raise ValueError("DIRECTOR_MUSETALK_JOB_SCHEMA_INVALID")
    for key,code in (
        ("id","DIRECTOR_MUSETALK_JOB_ID_REQUIRED"),
        ("projectId","DIRECTOR_MUSETALK_PROJECT_ID_REQUIRED"),
    ):
        _nonempty(request.get(key),code)
    if request.get("engine")!="musetalk" or request.get("task")!="lip-sync":
        raise ValueError("DIRECTOR_MUSETALK_ENGINE_TASK_MISMATCH")
    if request.get("authority")!="DIRECTOR_HUMAN_MEDIA_JOB":
        raise ValueError("DIRECTOR_MUSETALK_AUTHORITY_REQUIRED")
    if request.get("sensitiveData") is True:
        raise ValueError("DIRECTOR_MUSETALK_SENSITIVE_CLOUD_EXECUTION_FORBIDDEN")
    if request.get("allowCloudBurst") is not True:
        raise ValueError("DIRECTOR_MUSETALK_CLOUD_BURST_NOT_AUTHORIZED")
    if not _unique_nonempty(request.get("evidenceIds")):
        raise ValueError("DIRECTOR_MUSETALK_JOB_EVIDENCE_REQUIRED")
    assets=request.get("inputAssets")
    if not isinstance(assets,list) or not assets:
        raise ValueError("DIRECTOR_MUSETALK_INPUT_REQUIRED")
    ids:set[str]=set()
    visuals=0
    audios=0
    for raw in assets:
        if not isinstance(raw,dict):
            raise ValueError("DIRECTOR_MUSETALK_ASSET_INVALID")
        asset_id=_nonempty(raw.get("assetId"),"DIRECTOR_MUSETALK_ASSET_ID_REQUIRED")
        if asset_id in ids:
            raise ValueError("DIRECTOR_MUSETALK_ASSET_ID_DUPLICATE")
        ids.add(asset_id)
        role=_nonempty(raw.get("role"),"DIRECTOR_MUSETALK_ASSET_ROLE_REQUIRED")
        media_type=_nonempty(raw.get("mediaType"),"DIRECTOR_MUSETALK_ASSET_MEDIA_TYPE_REQUIRED")
        uri=_nonempty(raw.get("uri"),"DIRECTOR_MUSETALK_ASSET_URI_REQUIRED")
        digest=_nonempty(raw.get("sha256"),"DIRECTOR_MUSETALK_ASSET_SHA_REQUIRED")
        if media_type not in ALLOWED_MEDIA_TYPES or not _valid_sha(digest):
            raise ValueError("DIRECTOR_MUSETALK_ASSET_INVALID")
        if not _unique_nonempty(raw.get("rightsEvidenceIds")):
            raise ValueError("DIRECTOR_MUSETALK_ASSET_RIGHTS_REQUIRED")
        _validate_remote_uri(uri)
        if role in ALLOWED_VISUAL_ROLES:
            visuals+=1
            if media_type not in {"image","video"}:
                raise ValueError("DIRECTOR_MUSETALK_VISUAL_MEDIA_TYPE_INVALID")
        elif role in ALLOWED_AUDIO_ROLES:
            audios+=1
            if media_type!="audio":
                raise ValueError("DIRECTOR_MUSETALK_AUDIO_MEDIA_TYPE_INVALID")
        else:
            raise ValueError("DIRECTOR_MUSETALK_ASSET_ROLE_UNSUPPORTED")
    if visuals!=1 or audios!=1:
        raise ValueError("DIRECTOR_MUSETALK_EXACT_VISUAL_AND_AUDIO_REQUIRED")

def provider_job_id(idempotency_key:str,job_id:str)->str:
    if not idempotency_key.strip():
        raise ValueError("DIRECTOR_MUSETALK_IDEMPOTENCY_KEY_REQUIRED")
    return "musetalk-"+sha256(f"{idempotency_key}|{job_id}".encode()).hexdigest()[:24]

def _validate_remote_uri(uri:str)->None:
    parsed=urlparse(uri)
    if parsed.scheme=="https":
        if not parsed.hostname:
            raise ValueError("DIRECTOR_MUSETALK_ASSET_URI_INVALID")
        return
    if parsed.scheme=="http" and parsed.hostname in {"127.0.0.1","localhost","::1"}:
        return
    raise ValueError("DIRECTOR_MUSETALK_ASSET_URI_HTTPS_REQUIRED")

def _resolved_public_ip(hostname:str)->bool:
    try:
        infos=socket.getaddrinfo(hostname,None)
    except OSError:
        return False
    for info in infos:
        address=info[4][0]
        try:
            ip=ipaddress.ip_address(address)
        except ValueError:
            return False
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False
    return True

def _download_verified(uri:str,expected_sha256:str,destination:Path)->None:
    _validate_remote_uri(uri)
    parsed=urlparse(uri)
    if parsed.scheme=="https" and parsed.hostname and not _resolved_public_ip(parsed.hostname):
        raise ValueError("DIRECTOR_MUSETALK_ASSET_HOST_NOT_PUBLIC")
    request=urllib.request.Request(uri,headers={"User-Agent":"jhadina-director-musetalk/1"})
    with urllib.request.urlopen(request,timeout=120) as response:
        data=response.read()
    actual=sha256(data).hexdigest()
    if actual!=_normalize_sha(expected_sha256):
        raise ValueError("DIRECTOR_MUSETALK_ASSET_HASH_MISMATCH")
    destination.write_bytes(data)

def _asset_for(request:dict[str,Any],roles:set[str])->dict[str,Any]:
    return next(asset for asset in request["inputAssets"] if asset["role"] in roles)

def build_cli_arguments(
    request:dict[str,Any],
    config:MuseTalkRuntimeConfig,
    inference_config:Path,
    result_dir:Path,
)->list[str]:
    validate_request(request)
    return [
        sys.executable,
        "-m","scripts.inference",
        "--inference_config",str(inference_config),
        "--result_dir",str(result_dir),
        "--unet_model_path",str(config.repo_dir/"models/musetalkV15/unet.pth"),
        "--unet_config",str(config.repo_dir/"models/musetalkV15/musetalk.json"),
        "--whisper_dir",str(config.repo_dir/"models/whisper"),
        "--version","v15",
        "--use_float16",
    ]

class MuseTalkJobManager:
    def __init__(self,config:MuseTalkRuntimeConfig):
        self.config=config
        self.config.output_dir.mkdir(parents=True,exist_ok=True)
        self._lock=threading.Lock()
        self._processes:dict[str,subprocess.Popen[bytes]]={}

    def _job_dir(self,provider_job_id:str)->Path:
        return self.config.output_dir/provider_job_id

    def _state_path(self,provider_job_id:str)->Path:
        return self._job_dir(provider_job_id)/"state.json"

    def _read_state(self,provider_job_id:str)->dict[str,Any]|None:
        path=self._state_path(provider_job_id)
        if not path.is_file():
            return None
        return json.loads(path.read_text())

    def _write_state(self,provider_job_id:str,state:dict[str,Any])->None:
        directory=self._job_dir(provider_job_id)
        directory.mkdir(parents=True,exist_ok=True)
        tmp=directory/"state.json.tmp"
        tmp.write_text(json.dumps(state,sort_keys=True))
        tmp.replace(self._state_path(provider_job_id))

    def _base_receipt(self,request:dict[str,Any],provider_job_id:str,status:str)->dict[str,Any]:
        health=runtime_health(self.config)
        return {
            "schema":"director.human-media-execution.v1",
            "jobId":request["id"],
            "providerJobId":provider_job_id,
            "engine":"musetalk",
            "task":"lip-sync",
            "status":status,
            "runtimeInstanceId":self.config.runtime_instance_id,
            "imageDigest":health["imageDigest"],
            "sourceRevision":self.config.source_revision,
            "modelArtifactSha256s":health["modelArtifactSha256s"],
            "qualityClaim":False,
            "authority":"DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT",
        }

    def submit(self,request:dict[str,Any],idempotency_key:str)->dict[str,Any]:
        validate_request(request)
        health=runtime_health(self.config)
        if not health["productionReady"]:
            raise RuntimeError("DIRECTOR_MUSETALK_RUNTIME_NOT_READY:"+",".join(health["reasons"]))
        provider_id=provider_job_id(idempotency_key,request["id"])
        with self._lock:
            existing=self._read_state(provider_id)
            if existing:
                return existing
            state=self._base_receipt(request,provider_id,"queued")
            self._write_state(provider_id,state)
            threading.Thread(target=self._run,args=(provider_id,request),daemon=True).start()
            return state

    def _run(self,provider_id:str,request:dict[str,Any])->None:
        job_dir=self._job_dir(provider_id)
        job_dir.mkdir(parents=True,exist_ok=True)
        try:
            started=_now()
            self._write_state(provider_id,{
                **self._base_receipt(request,provider_id,"processing"),
                "startedAt":started,
            })
            visual=_asset_for(request,ALLOWED_VISUAL_ROLES)
            audio=_asset_for(request,ALLOWED_AUDIO_ROLES)
            visual_suffix=".png" if visual["mediaType"]=="image" else ".mp4"
            visual_path=job_dir/("visual"+visual_suffix)
            audio_path=job_dir/"audio.wav"
            _download_verified(visual["uri"],visual["sha256"],visual_path)
            _download_verified(audio["uri"],audio["sha256"],audio_path)
            inference_config=job_dir/"inference.yaml"
            inference_config.write_text(json.dumps({
                "task_0":{
                    "video_path":str(visual_path),
                    "audio_path":str(audio_path),
                    "result_name":"output.mp4",
                }
            },sort_keys=True))
            result_dir=job_dir/"results"
            args=build_cli_arguments(request,self.config,inference_config,result_dir)
            process=subprocess.Popen(
                args,
                cwd=self.config.repo_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )
            with self._lock:
                self._processes[provider_id]=process
            stdout,_=process.communicate()
            with self._lock:
                self._processes.pop(provider_id,None)
            (job_dir/"worker.log").write_bytes(stdout[-200000:])
            if process.returncode!=0:
                raise RuntimeError("DIRECTOR_MUSETALK_INFERENCE_FAILED")
            output=result_dir/"v15"/"output.mp4"
            if not output.is_file() or output.stat().st_size<=0:
                raise RuntimeError("DIRECTOR_MUSETALK_OUTPUT_MISSING")
            digest=sha256(output.read_bytes()).hexdigest()
            completed=_now()
            self._write_state(provider_id,{
                **self._base_receipt(request,provider_id,"ready"),
                "startedAt":started,
                "completedAt":completed,
                "output":{
                    "uri":f"/v1/jobs/{provider_id}/artifact",
                    "mediaType":"video",
                    "sha256":digest,
                },
            })
        except Exception as exc:
            (job_dir/"error.log").write_text(str(exc))
            state=self._read_state(provider_id) or self._base_receipt(request,provider_id,"failed")
            self._write_state(provider_id,{
                **state,
                "status":"failed",
                "completedAt":_now(),
                "errorCode":str(exc).split(":",1)[0][:96] or "DIRECTOR_MUSETALK_RUNTIME_FAILED",
                "qualityClaim":False,
            })

    def status(self,provider_job_id_value:str)->dict[str,Any]|None:
        return self._read_state(provider_job_id_value)

    def artifact_path(self,provider_job_id_value:str)->Path|None:
        state=self._read_state(provider_job_id_value)
        if not state or state.get("status")!="ready":
            return None
        path=self._job_dir(provider_job_id_value)/"results"/"v15"/"output.mp4"
        return path if path.is_file() else None

    def cancel(self,provider_job_id_value:str)->bool:
        with self._lock:
            process=self._processes.get(provider_job_id_value)
            if process and process.poll() is None:
                process.terminate()
            state=self._read_state(provider_job_id_value)
            if not state:
                return False
            self._write_state(provider_job_id_value,{
                **state,
                "status":"cancelled",
                "completedAt":_now(),
                "qualityClaim":False,
            })
            return True
