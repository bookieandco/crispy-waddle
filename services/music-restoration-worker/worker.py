"""Jhadina Music restoration compute primitives.

This module operates only on local files staged by the HTTP boundary. It does
not own authorization, credentials, storage, or source fetching.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any

DEFAULT_DEMUCS_MODEL="htdemucs"
DEMUCS_VERSION="4.0.1"
LOSSLESS_CODECS={"flac","alac","wavpack","pcm_s16le","pcm_s24le","pcm_s32le","pcm_f32le","pcm_f64le"}
REPAIR_OPERATIONS={"copy","gain","eq","declick","declip","denoise"}

@dataclass(frozen=True)
class RestorationWorkerConfig:
    output_dir:Path=Path("/data/music-restoration")
    demucs_model:str=DEFAULT_DEMUCS_MODEL

    @classmethod
    def from_env(cls)->"RestorationWorkerConfig":
        return cls(
            output_dir=Path(os.getenv("MUSIC_RESTORATION_OUTPUT_DIR","/data/music-restoration")),
            demucs_model=os.getenv("MUSIC_RESTORATION_DEMUCS_MODEL",DEFAULT_DEMUCS_MODEL).strip() or DEFAULT_DEMUCS_MODEL,
        )

def runtime_readiness(config:RestorationWorkerConfig)->dict[str,Any]:
    reasons=[]
    ffmpeg=shutil.which("ffmpeg")
    ffprobe=shutil.which("ffprobe")
    demucs_ready=importlib.util.find_spec("demucs") is not None
    librosa_ready=importlib.util.find_spec("librosa") is not None
    numpy_ready=importlib.util.find_spec("numpy") is not None
    if not ffmpeg: reasons.append("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    if not ffprobe: reasons.append("MUSIC_RESTORATION_FFPROBE_REQUIRED")
    if not demucs_ready: reasons.append("MUSIC_RESTORATION_DEMUCS_REQUIRED")
    if not librosa_ready or not numpy_ready: reasons.append("MUSIC_RESTORATION_PERCEPTION_RUNTIME_REQUIRED")
    try:
        config.output_dir.mkdir(parents=True,exist_ok=True)
        writable=os.access(config.output_dir,os.W_OK)
    except Exception:
        writable=False
    if not writable: reasons.append("MUSIC_RESTORATION_OUTPUT_DIR_NOT_WRITABLE")
    return {
        "productionReady":not reasons,
        "reasons":reasons,
        "ffmpegReady":bool(ffmpeg),
        "ffprobeReady":bool(ffprobe),
        "demucsReady":demucs_ready,
        "librosaReady":librosa_ready,
        "numpyReady":numpy_ready,
        "demucsModel":config.demucs_model,
        "demucsVersion":DEMUCS_VERSION,
        "outputDirWritable":writable,
    }

def _safe_token(value:str)->str:
    if not value.strip(): raise ValueError("MUSIC_RESTORATION_ID_REQUIRED")
    return sha256(value.strip().encode()).hexdigest()[:24]

def receipt_id(prefix:str,payload:dict[str,Any])->str:
    data=json.dumps(payload,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    return prefix+":"+sha256(data).hexdigest()

def probe_path(path:Path,source_artifact_id:str,source_sha256:str)->dict[str,Any]:
    ffprobe=shutil.which("ffprobe")
    if not ffprobe: raise RuntimeError("MUSIC_RESTORATION_FFPROBE_REQUIRED")
    output=subprocess.check_output([
        ffprobe,"-v","error","-select_streams","a:0",
        "-show_entries","stream=codec_name,sample_rate,channels,bits_per_sample,duration",
        "-show_entries","format=duration,format_name","-of","json",str(path),
    ],stderr=subprocess.STDOUT,timeout=60,text=True)
    parsed=json.loads(output)
    streams=parsed.get("streams") or []
    if not streams: raise ValueError("MUSIC_RESTORATION_AUDIO_STREAM_REQUIRED")
    stream=streams[0]
    codec=str(stream.get("codec_name") or "unknown")
    sample_rate=int(stream.get("sample_rate") or 0)
    channels=int(stream.get("channels") or 0)
    duration=float(stream.get("duration") or (parsed.get("format") or {}).get("duration") or 0)
    if sample_rate<=0 or channels<=0 or not math.isfinite(duration) or duration<=0:
        raise ValueError("MUSIC_RESTORATION_PROBE_INVALID")
    bit_depth_raw=stream.get("bits_per_sample")
    bit_depth=int(bit_depth_raw) if str(bit_depth_raw or "").isdigit() and int(bit_depth_raw)>0 else None
    payload={
        "sourceArtifactId":source_artifact_id,
        "sourceSha256":source_sha256.lower(),
        "codec":codec,
        "sampleRate":sample_rate,
        "channels":channels,
        "sampleCount":max(1,int(round(duration*sample_rate))),
        "durationSeconds":duration,
        "bitDepth":bit_depth,
        "lossless":codec in LOSSLESS_CODECS,
    }
    payload["runtimeReceiptId"]=receipt_id("music-probe",payload)
    return payload

def normalize_to_wav(source:Path,destination:Path,sample_rate:int,channels:int)->None:
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg: raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    result=subprocess.run([
        ffmpeg,"-nostdin","-v","error","-y","-i",str(source),"-map","0:a:0",
        "-c:a","pcm_s24le","-ar",str(sample_rate),"-ac",str(channels),str(destination),
    ],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=180,check=False)
    if result.returncode!=0 or not destination.is_file() or destination.stat().st_size<=0:
        raise RuntimeError("MUSIC_RESTORATION_NORMALIZE_FAILED:"+result.stderr.decode(errors="replace")[-500:])

def separate_path(
    source_path:Path,
    source_artifact_id:str,
    source_sha256:str,
    job_id:str,
    config:RestorationWorkerConfig,
    model_id:str|None=None,
)->dict[str,Any]:
    requested=(model_id or config.demucs_model).strip()
    if requested!=config.demucs_model: raise ValueError("MUSIC_RESTORATION_DEMUCS_MODEL_NOT_ADMITTED")
    probe=probe_path(source_path,source_artifact_id,source_sha256)
    directory=config.output_dir/("separate-"+_safe_token(job_id))
    directory.mkdir(parents=True,exist_ok=True)
    normalized=directory/"source.wav"
    normalize_to_wav(source_path,normalized,probe["sampleRate"],probe["channels"])
    demucs_out=directory/"demucs"
    result=subprocess.run([
        sys.executable,"-m","demucs.separate","-n",requested,"--out",str(demucs_out),str(normalized),
    ],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=3600,check=False)
    if result.returncode!=0:
        raise RuntimeError("MUSIC_RESTORATION_DEMUCS_FAILED:"+result.stdout.decode(errors="replace")[-1200:])
    stem_dir=demucs_out/requested/normalized.stem
    stems=[]
    for role in ("vocals","drums","bass","other"):
        raw=stem_dir/f"{role}.wav"
        if not raw.is_file(): raise RuntimeError(f"MUSIC_RESTORATION_DEMUCS_STEM_MISSING:{role}")
        output=directory/f"{role}.wav"
        normalize_to_wav(raw,output,probe["sampleRate"],probe["channels"])
        digest=sha256(output.read_bytes()).hexdigest()
        stem_probe=probe_path(output,f"{source_artifact_id}:{role}",digest)
        artifact_id=f"music-stem:{_safe_token(source_artifact_id)}:{role}:{digest[:16]}"
        stem={
            "artifactId":artifact_id,"parentArtifactId":source_artifact_id,"role":role,
            "sha256":digest,"sampleRate":stem_probe["sampleRate"],"channels":stem_probe["channels"],
            "sampleCount":stem_probe["sampleCount"],"durationSeconds":stem_probe["durationSeconds"],
            "modelId":requested,"modelVersion":DEMUCS_VERSION,"confidence":0.85,
            "resultUri":f"/v1/jobs/{_safe_token(job_id)}/artifact/{role}.wav",
        }
        stem["runtimeReceiptId"]=receipt_id("music-stem",stem)
        stems.append(stem)
    payload={
        "jobId":job_id,"sourceArtifactId":source_artifact_id,"sourceSha256":source_sha256.lower(),
        "modelId":requested,"modelVersion":DEMUCS_VERSION,"stems":stems,
    }
    payload["runtimeReceiptId"]=receipt_id("music-separation",payload)
    return payload

def _downbeat_frames(beat_frames:Any,onset_env:Any)->tuple[list[int],float]:
    import numpy as np
    frames=np.asarray(beat_frames,dtype=int)
    if frames.size<8: return [],0.0
    scores=[]
    for phase in range(4):
        values=frames[phase::4]
        values=values[(values>=0)&(values<len(onset_env))]
        scores.append(float(np.mean(onset_env[values])) if values.size else 0.0)
    phase=int(np.argmax(np.asarray(scores)))
    ordered=sorted(scores,reverse=True)
    margin=(ordered[0]-ordered[1])/(abs(ordered[0])+1e-9) if len(ordered)>1 else 0.0
    return frames[phase::4].tolist(),max(0.2,min(0.65,0.35+0.3*max(0.0,margin)))

def perceive_path(source_path:Path,source_artifact_id:str,source_sha256:str,role:str|None=None)->dict[str,Any]:
    import numpy as np
    import librosa
    if role is not None and role not in {"vocals","drums","bass","other","unknown"}:
        raise ValueError("MUSIC_RESTORATION_PERCEPTION_ROLE_INVALID")
    probe=probe_path(source_path,source_artifact_id,source_sha256)
    y,sr=librosa.load(str(source_path),sr=None,mono=True)
    if y.size<=0 or int(sr)!=probe["sampleRate"]: raise ValueError("MUSIC_RESTORATION_PERCEPTION_DECODE_INVALID")
    hop=512
    onset_env=librosa.onset.onset_strength(y=y,sr=sr,hop_length=hop)
    tempo_raw,beat_frames=librosa.beat.beat_track(onset_envelope=onset_env,sr=sr,hop_length=hop,units="frames")
    tempo=float(np.atleast_1d(tempo_raw)[0]) if np.size(tempo_raw) else 0.0
    beat_frames=np.asarray(beat_frames,dtype=int)
    beat_samples=[int(v) for v in librosa.frames_to_samples(beat_frames,hop_length=hop)]
    db_frames,db_conf=_downbeat_frames(beat_frames,onset_env)
    downbeats=[int(v) for v in librosa.frames_to_samples(np.asarray(db_frames),hop_length=hop)]
    onset_frames=np.asarray(librosa.onset.onset_detect(onset_envelope=onset_env,sr=sr,hop_length=hop,units="frames"),dtype=int)
    maximum=float(np.max(onset_env)) if onset_env.size else 0.0
    transients=[]
    for frame in onset_frames.tolist():
        if 0<=frame<len(onset_env):
            strength=float(onset_env[frame])
            transients.append({
                "sample":int(librosa.frames_to_samples(frame,hop_length=hop)),
                "strength":strength,
                "confidence":max(0.2,min(0.95,strength/(maximum+1e-9) if maximum>0 else 0.0)),
            })
    chroma=librosa.feature.chroma_cqt(y=y,sr=sr,hop_length=hop)
    duration=float(librosa.get_duration(y=y,sr=sr))
    count=max(1,min(12,int(round(duration/30.0))))
    boundaries=[0]
    if count>1 and chroma.shape[1]>=count:
        try: boundaries=sorted({0,*[int(v) for v in np.asarray(librosa.segment.agglomerative(chroma,k=count)).tolist()]})
        except Exception: boundaries=[0]
    final_frame=max(1,chroma.shape[1])
    if boundaries[-1]!=final_frame: boundaries.append(final_frame)
    sections=[]
    for index in range(len(boundaries)-1):
        start=int(librosa.frames_to_samples(boundaries[index],hop_length=hop))
        end=min(len(y),int(librosa.frames_to_samples(boundaries[index+1],hop_length=hop)))
        if end>start: sections.append({"startSample":start,"endSample":end,"label":f"section-{index+1}","confidence":0.55})
    centroid=librosa.feature.spectral_centroid(y=y,sr=sr)
    rms=librosa.feature.rms(y=y)
    vocal=None
    if role=="vocals":
        try:
            f0,voiced,_=librosa.pyin(y,fmin=float(librosa.note_to_hz("C2")),fmax=float(librosa.note_to_hz("C7")),sr=sr,hop_length=hop)
            finite=np.asarray(f0)[np.isfinite(f0)]
            vocal={
                "voicedFraction":float(np.mean(np.asarray(voiced,dtype=bool))) if np.size(voiced) else 0.0,
                "medianF0Hz":float(np.median(finite)) if finite.size else None,
                "minimumF0Hz":float(np.min(finite)) if finite.size else None,
                "maximumF0Hz":float(np.max(finite)) if finite.size else None,
                "confidence":0.75 if finite.size else 0.3,
            }
        except Exception: vocal={"voicedFraction":0.0,"confidence":0.2}
    payload={
        "sourceArtifactId":source_artifact_id,"sourceSha256":source_sha256.lower(),
        "sampleRate":int(sr),"sampleCount":int(len(y)),
        "tempoBpm":tempo if math.isfinite(tempo) and tempo>0 else None,
        "beatSamples":[v for v in beat_samples if 0<=v<len(y)],
        "downbeatSamples":[v for v in downbeats if 0<=v<len(y)],
        "sections":sections,"transients":transients,
        "spectralCentroidHz":float(np.mean(centroid)) if centroid.size else None,
        "rms":float(np.mean(rms)) if rms.size else None,
        "role":role,"vocal":vocal,
        "confidences":{"tempo":0.8 if tempo>0 else 0.0,"beat":0.8 if beat_samples else 0.0,"downbeat":db_conf,"section":0.55 if sections else 0.0},
        "providerId":"librosa","providerVersion":str(librosa.__version__),
    }
    payload["runtimeReceiptId"]=receipt_id("music-perception",payload)
    return payload

def build_repair_filter(operation:str,parameters:dict[str,Any])->str|None:
    if operation not in REPAIR_OPERATIONS: raise ValueError("MUSIC_RESTORATION_REPAIR_OPERATION_NOT_ADMITTED")
    if operation=="copy": return None
    if operation=="gain":
        gain=float(parameters.get("gainDb",parameters.get("db",0.0)))
        if not math.isfinite(gain) or abs(gain)>12: raise ValueError("MUSIC_RESTORATION_GAIN_OUT_OF_RANGE")
        return f"volume={gain:.6f}dB"
    if operation=="eq":
        frequency=float(parameters.get("frequencyHz",0.0)); gain=float(parameters.get("gainDb",0.0)); q=float(parameters.get("q",0.0))
        if not 20<=frequency<=22000 or not math.isfinite(gain) or abs(gain)>12 or not 0.1<=q<=20:
            raise ValueError("MUSIC_RESTORATION_EQ_PARAMETERS_INVALID")
        return f"equalizer=f={frequency:.6f}:width_type=q:width={q:.6f}:g={gain:.6f}"
    if operation=="declick": return "adeclick"
    if operation=="declip": return "adeclip"
    floor=float(parameters.get("noiseFloorDb",-50.0))
    if not math.isfinite(floor) or not -80<=floor<=-20: raise ValueError("MUSIC_RESTORATION_DENOISE_PARAMETERS_INVALID")
    return f"afftdn=nf={floor:.6f}"

def execute_repair_path(
    source_path:Path,source_artifact_id:str,source_sha256:str,execution_id:str,authorization_id:str,
    operation:str,parameters:dict[str,Any],sample_rate:int,channels:int,config:RestorationWorkerConfig,
)->dict[str,Any]:
    if not execution_id.strip() or not authorization_id.strip(): raise ValueError("MUSIC_RESTORATION_EXECUTION_AUTHORITY_REQUIRED")
    probe=probe_path(source_path,source_artifact_id,source_sha256)
    if probe["sampleRate"]!=sample_rate or probe["channels"]!=channels:
        raise ValueError("MUSIC_RESTORATION_EXECUTION_SOURCE_DIMENSIONS_MISMATCH")
    directory=config.output_dir/("repair-"+_safe_token(execution_id)); directory.mkdir(parents=True,exist_ok=True)
    output=directory/"output.wav"
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg: raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    graph=build_repair_filter(operation,parameters)
    args=[ffmpeg,"-nostdin","-v","error","-y","-i",str(source_path),"-map","0:a:0"]
    if graph: args.extend(["-af",graph])
    args.extend(["-c:a","pcm_s24le","-ar",str(sample_rate),"-ac",str(channels),str(output)])
    result=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=600,check=False)
    if result.returncode!=0 or not output.is_file() or output.stat().st_size<=0:
        raise RuntimeError("MUSIC_RESTORATION_REPAIR_FAILED:"+result.stderr.decode(errors="replace")[-800:])
    digest=sha256(output.read_bytes()).hexdigest()
    output_id=f"music-repair:{_safe_token(execution_id)}:{digest[:16]}"
    out_probe=probe_path(output,output_id,digest)
    payload={
        "executionId":execution_id,"sourceArtifactId":source_artifact_id,"outputArtifactId":output_id,
        "resultUri":f"/v1/jobs/{_safe_token(execution_id)}/artifact/output.wav","outputSha256":digest,
        "sampleRate":out_probe["sampleRate"],"channels":out_probe["channels"],"sampleCount":out_probe["sampleCount"],
        "durationSeconds":out_probe["durationSeconds"],"operation":operation,
    }
    payload["runtimeReceiptId"]=receipt_id("music-repair",payload)
    return payload

def artifact_path(config:RestorationWorkerConfig,job_token:str,name:str)->Path|None:
    if len(job_token)!=24 or any(ch not in "0123456789abcdef" for ch in job_token): return None
    if name not in {"vocals.wav","drums.wav","bass.wav","other.wav","output.wav"}: return None
    for prefix in ("separate","repair"):
        candidate=config.output_dir/f"{prefix}-{job_token}"/name
        if candidate.is_file() and candidate.stat().st_size>0: return candidate
    return None
