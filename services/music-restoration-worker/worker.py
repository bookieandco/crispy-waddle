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
    demucs_device:str="auto"

    @classmethod
    def from_env(cls)->"RestorationWorkerConfig":
        return cls(
            output_dir=Path(os.getenv("MUSIC_RESTORATION_OUTPUT_DIR","/data/music-restoration")),
            demucs_model=os.getenv("MUSIC_RESTORATION_DEMUCS_MODEL",DEFAULT_DEMUCS_MODEL).strip() or DEFAULT_DEMUCS_MODEL,
            demucs_device=os.getenv("MUSIC_RESTORATION_DEMUCS_DEVICE","auto").strip().lower() or "auto",
        )

def runtime_readiness(config:RestorationWorkerConfig)->dict[str,Any]:
    reasons=[]
    ffmpeg=shutil.which("ffmpeg")
    ffprobe=shutil.which("ffprobe")
    demucs_ready=importlib.util.find_spec("demucs") is not None
    torch_ready=importlib.util.find_spec("torch") is not None
    cuda_ready=False
    if torch_ready:
        try:
            import torch
            cuda_ready=bool(torch.cuda.is_available())
        except Exception:
            cuda_ready=False
    librosa_ready=importlib.util.find_spec("librosa") is not None
    numpy_ready=importlib.util.find_spec("numpy") is not None
    if not ffmpeg: reasons.append("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    if not ffprobe: reasons.append("MUSIC_RESTORATION_FFPROBE_REQUIRED")
    if not demucs_ready: reasons.append("MUSIC_RESTORATION_DEMUCS_REQUIRED")
    if config.demucs_device not in {"auto","cpu","cuda"}:
        reasons.append("MUSIC_RESTORATION_DEMUCS_DEVICE_INVALID")
    if config.demucs_device=="cuda" and not cuda_ready:
        reasons.append("MUSIC_RESTORATION_CUDA_REQUIRED")
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
        "torchReady":torch_ready,
        "cudaReady":cuda_ready,
        "demucsDevice":config.demucs_device,
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
    if config.demucs_device not in {"auto","cpu","cuda"}:
        raise ValueError("MUSIC_RESTORATION_DEMUCS_DEVICE_INVALID")
    probe=probe_path(source_path,source_artifact_id,source_sha256)
    directory=config.output_dir/("separate-"+_safe_token(job_id))
    directory.mkdir(parents=True,exist_ok=True)
    normalized=directory/"source.wav"
    normalize_to_wav(source_path,normalized,probe["sampleRate"],probe["channels"])
    demucs_out=directory/"demucs"
    result=subprocess.run([
        sys.executable,"-m","demucs.separate","-n",requested,"-d",config.demucs_device,
        "--out",str(demucs_out),str(normalized),
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

def _assessment_regions(
    y:Any,
    sr:int,
    regions:list[tuple[float,float]],
)->Any:
    import numpy as np
    pieces=[]
    total_ms=(len(y)/sr)*1000.0
    for start_ms,end_ms in regions:
        if not math.isfinite(start_ms) or not math.isfinite(end_ms) or start_ms<0 or end_ms<=start_ms:
            raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_REGION_INVALID")
        if end_ms>total_ms+2:
            raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_REGION_OUT_OF_RANGE")
        start=max(0,int(round(start_ms*sr/1000.0)))
        end=min(len(y),int(round(end_ms*sr/1000.0)))
        if end<=start:
            raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_REGION_EMPTY")
        pieces.append(y[start:end])
    if not pieces:
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_SEGMENTS_REQUIRED")
    merged=np.concatenate(pieces)
    if merged.size<max(256,int(sr*0.02)):
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_AUDIO_TOO_SHORT")
    return merged

def _instrument_audio_metrics(
    path:Path,
    family:str,
    regions:list[tuple[float,float]],
)->dict[str,Any]:
    import numpy as np
    import librosa

    y_native,sr=librosa.load(str(path),sr=None,mono=False)
    if np.size(y_native)<=0:
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_DECODE_INVALID")
    if np.ndim(y_native)==1:
        mono=np.asarray(y_native,dtype=float)
        stereo_width=None
    else:
        channels=np.asarray(y_native,dtype=float)
        mono=np.mean(channels,axis=0)
        if channels.shape[0]>=2:
            left=channels[0]; right=channels[1]
            mid=(left+right)*0.5
            side=(left-right)*0.5
            mid_energy=float(np.mean(mid*mid))+1e-12
            stereo_width=max(0.0,min(1.0,float(np.mean(side*side))/mid_energy))
        else:
            stereo_width=None

    selected=_assessment_regions(mono,int(sr),regions)
    n_fft=min(2048,max(256,2**int(math.floor(math.log2(max(256,min(len(selected),2048)))))))
    hop=max(64,n_fft//4)
    stft=np.abs(librosa.stft(selected,n_fft=n_fft,hop_length=hop))
    power=stft*stft
    freqs=librosa.fft_frequencies(sr=sr,n_fft=n_fft)
    total_energy=float(np.sum(power))+1e-12
    low=float(np.sum(power[freqs<250]))/total_energy
    mid=float(np.sum(power[(freqs>=250)&(freqs<4000)]))/total_energy
    high=max(0.0,1.0-low-mid)
    centroid=float(np.mean(librosa.feature.spectral_centroid(S=stft,sr=sr))) if stft.size else 0.0
    spread=float(np.mean(librosa.feature.spectral_bandwidth(S=stft,sr=sr))) if stft.size else 0.0

    onset=librosa.onset.onset_strength(y=selected,sr=sr,hop_length=hop)
    if onset.size:
        transient=float(np.percentile(onset,95)/(np.max(onset)+1e-12))
    else:
        transient=0.0

    harmonic=librosa.effects.harmonic(selected)
    harmonicity=max(0.0,min(1.0,float(np.mean(harmonic*harmonic))/(float(np.mean(selected*selected))+1e-12)))

    rms=np.asarray(librosa.feature.rms(y=selected,frame_length=n_fft,hop_length=hop)).reshape(-1)
    positive=rms[rms>1e-9]
    dynamic_range=0.0
    if positive.size>=2:
        p95=float(np.percentile(positive,95)); p10=float(np.percentile(positive,10))
        dynamic_range=max(0.0,20.0*math.log10((p95+1e-12)/(p10+1e-12)))

    peak=np.max(np.abs(selected)) if selected.size else 0.0
    clipping_ratio=float(np.mean(np.abs(selected)>=0.999)) if selected.size else 0.0
    median_rms=float(np.median(rms)) if rms.size else 0.0
    silence_threshold=max(1e-5,median_rms*0.08)
    dropout_ratio=float(np.mean(rms<=silence_threshold)) if rms.size else 1.0
    clipping_score=min(1.0,clipping_ratio*500.0)
    dropout_score=min(1.0,dropout_ratio)
    damage_score=max(clipping_score,dropout_score)
    quality_score=max(0.0,1.0-damage_score)

    fingerprint={
        "family":family,
        "spectralCentroidHz":max(0.0,centroid),
        "spectralSpreadHz":max(0.0,spread),
        "lowEnergyRatio":max(0.0,min(1.0,low)),
        "midEnergyRatio":max(0.0,min(1.0,mid)),
        "highEnergyRatio":max(0.0,min(1.0,high)),
        "transientStrength":max(0.0,min(1.0,transient)),
        "harmonicity":harmonicity,
        "dynamicRangeDb":dynamic_range,
    }
    if stereo_width is not None:
        fingerprint["stereoWidth"]=stereo_width

    return {
        "fingerprint":fingerprint,
        "damageScore":damage_score,
        "qualityScore":quality_score,
        "clippingRatio":clipping_ratio,
        "dropoutRatio":dropout_ratio,
        "durationMs":float(len(selected))*1000.0/float(sr),
        "peak":float(peak),
    }

def assess_instrument_replacement_path(
    source_path:Path,
    replacement_path:Path,
    source_artifact_id:str,
    source_sha256:str,
    replacement_artifact_id:str,
    replacement_sha256:str,
    assessment_id:str,
    instrument_family:str,
    segments:list[dict[str,Any]],
)->dict[str,Any]:
    if not assessment_id.strip():
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_ID_REQUIRED")
    if source_artifact_id==replacement_artifact_id:
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_SOURCE_DONOR_MUST_DIFFER")
    allowed_families={
        "acoustic-guitar","electric-guitar","piano","organ","strings","brass",
        "woodwinds","drums","bass","percussion","synth","unknown",
    }
    if instrument_family not in allowed_families:
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_FAMILY_INVALID")
    if not segments or len(segments)>64:
        raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_SEGMENT_COUNT_INVALID")

    source_regions=[]
    replacement_regions=[]
    for segment in segments:
        try:
            source_regions.append((float(segment["sourceStartMs"]),float(segment["sourceEndMs"])))
            replacement_regions.append((float(segment["replacementStartMs"]),float(segment["replacementEndMs"])))
        except (KeyError,TypeError,ValueError) as exc:
            raise ValueError("MUSIC_INSTRUMENT_ASSESSMENT_SEGMENT_INVALID") from exc

    source_metrics=_instrument_audio_metrics(source_path,instrument_family,source_regions)
    replacement_metrics=_instrument_audio_metrics(replacement_path,instrument_family,replacement_regions)
    expected_gain=max(0.0,min(
        1.0,
        source_metrics["damageScore"]-replacement_metrics["damageScore"],
    ))
    minimum_duration=min(source_metrics["durationMs"],replacement_metrics["durationMs"])
    duration_confidence=max(0.0,min(1.0,minimum_duration/250.0))
    damage_margin=max(0.0,source_metrics["damageScore"]-replacement_metrics["damageScore"])
    confidence=max(0.0,min(
        1.0,
        0.45+0.35*duration_confidence+0.20*min(1.0,damage_margin*2.0),
    ))
    if expected_gain<0.05:
        confidence=min(confidence,0.55)

    payload={
        "assessmentId":assessment_id,
        "sourceArtifactId":source_artifact_id,
        "replacementArtifactId":replacement_artifact_id,
        "sourceSha256":source_sha256.lower(),
        "replacementSha256":replacement_sha256.lower(),
        "instrumentFamily":instrument_family,
        "observedFingerprint":source_metrics["fingerprint"],
        "replacementFingerprint":replacement_metrics["fingerprint"],
        "gainEvidence":{
            "method":"runtime-region-integrity-delta-v1",
            "expectedGain":expected_gain,
            "confidence":confidence,
        },
        "diagnostics":{
            "sourceDamageScore":source_metrics["damageScore"],
            "replacementDamageScore":replacement_metrics["damageScore"],
            "sourceClippingRatio":source_metrics["clippingRatio"],
            "replacementClippingRatio":replacement_metrics["clippingRatio"],
            "sourceDropoutRatio":source_metrics["dropoutRatio"],
            "replacementDropoutRatio":replacement_metrics["dropoutRatio"],
            "sourceDurationMs":source_metrics["durationMs"],
            "replacementDurationMs":replacement_metrics["durationMs"],
        },
    }
    payload["runtimeReceiptId"]=receipt_id("music-instrument-assessment",payload)
    return payload

def _reconstruction_segment(segment:dict[str,Any],source_duration_ms:float,replacement_duration_ms:float)->dict[str,Any]:
    required=("targetStartMs","targetEndMs","replacementStartMs","replacementEndMs","gainDb","sourceResidualMix","fadeMs","phaseInvert")
    if any(key not in segment for key in required):
        raise ValueError("MUSIC_RECONSTRUCTION_SEGMENT_INCOMPLETE")
    target_start=float(segment["targetStartMs"]); target_end=float(segment["targetEndMs"])
    replacement_start=float(segment["replacementStartMs"]); replacement_end=float(segment["replacementEndMs"])
    gain_db=float(segment["gainDb"]); residual=float(segment["sourceResidualMix"]); fade_ms=float(segment["fadeMs"])
    phase_invert=bool(segment["phaseInvert"])
    values=(target_start,target_end,replacement_start,replacement_end,gain_db,residual,fade_ms)
    if any(not math.isfinite(value) for value in values):
        raise ValueError("MUSIC_RECONSTRUCTION_SEGMENT_NONFINITE")
    if target_start<0 or target_end<=target_start or target_end>source_duration_ms+2:
        raise ValueError("MUSIC_RECONSTRUCTION_TARGET_SEGMENT_INVALID")
    if replacement_start<0 or replacement_end<=replacement_start or replacement_end>replacement_duration_ms+2:
        raise ValueError("MUSIC_RECONSTRUCTION_DONOR_SEGMENT_INVALID")
    target_duration=target_end-target_start
    replacement_duration=replacement_end-replacement_start
    tempo=replacement_duration/target_duration
    if tempo<0.5 or tempo>2:
        raise ValueError("MUSIC_RECONSTRUCTION_TIME_FIT_OUT_OF_RANGE")
    if abs(gain_db)>12:
        raise ValueError("MUSIC_RECONSTRUCTION_GAIN_OUT_OF_RANGE")
    if residual<0 or residual>0.25:
        raise ValueError("MUSIC_RECONSTRUCTION_RESIDUAL_MIX_OUT_OF_RANGE")
    if fade_ms<0 or fade_ms>250 or fade_ms*2>=target_duration:
        raise ValueError("MUSIC_RECONSTRUCTION_FADE_OUT_OF_RANGE")
    return {
        "targetStartMs":target_start,"targetEndMs":target_end,
        "replacementStartMs":replacement_start,"replacementEndMs":replacement_end,
        "gainDb":gain_db,"sourceResidualMix":residual,"fadeMs":fade_ms,
        "phaseInvert":phase_invert,"tempo":tempo,
    }

def _source_envelope(segment:dict[str,Any])->str:
    start=segment["targetStartMs"]/1000.0
    end=segment["targetEndMs"]/1000.0
    fade=segment["fadeMs"]/1000.0
    residual=segment["sourceResidualMix"]
    if fade<=0:
        return f"if(between(t,{start:.9f},{end:.9f}),{residual:.9f},1)"
    first_end=start+fade
    last_start=end-fade
    return (
        f"if(between(t,{start:.9f},{first_end:.9f}),"
        f"1-(1-{residual:.9f})*(t-{start:.9f})/{fade:.9f},"
        f"if(between(t,{first_end:.9f},{last_start:.9f}),{residual:.9f},"
        f"if(between(t,{last_start:.9f},{end:.9f}),"
        f"{residual:.9f}+(1-{residual:.9f})*(t-{last_start:.9f})/{fade:.9f},1)))"
    )

def execute_reconstruction_path(
    source_path:Path,replacement_path:Path,
    source_artifact_id:str,source_sha256:str,replacement_artifact_id:str,replacement_sha256:str,
    job_id:str,request_id:str,authorization_id:str,segments:list[dict[str,Any]],
    sample_rate:int,channels:int,config:RestorationWorkerConfig,
)->dict[str,Any]:
    if not job_id.strip() or not request_id.strip() or not authorization_id.strip():
        raise ValueError("MUSIC_RECONSTRUCTION_AUTHORITY_REQUIRED")
    if source_artifact_id==replacement_artifact_id:
        raise ValueError("MUSIC_RECONSTRUCTION_SOURCE_DONOR_MUST_DIFFER")
    if not segments or len(segments)>64:
        raise ValueError("MUSIC_RECONSTRUCTION_SEGMENT_COUNT_INVALID")

    source_probe=probe_path(source_path,source_artifact_id,source_sha256)
    replacement_probe=probe_path(replacement_path,replacement_artifact_id,replacement_sha256)
    if source_probe["sampleRate"]!=sample_rate or source_probe["channels"]!=channels:
        raise ValueError("MUSIC_RECONSTRUCTION_SOURCE_DIMENSIONS_MISMATCH")

    normalized=[]
    previous_target_end=-1.0
    for raw in segments:
        segment=_reconstruction_segment(
            raw,
            float(source_probe["durationSeconds"])*1000.0,
            float(replacement_probe["durationSeconds"])*1000.0,
        )
        if segment["targetStartMs"]<previous_target_end:
            raise ValueError("MUSIC_RECONSTRUCTION_TARGET_SEGMENTS_OVERLAP")
        previous_target_end=segment["targetEndMs"]
        normalized.append(segment)

    directory=config.output_dir/("reconstruct-"+_safe_token(job_id))
    directory.mkdir(parents=True,exist_ok=True)
    donor=directory/"replacement.wav"
    normalize_to_wav(replacement_path,donor,sample_rate,channels)
    output=directory/"output.wav"

    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")

    filters=[]
    source_label="0:a"
    for index,segment in enumerate(normalized):
        next_label=f"source{index}"
        envelope=_source_envelope(segment)
        filters.append(f"[{source_label}]volume='{envelope}':eval=frame[{next_label}]")
        source_label=next_label

    replacement_labels=[]
    for index,segment in enumerate(normalized):
        target_duration=(segment["targetEndMs"]-segment["targetStartMs"])/1000.0
        donor_start=segment["replacementStartMs"]/1000.0
        donor_end=segment["replacementEndMs"]/1000.0
        fade=segment["fadeMs"]/1000.0
        chain=(
            f"[1:a]atrim=start={donor_start:.9f}:end={donor_end:.9f},"
            "asetpts=PTS-STARTPTS,"
            f"atempo={segment['tempo']:.9f},"
            f"atrim=duration={target_duration:.9f},"
            f"volume={segment['gainDb']:.6f}dB"
        )
        if segment["phaseInvert"]:
            chain+=",volume=-1"
        if fade>0:
            chain+=(
                f",afade=t=in:st=0:d={fade:.9f},"
                f"afade=t=out:st={max(0.0,target_duration-fade):.9f}:d={fade:.9f}"
            )
        chain+=f",adelay=delays={segment['targetStartMs']:.3f}:all=1[replacement{index}]"
        filters.append(chain)
        replacement_labels.append(f"[replacement{index}]")

    mix_inputs=f"[{source_label}]"+ "".join(replacement_labels)
    filters.append(
        f"{mix_inputs}amix=inputs={1+len(replacement_labels)}:normalize=0:dropout_transition=0,"
        f"atrim=duration={float(source_probe['durationSeconds']):.9f}[reconstructed]"
    )
    args=[
        ffmpeg,"-nostdin","-v","error","-y",
        "-i",str(source_path),"-i",str(donor),
        "-filter_complex",";".join(filters),
        "-map","[reconstructed]",
        "-c:a","pcm_s24le","-ar",str(sample_rate),"-ac",str(channels),str(output),
    ]
    result=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=900,check=False)
    if result.returncode!=0 or not output.is_file() or output.stat().st_size<=0:
        raise RuntimeError("MUSIC_RECONSTRUCTION_RENDER_FAILED:"+result.stderr.decode(errors="replace")[-1200:])

    digest=sha256(output.read_bytes()).hexdigest()
    output_id=f"music-reconstruction:{_safe_token(job_id)}:{digest[:16]}"
    out_probe=probe_path(output,output_id,digest)
    payload={
        "jobId":job_id,"requestId":request_id,
        "sourceArtifactId":source_artifact_id,"replacementArtifactId":replacement_artifact_id,
        "sourceSha256":source_sha256.lower(),"replacementSha256":replacement_sha256.lower(),
        "outputArtifactId":output_id,
        "resultUri":f"/v1/jobs/{_safe_token(job_id)}/artifact/output.wav",
        "outputSha256":digest,"sampleRate":out_probe["sampleRate"],"channels":out_probe["channels"],
        "sampleCount":out_probe["sampleCount"],"durationSeconds":out_probe["durationSeconds"],
        "segmentCount":len(normalized),
    }
    payload["runtimeReceiptId"]=receipt_id("music-reconstruction",payload)
    return payload

def artifact_path(config:RestorationWorkerConfig,job_token:str,name:str)->Path|None:
    if len(job_token)!=24 or any(ch not in "0123456789abcdef" for ch in job_token): return None
    if name not in {"vocals.wav","drums.wav","bass.wav","other.wav","output.wav"}: return None
    for prefix in ("separate","repair","reconstruct"):
        candidate=config.output_dir/f"{prefix}-{job_token}"/name
        if candidate.is_file() and candidate.stat().st_size>0: return candidate
    return None
