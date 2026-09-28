"""Private Phantom-Wan execution worker for Director.

This service executes already-authorized Director shot/take requests. It never
selects creative policy, approves output quality, or promotes a generated take.
"""
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

ALLOWED_MODELS={"phantom-wan-1.3b","phantom-wan-14b"}
ALLOWED_TASKS={"s2v-1.3B","s2v-14B"}
ALLOWED_SIZES={
    "phantom-wan-1.3b":{"832*480"},
    "phantom-wan-14b":{"832*480","1280*720"},
}
ALLOWED_FPS={16,24}
ALLOWED_SOLVERS={"unipc","dpm++"}
MAX_REFERENCES=4
MAX_SHOT_SECONDS=10


@dataclass(frozen=True)
class PhantomRuntimeConfig:
    repo_dir: Path
    wan_ckpt_dir: Path
    checkpoint_1_3b: Path
    checkpoint_14b: Path
    output_dir: Path
    model_version_1_3b: str
    model_version_14b: str

    @classmethod
    def from_env(cls)->"PhantomRuntimeConfig":
        required={
            "PHANTOM_REPO_DIR":os.getenv("PHANTOM_REPO_DIR",""),
            "PHANTOM_WAN_CKPT_DIR":os.getenv("PHANTOM_WAN_CKPT_DIR",""),
            "PHANTOM_CHECKPOINT_1_3B":os.getenv("PHANTOM_CHECKPOINT_1_3B",""),
            "PHANTOM_CHECKPOINT_14B":os.getenv("PHANTOM_CHECKPOINT_14B",""),
            "DIRECTOR_PHANTOM_OUTPUT_DIR":os.getenv("DIRECTOR_PHANTOM_OUTPUT_DIR",""),
        }
        missing=[key for key,value in required.items() if not value.strip()]
        if missing:
            raise ValueError("DIRECTOR_PHANTOM_RUNTIME_NOT_CONFIGURED:"+",".join(missing))
        return cls(
            repo_dir=Path(required["PHANTOM_REPO_DIR"]),
            wan_ckpt_dir=Path(required["PHANTOM_WAN_CKPT_DIR"]),
            checkpoint_1_3b=Path(required["PHANTOM_CHECKPOINT_1_3B"]),
            checkpoint_14b=Path(required["PHANTOM_CHECKPOINT_14B"]),
            output_dir=Path(required["DIRECTOR_PHANTOM_OUTPUT_DIR"]),
            model_version_1_3b=os.getenv("PHANTOM_MODEL_VERSION_1_3B","Phantom-Wan-1.3B"),
            model_version_14b=os.getenv("PHANTOM_MODEL_VERSION_14B","Phantom-Wan-14B"),
        )

    def production_ready(self)->bool:
        return (
            (self.repo_dir/"generate.py").is_file()
            and self.wan_ckpt_dir.exists()
            and self.checkpoint_1_3b.exists()
            and self.checkpoint_14b.exists()
        )


def _nonempty(body:dict[str,Any],key:str)->str:
    value=body.get(key)
    if not isinstance(value,str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value.strip()


def validate_request(request:dict[str,Any])->None:
    for key in ("requestId","projectId","prompt"):
        _nonempty(request,key)
    if request.get("authority")!="DIRECTOR_PHANTOM_REQUEST":
        raise ValueError("Director Phantom authority required")
    model=request.get("model")
    task=request.get("task")
    size=request.get("size")
    if model not in ALLOWED_MODELS:
        raise ValueError("invalid Phantom model")
    if task not in ALLOWED_TASKS:
        raise ValueError("invalid Phantom task")
    if (model=="phantom-wan-1.3b" and task!="s2v-1.3B") or (model=="phantom-wan-14b" and task!="s2v-14B"):
        raise ValueError("Phantom model/task mismatch")
    if size not in ALLOWED_SIZES[model]:
        raise ValueError("unsupported Phantom size")
    fps=request.get("fps")
    if fps not in ALLOWED_FPS:
        raise ValueError("invalid Phantom fps")
    frame_num=request.get("frameNum")
    if not isinstance(frame_num,int) or frame_num<5 or (frame_num-1)%4:
        raise ValueError("frameNum must be 4n+1")
    duration=(frame_num-1)/fps
    if duration>MAX_SHOT_SECONDS+1e-9:
        raise ValueError("Phantom shot exceeds Director maximum duration")
    seed=request.get("seed")
    if not isinstance(seed,int) or seed<0:
        raise ValueError("invalid Phantom seed")
    if request.get("sampleSolver") not in ALLOWED_SOLVERS:
        raise ValueError("invalid Phantom sample solver")
    if not isinstance(request.get("sampleSteps"),int) or request["sampleSteps"]<1:
        raise ValueError("invalid Phantom sample steps")
    for key in ("imageGuidanceScale","textGuidanceScale"):
        value=request.get(key)
        if not isinstance(value,(int,float)) or value<=0:
            raise ValueError(f"invalid {key}")
    refs=request.get("references")
    if not isinstance(refs,list) or not (1<=len(refs)<=MAX_REFERENCES):
        raise ValueError("Phantom references must contain 1-4 images")
    for index,ref in enumerate(refs):
        if not isinstance(ref,dict):
            raise ValueError(f"reference {index} must be an object")
        for key in ("id","assetId","uri","sha256","description"):
            _nonempty(ref,key)
        digest=ref["sha256"]
        if len(digest)!=64 or any(ch not in "0123456789abcdefABCDEF" for ch in digest):
            raise ValueError(f"reference {index} sha256 invalid")
        evidence=ref.get("evidenceIds")
        if not isinstance(evidence,list) or not evidence:
            raise ValueError(f"reference {index} evidence required")


def provider_job_id(idempotency_key:str,request_id:str)->str:
    if not idempotency_key.strip():
        raise ValueError("idempotency key required")
    return "phantom-"+sha256(f"{idempotency_key}|{request_id}".encode()).hexdigest()[:24]


def _checkpoint(config:PhantomRuntimeConfig,model:str)->Path:
    return config.checkpoint_14b if model=="phantom-wan-14b" else config.checkpoint_1_3b


def _model_version(config:PhantomRuntimeConfig,model:str)->str:
    return config.model_version_14b if model=="phantom-wan-14b" else config.model_version_1_3b


def build_cli_arguments(
    request:dict[str,Any],
    config:PhantomRuntimeConfig,
    reference_paths:list[Path],
    output_path:Path,
)->list[str]:
    validate_request(request)
    if len(reference_paths)!=len(request["references"]):
        raise ValueError("runtime reference count mismatch")
    return [
        sys.executable,
        str(config.repo_dir/"generate.py"),
        "--task",request["task"],
        "--size",request["size"],
        "--frame_num",str(request["frameNum"]),
        "--sample_fps",str(request["fps"]),
        "--ckpt_dir",str(config.wan_ckpt_dir),
        "--phantom_ckpt",str(_checkpoint(config,request["model"])),
        "--ref_image",",".join(str(path) for path in reference_paths),
        "--prompt",request["prompt"],
        "--base_seed",str(request["seed"]),
        "--sample_solver",request["sampleSolver"],
        "--sample_steps",str(request["sampleSteps"]),
        "--sample_guide_scale_img",str(request["imageGuidanceScale"]),
        "--sample_guide_scale_text",str(request["textGuidanceScale"]),
        "--save_file",str(output_path),
    ]


def _download_verified(uri:str,expected_sha256:str,destination:Path)->None:
    request=urllib.request.Request(uri,headers={"User-Agent":"jhadina-director-phantom/1"})
    with urllib.request.urlopen(request,timeout=60) as response:
        data=response.read()
    actual=sha256(data).hexdigest()
    if actual.lower()!=expected_sha256.lower():
        raise ValueError("DIRECTOR_PHANTOM_REFERENCE_HASH_MISMATCH")
    destination.write_bytes(data)


class PhantomJobManager:
    def __init__(self,config:PhantomRuntimeConfig):
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
        job_dir=self._job_dir(job_id)
        job_dir.mkdir(parents=True,exist_ok=True)
        tmp=job_dir/"state.json.tmp"
        tmp.write_text(json.dumps(state,sort_keys=True))
        tmp.replace(self._state_path(job_id))

    def submit(self,request:dict[str,Any],idempotency_key:str)->dict[str,Any]:
        validate_request(request)
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
                "modelVersion":_model_version(self.config,request["model"]),
                "qualityClaim":False,
            }
            self._write_state(job_id,state)
            thread=threading.Thread(target=self._run,args=(job_id,request),daemon=True)
            thread.start()
        return state

    def _run(self,job_id:str,request:dict[str,Any])->None:
        job_dir=self._job_dir(job_id)
        try:
            self._write_state(job_id,{
                **(self._read_state(job_id) or {}),
                "status":"processing",
            })
            refs_dir=job_dir/"references"
            refs_dir.mkdir(parents=True,exist_ok=True)
            paths:list[Path]=[]
            for index,ref in enumerate(request["references"]):
                path=refs_dir/f"{index:02d}-{ref['sha256'][:16]}.png"
                _download_verified(ref["uri"],ref["sha256"],path)
                paths.append(path)
            output=job_dir/"output.mp4"
            args=build_cli_arguments(request,self.config,paths,output)
            process=subprocess.Popen(args,cwd=self.config.repo_dir,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            with self._lock:
                self._processes[job_id]=process
            stdout,_=process.communicate()
            with self._lock:
                self._processes.pop(job_id,None)
            if process.returncode!=0:
                raise RuntimeError("DIRECTOR_PHANTOM_INFERENCE_FAILED:"+stdout.decode(errors="replace")[-4000:])
            if not output.is_file() or output.stat().st_size<=0:
                raise RuntimeError("DIRECTOR_PHANTOM_OUTPUT_MISSING")
            output_sha=sha256(output.read_bytes()).hexdigest()
            receipt_payload={
                "providerJobId":job_id,
                "requestId":request["requestId"],
                "projectId":request["projectId"],
                "model":request["model"],
                "modelVersion":_model_version(self.config,request["model"]),
                "seed":request["seed"],
                "frameNum":request["frameNum"],
                "fps":request["fps"],
                "referenceSha256s":[ref["sha256"] for ref in request["references"]],
                "outputSha256":output_sha,
            }
            receipt="phantom-runtime:"+sha256(json.dumps(receipt_payload,sort_keys=True).encode()).hexdigest()
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
