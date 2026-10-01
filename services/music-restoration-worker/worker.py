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

from source_recovery import analyze_source_recovery_audio, execute_source_recovery_operation

DEFAULT_DEMUCS_MODEL="htdemucs"
DEMUCS_VERSION="4.0.1"
LOSSLESS_CODECS={"flac","alac","wavpack","pcm_s16le","pcm_s24le","pcm_s32le","pcm_f32le","pcm_f64le"}
REPAIR_OPERATIONS={"copy","gain","eq","declick","declip","denoise","dehum","spectral-repair","mid-side-repair","dereverb","spectral-recovery"}

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
    soundfile_ready=importlib.util.find_spec("soundfile") is not None
    if not ffmpeg: reasons.append("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    if not ffprobe: reasons.append("MUSIC_RESTORATION_FFPROBE_REQUIRED")
    if not demucs_ready: reasons.append("MUSIC_RESTORATION_DEMUCS_REQUIRED")
    if config.demucs_device not in {"auto","cpu","cuda"}:
        reasons.append("MUSIC_RESTORATION_DEMUCS_DEVICE_INVALID")
    if config.demucs_device=="cuda" and not cuda_ready:
        reasons.append("MUSIC_RESTORATION_CUDA_REQUIRED")
    if not librosa_ready or not numpy_ready: reasons.append("MUSIC_RESTORATION_PERCEPTION_RUNTIME_REQUIRED")
    if not soundfile_ready: reasons.append("MUSIC_RESTORATION_SPECTRAL_REPAIR_RUNTIME_REQUIRED")
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
        "soundfileReady":soundfile_ready,
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

def analyze_source_recovery_path(
    source_path:Path,
    source_artifact_id:str,
    source_sha256:str,
)->dict[str,Any]:
    probe=probe_path(source_path,source_artifact_id,source_sha256)
    analysis=analyze_source_recovery_audio(source_path)
    payload={
        "sourceArtifactId":source_artifact_id,
        "sourceSha256":source_sha256.lower(),
        "sampleRate":probe["sampleRate"],
        "channels":probe["channels"],
        "sampleCount":probe["sampleCount"],
        "durationSeconds":probe["durationSeconds"],
        **analysis,
        "providerId":"jhadina-source-recovery-deterministic",
        "providerVersion":"1.0.0",
    }
    payload["runtimeReceiptId"]=receipt_id("music-source-recovery-analysis",payload)
    return payload

def _analysis_region(y:Any,sr:int,start_ms:float|None,end_ms:float|None,label:str)->Any:
    import numpy as np
    start=0 if start_ms is None else int(round(float(start_ms)*sr/1000.0))
    end=len(y) if end_ms is None else int(round(float(end_ms)*sr/1000.0))
    if start<0 or end<=start or end>len(y):
        raise ValueError(f"MUSIC_RESTORATION_{label}_REGION_INVALID")
    selected=np.asarray(y[start:end],dtype=float)
    if selected.size<max(256,int(sr*0.04)):
        raise ValueError(f"MUSIC_RESTORATION_{label}_REGION_TOO_SHORT")
    return selected

def learn_noise_profile_path(path:Path,start_ms:float,end_ms:float)->dict[str,Any]:
    import numpy as np
    import librosa
    y,sr=librosa.load(str(path),sr=None,mono=True)
    selected=_analysis_region(y,int(sr),start_ms,end_ms,"NOISE_PROFILE")
    frame_length=2048 if selected.size>=2048 else 512
    hop=max(128,frame_length//4)
    rms=np.asarray(librosa.feature.rms(y=selected,frame_length=frame_length,hop_length=hop)).reshape(-1)
    median=float(np.median(rms)) if rms.size else 0.0
    mean=float(np.mean(rms)) if rms.size else 0.0
    spread=float(np.std(rms)) if rms.size else 0.0
    floor_db=max(-80.0,min(-20.0,20.0*math.log10(max(median,1e-8))))
    stationarity=max(0.0,min(1.0,1.0-spread/(mean+1e-9)))
    flatness_values=np.asarray(librosa.feature.spectral_flatness(y=selected,n_fft=frame_length,hop_length=hop)).reshape(-1)
    flatness=max(0.0,min(1.0,float(np.mean(flatness_values)) if flatness_values.size else 0.0))
    confidence=max(0.0,min(1.0,0.35+0.45*stationarity+0.20*flatness))
    spectrum=np.abs(np.fft.rfft(selected*np.hanning(selected.size)))
    freqs=np.fft.rfftfreq(selected.size,d=1.0/float(sr))
    total=float(np.sum(spectrum*spectrum))+1e-12
    low=float(np.sum((spectrum[freqs<250])**2))/total
    mid=float(np.sum((spectrum[(freqs>=250)&(freqs<4000)])**2))/total
    high=max(0.0,1.0-low-mid)
    return {
        "noiseFloorDb":floor_db,
        "stationarity":stationarity,
        "spectralFlatness":flatness,
        "confidence":confidence,
        "lowEnergyRatio":low,
        "midEnergyRatio":mid,
        "highEnergyRatio":high,
        "profileStartMs":float(start_ms),
        "profileEndMs":float(end_ms),
    }

def learn_hum_profile_path(path:Path,start_ms:float,end_ms:float,max_harmonics:int=4)->dict[str,Any]:
    import numpy as np
    import librosa
    y,sr=librosa.load(str(path),sr=None,mono=True)
    selected=_analysis_region(y,int(sr),start_ms,end_ms,"HUM_PROFILE")
    window=np.hanning(selected.size)
    spectrum=np.abs(np.fft.rfft(selected*window))+1e-12
    freqs=np.fft.rfftfreq(selected.size,d=1.0/float(sr))
    candidate_indices=np.where((freqs>=45.0)&(freqs<=65.0))[0]
    if candidate_indices.size==0:
        raise ValueError("MUSIC_RESTORATION_HUM_PROFILE_RESOLUTION_INSUFFICIENT")
    median=float(np.median(spectrum[(freqs>=40)&(freqs<=300)]))+1e-12
    best_index=int(candidate_indices[0]); best_score=-1.0
    for index in candidate_indices.tolist():
        fundamental=float(freqs[index])
        score=0.0
        for harmonic in range(1,max(1,max_harmonics)+1):
            target=fundamental*harmonic
            if target>=sr/2: break
            hidx=int(np.argmin(np.abs(freqs-target)))
            score+=float(spectrum[hidx])/(median*harmonic)
        if score>best_score:
            best_score=score; best_index=int(index)
    fundamental=float(freqs[best_index])
    harmonics=[]
    harmonic_energy=0.0
    for harmonic in range(1,max(1,max_harmonics)+1):
        target=fundamental*harmonic
        if target>=sr/2: break
        hidx=int(np.argmin(np.abs(freqs-target)))
        ratio=float(spectrum[hidx])/median
        harmonic_energy+=max(0.0,ratio-1.0)
        harmonics.append((float(freqs[hidx]),ratio))
    confidence=max(0.0,min(1.0,harmonic_energy/(harmonic_energy+12.0)))
    return {
        "fundamentalHz":fundamental,
        "harmonicCount":len(harmonics),
        "confidence":confidence,
        "analysisStartMs":float(start_ms),
        "analysisEndMs":float(end_ms),
        "strongestHarmonicRatio":max((ratio for _,ratio in harmonics),default=0.0),
    }

def classify_impulse_region_path(path:Path,start_ms:float,end_ms:float)->dict[str,Any]:
    import numpy as np
    import librosa
    y,sr=librosa.load(str(path),sr=None,mono=True)
    selected=_analysis_region(y,int(sr),start_ms,end_ms,"IMPULSE")
    derivative=np.abs(np.diff(selected,prepend=selected[0]))
    median=float(np.median(derivative))+1e-12
    mad=float(np.median(np.abs(derivative-median)))+1e-12
    threshold=median+8.0*mad
    hot=np.where(derivative>=threshold)[0]
    event_count=0; previous=-999999
    minimum_gap=max(1,int(sr*0.0015))
    for index in hot.tolist():
        if index-previous>=minimum_gap: event_count+=1
        previous=index
    spectrum=np.abs(np.fft.rfft(selected*np.hanning(selected.size)))
    freqs=np.fft.rfftfreq(selected.size,d=1.0/float(sr))
    power=spectrum*spectrum
    total=float(np.sum(power))+1e-12
    centroid=float(np.sum(freqs*power)/total)
    low=float(np.sum(power[freqs<1000]))/total
    duration_ms=float(selected.size)*1000.0/float(sr)
    peak_ratio=float(np.max(derivative))/(median+mad)
    if event_count>=6:
        kind="crackle"; confidence=min(0.95,0.65+event_count/40.0)
    elif duration_ms<=30 and low>=0.65:
        kind="thump"; confidence=min(0.95,0.65+0.3*low)
    elif duration_ms<=10 and peak_ratio>=18 and centroid>=2500:
        kind="digital-discontinuity"; confidence=min(0.95,0.7+(peak_ratio-18)/50.0)
    elif duration_ms<=12:
        kind="click"; confidence=0.78
    elif duration_ms<=80:
        kind="pop"; confidence=0.70
    else:
        kind="unknown"; confidence=0.35
    return {
        "impulseType":kind,
        "impulseConfidence":float(confidence),
        "impulseEventCount":int(event_count),
        "impulseSpectralCentroidHz":centroid,
        "impulseLowEnergyRatio":low,
        "impulsePeakDerivativeRatio":peak_ratio,
    }

def _spectral_repair_file(source_path:Path,output:Path,parameters:dict[str,Any],sample_rate:int,channels:int)->dict[str,Any]:
    import numpy as np
    import librosa
    import soundfile as sf
    start_ms=float(parameters.get("startMs",-1))
    end_ms=float(parameters.get("endMs",-1))
    low_hz=float(parameters.get("lowHz",0.0))
    high_hz=float(parameters.get("highHz",sample_rate/2.0))
    before_ms=float(parameters.get("beforeContextMs",250.0))
    after_ms=float(parameters.get("afterContextMs",250.0))
    before_weight=float(parameters.get("beforeWeight",0.5))
    strength=float(parameters.get("strength",1.0))
    n_fft=int(parameters.get("fftSize",2048))
    if start_ms<0 or end_ms<=start_ms or low_hz<0 or high_hz<=low_hz or high_hz>sample_rate/2.0+1:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_REGION_INVALID")
    if before_ms<10 or before_ms>2000 or after_ms<10 or after_ms>2000:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_CONTEXT_INVALID")
    if not 0<=before_weight<=1 or not 0<strength<=1:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_WEIGHT_INVALID")
    if n_fft<256 or n_fft>8192 or n_fft&(n_fft-1):
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_FFT_INVALID")
    y,sr=librosa.load(str(source_path),sr=None,mono=False)
    if int(sr)!=sample_rate:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_RATE_MISMATCH")
    matrix=np.asarray(y,dtype=np.float32)
    if matrix.ndim==1: matrix=matrix[np.newaxis,:]
    if matrix.shape[0]!=channels:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_CHANNEL_MISMATCH")
    start_sample=int(round(start_ms*sr/1000.0)); end_sample=int(round(end_ms*sr/1000.0))
    if end_sample>matrix.shape[1]:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_REGION_OUT_OF_RANGE")
    hop=n_fft//4
    repaired=np.zeros_like(matrix)
    target_frame_count=0
    for channel_index in range(matrix.shape[0]):
        source=np.asarray(matrix[channel_index],dtype=float)
        spec=librosa.stft(source,n_fft=n_fft,hop_length=hop,window="hann",center=True)
        frame_samples=np.arange(spec.shape[1])*hop
        target=np.where((frame_samples>=start_sample)&(frame_samples<end_sample))[0]
        before=np.where((frame_samples>=max(0,start_sample-int(before_ms*sr/1000.0)))&(frame_samples<start_sample))[0]
        after=np.where((frame_samples>=end_sample)&(frame_samples<min(matrix.shape[1],end_sample+int(after_ms*sr/1000.0))))[0]
        if target.size==0 or (before.size==0 and after.size==0):
            raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_DONOR_CONTEXT_MISSING")
        freqs=librosa.fft_frequencies(sr=sr,n_fft=n_fft)
        bins=np.where((freqs>=low_hz)&(freqs<=high_hz))[0]
        if bins.size==0:
            raise ValueError("MUSIC_RESTORATION_SPECTRAL_REPAIR_BAND_EMPTY")
        target_frame_count=max(target_frame_count,int(target.size))
        for position,frame in enumerate(target.tolist()):
            bframe=int(before[max(0,before.size-target.size+position)]) if before.size else None
            aframe=int(after[min(position,after.size-1)]) if after.size else None
            if bframe is None: donor=spec[bins,aframe]
            elif aframe is None: donor=spec[bins,bframe]
            else: donor=before_weight*spec[bins,bframe]+(1.0-before_weight)*spec[bins,aframe]
            spec[bins,frame]=(1.0-strength)*spec[bins,frame]+strength*donor
        repaired[channel_index]=librosa.istft(spec,hop_length=hop,window="hann",center=True,length=source.size).astype(np.float32)
    temp=output.with_suffix(".float.wav")
    sf.write(str(temp),repaired.T,int(sr),subtype="FLOAT")
    try:
        normalize_to_wav(temp,output,sample_rate,channels)
    finally:
        temp.unlink(missing_ok=True)
    return {
        "spectralRepairStartMs":start_ms,
        "spectralRepairEndMs":end_ms,
        "spectralRepairLowHz":low_hz,
        "spectralRepairHighHz":high_hz,
        "spectralRepairBeforeWeight":before_weight,
        "spectralRepairStrength":strength,
        "spectralRepairFftSize":n_fft,
        "spectralRepairTargetFrames":target_frame_count,
    }

def build_repair_filter(operation:str,parameters:dict[str,Any])->str|None:
    if operation not in REPAIR_OPERATIONS: raise ValueError("MUSIC_RESTORATION_REPAIR_OPERATION_NOT_ADMITTED")
    if operation=="copy" or operation in {"spectral-repair","mid-side-repair","dereverb","spectral-recovery"}: return None
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
    if operation=="dehum":
        fundamental=float(parameters.get("fundamentalHz",0.0))
        harmonics=int(parameters.get("harmonics",4))
        q=float(parameters.get("q",30.0))
        reduction=float(parameters.get("reductionDb",30.0))
        highpass=float(parameters.get("highpassHz",0.0))
        if not 40<=fundamental<=1000 or harmonics<1 or harmonics>8 or not 1<=q<=100 or not 6<=reduction<=80:
            raise ValueError("MUSIC_RESTORATION_DEHUM_PARAMETERS_INVALID")
        filters=[]
        if highpass:
            if highpass<10 or highpass>120: raise ValueError("MUSIC_RESTORATION_DEHUM_HIGHPASS_INVALID")
            filters.append(f"highpass=f={highpass:.6f}")
        for harmonic in range(1,harmonics+1):
            frequency=fundamental*harmonic
            if frequency>20000: break
            filters.append(f"equalizer=f={frequency:.6f}:width_type=q:width={q:.6f}:g={-reduction:.6f}")
        return ",".join(filters)
    floor=float(parameters.get("noiseFloorDb",-50.0))
    reduction=float(parameters.get("noiseReductionDb",12.0))
    if not math.isfinite(floor) or not -80<=floor<=-20 or not 0<=reduction<=30:
        raise ValueError("MUSIC_RESTORATION_DENOISE_PARAMETERS_INVALID")
    return f"afftdn=nf={floor:.6f}:nr={reduction:.6f}"

def execute_repair_path(
    source_path:Path,source_artifact_id:str,source_sha256:str,execution_id:str,authorization_id:str,
    operation:str,parameters:dict[str,Any],sample_rate:int,channels:int,config:RestorationWorkerConfig,
)->dict[str,Any]:
    if not execution_id.strip() or not authorization_id.strip(): raise ValueError("MUSIC_RESTORATION_EXECUTION_AUTHORITY_REQUIRED")
    probe=probe_path(source_path,source_artifact_id,source_sha256)
    if probe["sampleRate"]!=sample_rate or probe["channels"]!=channels:
        raise ValueError("MUSIC_RESTORATION_EXECUTION_SOURCE_DIMENSIONS_MISMATCH")
    if operation not in REPAIR_OPERATIONS:
        raise ValueError("MUSIC_RESTORATION_REPAIR_OPERATION_NOT_ADMITTED")
    directory=config.output_dir/("repair-"+_safe_token(execution_id)); directory.mkdir(parents=True,exist_ok=True)
    output=directory/"output.wav"
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg: raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    resolved=dict(parameters)
    diagnostics:dict[str,Any]={}

    if operation=="denoise" and "noiseProfileStartMs" in resolved and "noiseProfileEndMs" in resolved:
        learned=learn_noise_profile_path(source_path,float(resolved["noiseProfileStartMs"]),float(resolved["noiseProfileEndMs"]))
        if learned["confidence"]<0.5:
            raise ValueError("MUSIC_RESTORATION_NOISE_PROFILE_CONFIDENCE_INSUFFICIENT")
        resolved["noiseFloorDb"]=learned["noiseFloorDb"]
        diagnostics.update({
            "noiseProfileConfidence":learned["confidence"],
            "noiseProfileFloorDb":learned["noiseFloorDb"],
            "noiseProfileStationarity":learned["stationarity"],
            "noiseProfileSpectralFlatness":learned["spectralFlatness"],
        })
    elif operation=="dehum":
        if "fundamentalHz" not in resolved:
            if "analysisStartMs" not in resolved or "analysisEndMs" not in resolved:
                raise ValueError("MUSIC_RESTORATION_DEHUM_ANALYSIS_REGION_REQUIRED")
            learned=learn_hum_profile_path(
                source_path,float(resolved["analysisStartMs"]),float(resolved["analysisEndMs"]),
                int(resolved.get("harmonics",4)),
            )
            if learned["confidence"]<0.35:
                raise ValueError("MUSIC_RESTORATION_HUM_PROFILE_CONFIDENCE_INSUFFICIENT")
            resolved["fundamentalHz"]=learned["fundamentalHz"]
            diagnostics.update({
                "humProfileConfidence":learned["confidence"],
                "humFundamentalHz":learned["fundamentalHz"],
                "humStrongestHarmonicRatio":learned["strongestHarmonicRatio"],
            })
    elif operation=="declick" and "startMs" in resolved and "endMs" in resolved:
        diagnostics.update(classify_impulse_region_path(source_path,float(resolved["startMs"]),float(resolved["endMs"])))

    if operation=="spectral-repair":
        diagnostics.update(_spectral_repair_file(source_path,output,resolved,sample_rate,channels))
    elif operation in {"mid-side-repair","dereverb","spectral-recovery"}:
        diagnostics.update(execute_source_recovery_operation(
            source_path,output,operation,resolved,sample_rate,channels,
        ))
    else:
        graph=build_repair_filter(operation,resolved)
        args=[ffmpeg,"-nostdin","-v","error","-y","-i",str(source_path),"-map","0:a:0"]
        if graph: args.extend(["-af",graph])
        args.extend(["-c:a","pcm_s24le","-ar",str(sample_rate),"-ac",str(channels),str(output)])
        result=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=600,check=False)
        if result.returncode!=0 or not output.is_file() or output.stat().st_size<=0:
            raise RuntimeError("MUSIC_RESTORATION_REPAIR_FAILED:"+result.stderr.decode(errors="replace")[-800:])

    if not output.is_file() or output.stat().st_size<=0:
        raise RuntimeError("MUSIC_RESTORATION_REPAIR_OUTPUT_MISSING")
    digest=sha256(output.read_bytes()).hexdigest()
    output_id=f"music-repair:{_safe_token(execution_id)}:{digest[:16]}"
    out_probe=probe_path(output,output_id,digest)
    payload={
        "executionId":execution_id,"sourceArtifactId":source_artifact_id,"outputArtifactId":output_id,
        "resultUri":f"/v1/jobs/{_safe_token(execution_id)}/artifact/output.wav","outputSha256":digest,
        "sampleRate":out_probe["sampleRate"],"channels":out_probe["channels"],"sampleCount":out_probe["sampleCount"],
        "durationSeconds":out_probe["durationSeconds"],"operation":operation,
        "diagnostics":diagnostics,
    }
    payload["runtimeReceiptId"]=receipt_id("music-repair",payload)
    return payload

def _vocal_repair_segment(segment:dict[str,Any],source_duration_ms:float)->dict[str,Any]:
    required=("startMs","endMs","operation","parameters","sourceResidualMix","fadeMs")
    if any(key not in segment for key in required):
        raise ValueError("MUSIC_VOCAL_RESTORATION_SEGMENT_INCOMPLETE")
    start=float(segment["startMs"]); end=float(segment["endMs"])
    residual=float(segment["sourceResidualMix"]); fade_ms=float(segment["fadeMs"])
    operation=str(segment["operation"])
    parameters=dict(segment["parameters"])
    values=(start,end,residual,fade_ms)
    if any(not math.isfinite(value) for value in values):
        raise ValueError("MUSIC_VOCAL_RESTORATION_SEGMENT_NONFINITE")
    if start<0 or end<=start or end>source_duration_ms+2:
        raise ValueError("MUSIC_VOCAL_RESTORATION_SEGMENT_OUT_OF_RANGE")
    duration=end-start
    if duration<20:
        raise ValueError("MUSIC_VOCAL_RESTORATION_SEGMENT_TOO_SHORT")
    if operation not in {"denoise","declick","declip","eq","gain"}:
        raise ValueError("MUSIC_VOCAL_RESTORATION_OPERATION_NOT_ADMITTED")
    if residual<0 or residual>0.25:
        raise ValueError("MUSIC_VOCAL_RESTORATION_RESIDUAL_OUT_OF_RANGE")
    if fade_ms<0 or fade_ms>100 or fade_ms*2>=duration:
        raise ValueError("MUSIC_VOCAL_RESTORATION_FADE_OUT_OF_RANGE")

    # Reuse the canonical repair-filter validator, then apply stricter vocal
    # limits so archival voice repair cannot become broad creative processing.
    graph=build_repair_filter(operation,parameters)
    if operation=="gain":
        gain=float(parameters.get("gainDb",parameters.get("db",0.0)))
        if abs(gain)>6:
            raise ValueError("MUSIC_VOCAL_RESTORATION_GAIN_OUT_OF_RANGE")
    elif operation=="eq":
        frequency=float(parameters.get("frequencyHz",0.0))
        gain=float(parameters.get("gainDb",0.0))
        q=float(parameters.get("q",0.0))
        if frequency<80 or frequency>16000 or abs(gain)>6 or q<0.2 or q>10:
            raise ValueError("MUSIC_VOCAL_RESTORATION_EQ_OUT_OF_RANGE")
    elif operation=="denoise":
        floor=float(parameters.get("noiseFloorDb",-55.0))
        if floor<-70 or floor>-30:
            raise ValueError("MUSIC_VOCAL_RESTORATION_DENOISE_OUT_OF_RANGE")

    return {
        "startMs":start,"endMs":end,"operation":operation,"parameters":parameters,
        "sourceResidualMix":residual,"fadeMs":fade_ms,"filterGraph":graph,
    }

def _vocal_region_metrics(path:Path,regions:list[tuple[float,float]])->dict[str,Any]:
    import numpy as np
    import librosa

    y,sr=librosa.load(str(path),sr=None,mono=True)
    if np.size(y)<=0:
        raise ValueError("MUSIC_VOCAL_RESTORATION_DECODE_INVALID")
    total_ms=(len(y)/float(sr))*1000.0
    pieces=[]
    for start_ms,end_ms in regions:
        if not math.isfinite(start_ms) or not math.isfinite(end_ms) or start_ms<0 or end_ms<=start_ms:
            raise ValueError("MUSIC_VOCAL_RESTORATION_REGION_INVALID")
        if end_ms>total_ms+2:
            raise ValueError("MUSIC_VOCAL_RESTORATION_REGION_OUT_OF_RANGE")
        start=max(0,int(round(start_ms*sr/1000.0)))
        end=min(len(y),int(round(end_ms*sr/1000.0)))
        if end<=start:
            raise ValueError("MUSIC_VOCAL_RESTORATION_REGION_EMPTY")
        pieces.append(y[start:end])
    if not pieces:
        raise ValueError("MUSIC_VOCAL_RESTORATION_REGIONS_REQUIRED")
    selected=np.concatenate(pieces)
    if selected.size<max(512,int(sr*0.04)):
        raise ValueError("MUSIC_VOCAL_RESTORATION_AUDIO_TOO_SHORT")

    hop=256
    try:
        f0,voiced,_=librosa.pyin(
            selected,
            fmin=float(librosa.note_to_hz("C2")),
            fmax=float(librosa.note_to_hz("C7")),
            sr=sr,
            hop_length=hop,
        )
        finite=np.asarray(f0)[np.isfinite(f0)]
        voiced_fraction=float(np.mean(np.asarray(voiced,dtype=bool))) if np.size(voiced) else 0.0
        median_f0=float(np.median(finite)) if finite.size else None
        if finite.size>=3 and median_f0 and median_f0>0:
            cents=1200.0*np.log2(finite/median_f0)
            f0_spread=float(np.percentile(cents,90)-np.percentile(cents,10))
        else:
            f0_spread=None
    except Exception:
        voiced_fraction=0.0
        median_f0=None
        f0_spread=None

    centroid_feature=librosa.feature.spectral_centroid(y=selected,sr=sr)
    centroid=float(np.mean(centroid_feature)) if centroid_feature.size else 0.0
    rms=np.asarray(librosa.feature.rms(y=selected)).reshape(-1)
    mean_rms=float(np.mean(rms)) if rms.size else 0.0
    rms_db=20.0*math.log10(mean_rms+1e-12)

    harmonic=librosa.effects.harmonic(selected)
    harmonicity=max(
        0.0,
        min(
            1.0,
            float(np.mean(harmonic*harmonic))/(float(np.mean(selected*selected))+1e-12),
        ),
    )
    return {
        "voicedFraction":max(0.0,min(1.0,voiced_fraction)),
        "medianF0Hz":median_f0,
        "f0SpreadCents":f0_spread,
        "spectralCentroidHz":max(0.0,centroid),
        "rmsDb":rms_db,
        "harmonicity":harmonicity,
    }

def _vocal_preservation(
    source:dict[str,Any],
    output:dict[str,Any],
    operations:list[str],
)->dict[str,Any]:
    reasons=[]
    voiced_delta=abs(float(output["voicedFraction"])-float(source["voicedFraction"]))
    if voiced_delta>0.20:
        reasons.append("voiced fraction drift exceeds 0.20")

    source_f0=source.get("medianF0Hz")
    output_f0=output.get("medianF0Hz")
    f0_delta=None
    if float(source["voicedFraction"])>=0.20:
        if not source_f0 or not output_f0 or float(output["voicedFraction"])<0.15:
            reasons.append("voiced source lost reliable F0 evidence")
        else:
            f0_delta=abs(1200.0*math.log2(float(output_f0)/float(source_f0)))
            if f0_delta>50:
                reasons.append("median F0 drift exceeds 50 cents")

    source_spread=source.get("f0SpreadCents")
    output_spread=output.get("f0SpreadCents")
    spread_delta=None
    if source_spread is not None and output_spread is not None:
        spread_delta=abs(float(output_spread)-float(source_spread))
        if spread_delta>150:
            reasons.append("F0 spread/vibrato proxy drift exceeds 150 cents")

    source_centroid=max(float(source["spectralCentroidHz"]),1e-9)
    centroid_delta=abs(float(output["spectralCentroidHz"])-source_centroid)/source_centroid
    centroid_limit=0.45 if "eq" in operations else 0.30
    if centroid_delta>centroid_limit:
        reasons.append(f"spectral centroid drift exceeds {centroid_limit:.2f}")

    rms_delta=abs(float(output["rmsDb"])-float(source["rmsDb"]))
    if rms_delta>6:
        reasons.append("RMS drift exceeds 6 dB")

    harmonicity_delta=abs(float(output["harmonicity"])-float(source["harmonicity"]))
    if harmonicity_delta>0.30:
        reasons.append("harmonicity drift exceeds 0.30")

    return {
        "passed":not reasons,
        "sourceVoicedFraction":float(source["voicedFraction"]),
        "outputVoicedFraction":float(output["voicedFraction"]),
        "voicedFractionDelta":voiced_delta,
        "sourceMedianF0Hz":source_f0,
        "outputMedianF0Hz":output_f0,
        "medianF0CentsDelta":f0_delta,
        "sourceF0SpreadCents":source_spread,
        "outputF0SpreadCents":output_spread,
        "f0SpreadCentsDelta":spread_delta,
        "sourceSpectralCentroidHz":float(source["spectralCentroidHz"]),
        "outputSpectralCentroidHz":float(output["spectralCentroidHz"]),
        "spectralCentroidRelativeDelta":centroid_delta,
        "sourceRmsDb":float(source["rmsDb"]),
        "outputRmsDb":float(output["rmsDb"]),
        "rmsDbDelta":rms_delta,
        "sourceHarmonicity":float(source["harmonicity"]),
        "outputHarmonicity":float(output["harmonicity"]),
        "harmonicityDelta":harmonicity_delta,
        "reasons":reasons,
    }

def _vocal_source_envelope(segment:dict[str,Any])->str:
    start=segment["startMs"]/1000.0
    end=segment["endMs"]/1000.0
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

def execute_vocal_restoration_path(
    source_path:Path,
    source_artifact_id:str,
    source_sha256:str,
    job_id:str,
    request_id:str,
    authorization_id:str,
    segments:list[dict[str,Any]],
    sample_rate:int,
    channels:int,
    config:RestorationWorkerConfig,
)->dict[str,Any]:
    if not job_id.strip() or not request_id.strip() or not authorization_id.strip():
        raise ValueError("MUSIC_VOCAL_RESTORATION_AUTHORITY_REQUIRED")
    if not segments or len(segments)>64:
        raise ValueError("MUSIC_VOCAL_RESTORATION_SEGMENT_COUNT_INVALID")

    source_probe=probe_path(source_path,source_artifact_id,source_sha256)
    if source_probe["sampleRate"]!=sample_rate or source_probe["channels"]!=channels:
        raise ValueError("MUSIC_VOCAL_RESTORATION_SOURCE_DIMENSIONS_MISMATCH")

    source_duration_ms=float(source_probe["durationSeconds"])*1000.0
    normalized=[]
    previous_end=-1.0
    for raw in segments:
        segment=_vocal_repair_segment(raw,source_duration_ms)
        if segment["startMs"]<previous_end:
            raise ValueError("MUSIC_VOCAL_RESTORATION_SEGMENTS_OVERLAP")
        previous_end=segment["endMs"]
        normalized.append(segment)

    directory=config.output_dir/("vocal-"+_safe_token(job_id))
    directory.mkdir(parents=True,exist_ok=True)
    output=directory/"output.wav"
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")

    branch_count=len(normalized)+1
    split_labels=["base0",*[f"vocal{index}" for index in range(len(normalized))]]
    filters=[f"[0:a]asplit={branch_count}"+ "".join(f"[{label}]" for label in split_labels)]

    source_label="base0"
    for index,segment in enumerate(normalized):
        next_label=f"base{index+1}"
        envelope=_vocal_source_envelope(segment)
        filters.append(f"[{source_label}]volume='{envelope}':eval=frame[{next_label}]")
        source_label=next_label

    repaired_labels=[]
    for index,segment in enumerate(normalized):
        start=segment["startMs"]/1000.0
        end=segment["endMs"]/1000.0
        duration=end-start
        fade=segment["fadeMs"]/1000.0
        chain=(
            f"[vocal{index}]atrim=start={start:.9f}:end={end:.9f},"
            "asetpts=PTS-STARTPTS"
        )
        graph=segment["filterGraph"]
        if graph:
            chain+=f",{graph}"
        processed_mix=max(0.0,1.0-float(segment["sourceResidualMix"]))
        chain+=f",volume={processed_mix:.9f}"
        if fade>0:
            chain+=(
                f",afade=t=in:st=0:d={fade:.9f},"
                f"afade=t=out:st={max(0.0,duration-fade):.9f}:d={fade:.9f}"
            )
        chain+=f",adelay=delays={segment['startMs']:.3f}:all=1[repair{index}]"
        filters.append(chain)
        repaired_labels.append(f"[repair{index}]")

    mix_inputs=f"[{source_label}]"+ "".join(repaired_labels)
    filters.append(
        f"{mix_inputs}amix=inputs={1+len(repaired_labels)}:normalize=0:dropout_transition=0,"
        f"atrim=duration={float(source_probe['durationSeconds']):.9f}[restored]"
    )
    args=[
        ffmpeg,"-nostdin","-v","error","-y","-i",str(source_path),
        "-filter_complex",";".join(filters),
        "-map","[restored]",
        "-c:a","pcm_s24le","-ar",str(sample_rate),"-ac",str(channels),str(output),
    ]
    result=subprocess.run(
        args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        timeout=900,
        check=False,
    )
    if result.returncode!=0 or not output.is_file() or output.stat().st_size<=0:
        raise RuntimeError(
            "MUSIC_VOCAL_RESTORATION_RENDER_FAILED:"+
            result.stderr.decode(errors="replace")[-1200:]
        )

    regions=[(segment["startMs"],segment["endMs"]) for segment in normalized]
    source_metrics=_vocal_region_metrics(source_path,regions)
    output_metrics=_vocal_region_metrics(output,regions)
    preservation=_vocal_preservation(
        source_metrics,
        output_metrics,
        [segment["operation"] for segment in normalized],
    )

    digest=sha256(output.read_bytes()).hexdigest()
    output_id=f"music-vocal-restoration:{_safe_token(job_id)}:{digest[:16]}"
    out_probe=probe_path(output,output_id,digest)
    payload={
        "jobId":job_id,
        "requestId":request_id,
        "sourceArtifactId":source_artifact_id,
        "sourceSha256":source_sha256.lower(),
        "outputArtifactId":output_id,
        "resultUri":f"/v1/jobs/{_safe_token(job_id)}/artifact/output.wav",
        "outputSha256":digest,
        "sampleRate":out_probe["sampleRate"],
        "channels":out_probe["channels"],
        "sampleCount":out_probe["sampleCount"],
        "durationSeconds":out_probe["durationSeconds"],
        "segmentCount":len(normalized),
        "preservation":preservation,
    }
    payload["runtimeReceiptId"]=receipt_id("music-vocal-restoration",payload)
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
    for prefix in ("separate","repair","reconstruct","vocal"):
        candidate=config.output_dir/f"{prefix}-{job_token}"/name
        if candidate.is_file() and candidate.stat().st_size>0: return candidate
    return None
