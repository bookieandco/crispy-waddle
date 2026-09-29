"""Private HunyuanVideo-1.5 execution worker for Director."""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import urllib.request
from typing import Any

ALLOWED_MODELS={
    "hunyuan-video-1.5-480p-i2v-step-distilled",
    "hunyuan-video-1.5-480p-i2v",
    "hunyuan-video-1.5-720p-i2v",
    "hunyuan-video-1.5-480p-t2v",
    "hunyuan-video-1.5-720p-t2v",
}
ALLOWED_RESOLUTIONS={"480p","720p"}
ALLOWED_ASPECTS={"16:9","9:16","1:1"}
MIN_GPU_MEMORY_MB=14*1024
MAX_VIDEO_FRAMES=241

@dataclass(frozen=True)
class HunyuanRuntimeConfig:
    repo_dir: Path
    model_path: Path
    output_dir: Path
    model_version: str
    license_acknowledged: bool
    territory_acknowledged: bool

    @classmethod
    def from_env(cls)->"HunyuanRuntimeConfig":
        required={
            "HUNYUAN_VIDEO_REPO_DIR":os.getenv("HUNYUAN_VIDEO_REPO_DIR",""),
            "HUNYUAN_VIDEO_MODEL_PATH":os.getenv("HUNYUAN_VIDEO_MODEL_PATH",""),
            "DIRECTOR_HUNYUAN_OUTPUT_DIR":os.getenv("DIRECTOR_HUNYUAN_OUTPUT_DIR",""),
        }
        missing=[key for key,value in required.items() if not value.strip()]
        if missing:
            raise ValueError("DIRECTOR_HUNYUAN_RUNTIME_NOT_CONFIGURED:"+",".join(missing))
        yes=lambda key: os.getenv(key,"").strip().lower() in {"1","true","yes","on"}
        return cls(
            repo_dir=Path(required["HUNYUAN_VIDEO_REPO_DIR"]),
            model_path=Path(required["HUNYUAN_VIDEO_MODEL_PATH"]),
            output_dir=Path(required["DIRECTOR_HUNYUAN_OUTPUT_DIR"]),
            model_version=os.getenv("HUNYUAN_VIDEO_MODEL_VERSION","HunyuanVideo-1.5"),
            license_acknowledged=yes("DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED"),
            territory_acknowledged=yes("DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED"),
        )

    def checkpoint_tree_ready(self)->bool:
        required=[
            self.repo_dir/"generate.py",
            self.model_path/"transformer",
            self.model_path/"text_encoder",
            self.model_path/"vision_encoder",
        ]
        return all(path.exists() for path in required)

def _gpu_memory_mb()->list[int]:
    try:
        output=subprocess.check_output(
            ["nvidia-smi","--query-gpu=memory.total","--format=csv,noheader,nounits"],
            stderr=subprocess.DEVNULL,
            timeout=10,
            text=True,
        )
    except Exception:
        return []
    values=[]
    for line in output.splitlines():
        try:
            values.append(int(line.strip()))
        except ValueError:
            pass
    return values

def runtime_readiness(config:HunyuanRuntimeConfig)->dict[str,Any]:
    memory=_gpu_memory_mb()
    gpu_ready=any(value>=MIN_GPU_MEMORY_MB for value in memory)
    reasons=[]
    if not config.license_acknowledged:
        reasons.append("DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGEMENT_REQUIRED")
    if not config.territory_acknowledged:
        reasons.append("DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGEMENT_REQUIRED")
    if not config.checkpoint_tree_ready():
        reasons.append("DIRECTOR_HUNYUAN_CHECKPOINT_TREE_INCOMPLETE")
    if not gpu_ready:
        reasons.append("DIRECTOR_HUNYUAN_GPU_MEMORY_BELOW_14GB_OR_UNAVAILABLE")
    return {
        "productionReady":not reasons,
        "reasons":reasons,
        "gpuMemoryMb":memory,
        "minimumGpuMemoryMb":MIN_GPU_MEMORY_MB,
        "checkpointTreeReady":config.checkpoint_tree_ready(),
        "licenseAcknowledged":config.license_acknowledged,
        "territoryAcknowledged":config.territory_acknowledged,
    }

def _nonempty(body:dict[str,Any],key:str)->str:
    value=body.get(key)
    if not isinstance(value,str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value.strip()

def validate_request(request:dict[str,Any])->None:
    for key in ("requestId","projectId","prompt","model","mode","resolution","aspectRatio"):
        _nonempty(request,key)
    if request.get("authority")!="DIRECTOR_HUNYUAN_VIDEO_15_REQUEST":
        raise ValueError("Director Hunyuan authority required")
    if request["model"] not in ALLOWED_MODELS:
        raise ValueError("invalid Hunyuan model")
    if request["mode"] not in {"i2v","t2v"}:
        raise ValueError("invalid Hunyuan mode")
    if request["resolution"] not in ALLOWED_RESOLUTIONS:
        raise ValueError("invalid Hunyuan resolution")
    if request["aspectRatio"] not in ALLOWED_ASPECTS:
        raise ValueError("invalid Hunyuan aspect ratio")
    frames=request.get("videoLength")
    if not isinstance(frames,int) or frames<5 or frames>MAX_VIDEO_FRAMES or (frames!=121 and (frames-1)%4):
        raise ValueError("invalid Hunyuan video length")
    seed=request.get("seed")
    if not isinstance(seed,int) or seed<0:
        raise ValueError("invalid Hunyuan seed")
    steps=request.get("numInferenceSteps")
    if not isinstance(steps,int) or steps<1:
        raise ValueError("invalid Hunyuan inference steps")
    if request.get("enableStepDistill") and steps not in {4,8,12}:
        raise ValueError("invalid Hunyuan step-distill steps")
    reference=request.get("reference")
    if request["mode"]=="i2v":
        if not isinstance(reference,dict):
            raise ValueError("Hunyuan I2V reference required")
        for key in ("assetId","uri","sha256","semanticLabel"):
            _nonempty(reference,key)
        digest=reference["sha256"]
        if len(digest)!=64 or any(ch not in "0123456789abcdefABCDEF" for ch in digest):
            raise ValueError("Hunyuan reference sha256 invalid")
        if not isinstance(reference.get("evidenceIds"),list) or not reference["evidenceIds"]:
            raise ValueError("Hunyuan reference evidence required")
    elif reference is not None:
        raise ValueError("Hunyuan T2V reference forbidden")

def provider_job_id(idempotency_key:str,request_id:str)->str:
    if not idempotency_key.strip():
        raise ValueError("idempotency key required")
    return "hunyuan-"+sha256(f"{idempotency_key}|{request_id}".encode()).hexdigest()[:24]

def _download_verified(uri:str,expected_sha256:str,destination:Path)->None:
    req=urllib.request.Request(uri,headers={"User-Agent":"jhadina-director-hunyuan/1"})
    with urllib.request.urlopen(req,timeout=60) as response:
        data=response.read()
    actual=sha256(data).hexdigest()
    if actual.lower()!=expected_sha256.lower():
        raise ValueError("DIRECTOR_HUNYUAN_REFERENCE_HASH_MISMATCH")
    destination.write_bytes(data)

def _probe_duration_seconds(path:Path)->float:
    output=subprocess.check_output(
        [
            "ffprobe","-v","error","-show_entries","format=duration",
            "-of","default=noprint_wrappers=1:nokey=1",str(path),
        ],
        stderr=subprocess.STDOUT,
        timeout=30,
        text=True,
    ).strip()
    duration=float(output)
    if duration<=0:
        raise RuntimeError("DIRECTOR_HUNYUAN_OUTPUT_DURATION_INVALID")
    return duration

def build_cli_arguments(request:dict[str,Any],config:HunyuanRuntimeConfig,reference_path:Path|None,output_path:Path)->list[str]:
    validate_request(request)
    if request["mode"]=="i2v" and reference_path is None:
        raise ValueError("DIRECTOR_HUNYUAN_RUNTIME_REFERENCE_REQUIRED")
    return [
        sys.executable,
        str(config.repo_dir/"generate.py"),
        "--prompt",request["prompt"],
        "--negative_prompt",request.get("negativePrompt",""),
        "--resolution",request["resolution"],
        "--model_path",str(config.model_path),
        "--aspect_ratio",request["aspectRatio"],
        "--num_inference_steps",str(request["numInferenceSteps"]),
        "--video_length",str(request["videoLength"]),
        "--seed",str(request["seed"]),
        "--image_path",str(reference_path) if reference_path else "none",
        "--output_path",str(output_path),
        "--sr",str(bool(request.get("enableSuperResolution",True))).lower(),
        "--rewrite",str(bool(request.get("rewritePrompt",False))).lower(),
        "--cfg_distilled",str(bool(request.get("cfgDistilled",False))).lower(),
        "--enable_step_distill",str(bool(request.get("enableStepDistill",False))).lower(),
        "--offloading",str(bool(request.get("offloading",True))).lower(),
        "--group_offloading",str(bool(request.get("groupOffloading",True))).lower(),
        "--overlap_group_offloading",str(bool(request.get("overlapGroupOffloading",False))).lower(),
        "--save_generation_config","true",
    ]

class HunyuanJobManager:
    def __init__(self,config:HunyuanRuntimeConfig):
        self.config=config
        self.config.output_dir.mkdir(parents=True,exist_ok=True)
        self._lock=threading.Lock()
        self._processes:dict[str,subprocess.Popen[bytes]]={}

    def _job_dir(self,job_id:str)->Path:
        return self.config.output_dir/job_id

    def _state_path(self,job_id:str)->Path:
        return self._job_dir(job_id)/"state.json"

    def _read_state(self,job_id:str)->dict[str,Any]|None:
        path=self._state_path(job_id)
        if not path.is_file():
            return None
        return json.loads(path.read_text())

    def _write_state(self,job_id:str,state:dict[str,Any])->None:
        directory=self._job_dir(job_id)
        directory.mkdir(parents=True,exist_ok=True)
        tmp=directory/"state.json.tmp"
        tmp.write_text(json.dumps(state,sort_keys=True))
        tmp.replace(self._state_path(job_id))

    def submit(self,request:dict[str,Any],idempotency_key:str)->dict[str,Any]:
        validate_request(request)
        readiness=runtime_readiness(self.config)
        if not readiness["productionReady"]:
            raise RuntimeError("DIRECTOR_HUNYUAN_RUNTIME_NOT_READY:"+",".join(readiness["reasons"]))
        job_id=provider_job_id(idempotency_key,request["requestId"])
        with self._lock:
            existing=self._read_state(job_id)
            if existing:
                return existing
            state={
                "providerJobId":job_id,
                "status":"queued",
                "requestId":request["requestId"],
                "projectId":request["projectId"],
                "model":request["model"],
                "modelVersion":self.config.model_version,
                "qualityClaim":False,
            }
            self._write_state(job_id,state)
            threading.Thread(target=self._run,args=(job_id,request),daemon=True).start()
        return state

    def _run(self,job_id:str,request:dict[str,Any])->None:
        job_dir=self._job_dir(job_id)
        try:
            self._write_state(job_id,{**(self._read_state(job_id) or {}),"status":"processing"})
            reference_path=None
            if request["mode"]=="i2v":
                reference_path=job_dir/f"reference-{request['reference']['sha256'][:16]}.png"
                _download_verified(request["reference"]["uri"],request["reference"]["sha256"],reference_path)
            output=job_dir/"output.mp4"
            args=build_cli_arguments(request,self.config,reference_path,output)
            process=subprocess.Popen(args,cwd=self.config.repo_dir,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            with self._lock:
                self._processes[job_id]=process
            stdout,_=process.communicate()
            with self._lock:
                self._processes.pop(job_id,None)
            if process.returncode!=0:
                raise RuntimeError("DIRECTOR_HUNYUAN_INFERENCE_FAILED:"+stdout.decode(errors="replace")[-4000:])
            if not output.is_file() or output.stat().st_size<=0:
                raise RuntimeError("DIRECTOR_HUNYUAN_OUTPUT_MISSING")
            digest=sha256(output.read_bytes()).hexdigest()
            measured_duration_seconds=_probe_duration_seconds(output)
            config_path=output.with_name(output.stem+"_config.json")
            receipt_payload={
                "providerJobId":job_id,
                "requestId":request["requestId"],
                "projectId":request["projectId"],
                "model":request["model"],
                "modelVersion":self.config.model_version,
                "seed":request["seed"],
                "videoLength":request["videoLength"],
                "resolution":request["resolution"],
                "referenceSha256":request.get("reference",{}).get("sha256"),
                "outputSha256":digest,
                "measuredDurationSeconds":measured_duration_seconds,
                "generationConfigSha256":sha256(config_path.read_bytes()).hexdigest() if config_path.is_file() else None,
            }
            receipt="hunyuan-runtime:"+sha256(json.dumps(receipt_payload,sort_keys=True).encode()).hexdigest()
            self._write_state(job_id,{
                **receipt_payload,
                "status":"ready",
                "resultUri":f"/v1/jobs/{job_id}/artifact",
                "runtimeReceiptId":receipt,
                "qualityClaim":False,
                "outputPath":str(output),
            })
        except Exception as exc:
            self._write_state(job_id,{
                **(self._read_state(job_id) or {"providerJobId":job_id}),
                "status":"failed",
                "error":str(exc),
                "qualityClaim":False,
            })

    def status(self,job_id:str)->dict[str,Any]|None:
        return self._read_state(job_id)

    def artifact_path(self,job_id:str)->Path|None:
        state=self._read_state(job_id)
        if not state or state.get("status")!="ready":
            return None
        path=Path(state.get("outputPath",""))
        return path if path.is_file() else None

    def cancel(self,job_id:str)->bool:
        with self._lock:
            process=self._processes.get(job_id)
            if process and process.poll() is None:
                process.terminate()
            state=self._read_state(job_id)
            if not state:
                return False
            self._write_state(job_id,{**state,"status":"cancelled","qualityClaim":False})
            return True
