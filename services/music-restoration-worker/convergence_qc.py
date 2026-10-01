"""Deterministic convergence QC for restoration benchmarks.

Analysis only. These functions never authorize or persist a restoration edit.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import Any

def _clamp(v:float,lo:float=0.0,hi:float=1.0)->float:
    return max(lo,min(hi,v))

def _rms(x:Any)->float:
    import numpy as np
    values=np.asarray(x,dtype=float)
    return math.sqrt(float(np.mean(values*values))) if values.size else 0.0

def _load(path:Path,mono:bool=False)->tuple[Any,int]:
    import librosa
    y,sr=librosa.load(str(path),sr=None,mono=mono)
    return y,int(sr)

def _aligned_matrix(path:Path,sr:int,channels:int,samples:int)->Any:
    import numpy as np
    import soundfile as sf
    data,actual_sr=sf.read(str(path),always_2d=True,dtype="float32")
    if int(actual_sr)!=sr or data.shape[1]!=channels:
        raise ValueError("MUSIC_RESTORATION_QC_SIGNAL_DIMENSIONS_MISMATCH")
    if data.shape[0]<samples:
        raise ValueError("MUSIC_RESTORATION_QC_SIGNAL_LENGTH_MISMATCH")
    return np.asarray(data[:samples],dtype=np.float32)

def stem_integrity_analysis(
    source_path:Path,
    stem_paths:dict[str,Path],
    sensitivity:float=0.5,
)->dict[str,Any]:
    import numpy as np
    import soundfile as sf
    if not 0<=sensitivity<=1:
        raise ValueError("MUSIC_RESTORATION_STEM_SENSITIVITY_INVALID")
    source,sr=sf.read(str(source_path),always_2d=True,dtype="float32")
    if source.size==0 or len(stem_paths)<2:
        raise ValueError("MUSIC_RESTORATION_STEM_INTEGRITY_INPUT_REQUIRED")
    channels=source.shape[1]
    samples=source.shape[0]
    stems={role:_aligned_matrix(path,int(sr),channels,samples) for role,path in stem_paths.items()}
    recombined=np.zeros_like(source,dtype=np.float32)
    for values in stems.values():
        recombined+=values
    residual=source-recombined
    source_rms=_rms(source)
    residual_rms=_rms(residual)
    recombination_error=_clamp(residual_rms/(source_rms+1e-12))
    null_db=20.0*math.log10(max(residual_rms,1e-12)/(source_rms+1e-12))

    frame=max(256,int(sr*0.05)); hop=max(128,frame//2)
    roles=list(stems)
    frame_shares=[]
    ambiguous=0
    margin_threshold=0.04+0.26*sensitivity
    accumulated={role:0.0 for role in roles}
    frame_count=0
    for start in range(0,max(1,samples-frame+1),hop):
        energies=[]
        for role in roles:
            segment=stems[role][start:start+frame]
            energy=float(np.sum(segment*segment))+1e-12
            energies.append((role,energy))
        total=sum(v for _,v in energies)
        shares=sorted(((role,v/total) for role,v in energies),key=lambda x:x[1],reverse=True)
        for role,share in shares: accumulated[role]+=share
        if len(shares)>1 and shares[0][1]-shares[1][1]<margin_threshold:
            ambiguous+=1
        frame_shares.append(shares)
        frame_count+=1
    attribution={role:(accumulated[role]/max(1,frame_count)) for role in roles}
    normalization=sum(attribution.values()) or 1.0
    attribution={role:value/normalization for role,value in attribution.items()}
    ambiguous_ratio=ambiguous/max(1,frame_count)

    leakage:dict[str,dict[str,float]]={}
    mono={role:np.mean(values,axis=1,dtype=np.float64) for role,values in stems.items()}
    for a in roles:
        leakage[a]={}
        aa=mono[a]-float(np.mean(mono[a]))
        aa_norm=math.sqrt(float(np.sum(aa*aa)))+1e-12
        for b in roles:
            if a==b:
                leakage[a][b]=0.0
                continue
            bb=mono[b]-float(np.mean(mono[b]))
            corr=abs(float(np.sum(aa*bb))/(aa_norm*(math.sqrt(float(np.sum(bb*bb)))+1e-12)))
            leakage[a][b]=_clamp(corr)

    worst=max((value for row in leakage.values() for value in row.values()),default=0.0)
    attribution_confidence=_clamp((1.0-ambiguous_ratio)*(1.0-worst*0.5))
    return {
        "sampleRate":int(sr),"channels":int(channels),"sampleCount":int(samples),
        "sensitivity":float(sensitivity),
        "recombinationErrorRatio":recombination_error,
        "nullResidualDb":null_db,
        "attributionShares":attribution,
        "ambiguousEnergyRatio":ambiguous_ratio,
        "attributionConfidence":attribution_confidence,
        "leakageMatrix":leakage,
        "worstPairwiseLeakage":worst,
        "energyAccountingConserved":abs(sum(attribution.values())-1.0)<1e-6,
        "recombinedRenderMeasured":True,
        "notes":[
            "Attribution sensitivity changes ambiguity classification, not audio energy.",
            "Leakage is correlation evidence and must not be treated as proof that one stem contains another.",
        ],
    }

def _profile_vocal(path:Path)->dict[str,Any]:
    import numpy as np
    import librosa
    y,sr=librosa.load(str(path),sr=None,mono=True)
    if y.size<max(2048,int(sr*0.25)):
        raise ValueError("MUSIC_RESTORATION_VOCAL_PROFILE_TOO_SHORT")
    hop=512
    rms=np.asarray(librosa.feature.rms(y=y,frame_length=2048,hop_length=hop)).reshape(-1)
    centroid=np.asarray(librosa.feature.spectral_centroid(y=y,sr=sr,n_fft=2048,hop_length=hop)).reshape(-1)
    flatness=np.asarray(librosa.feature.spectral_flatness(y=y,n_fft=2048,hop_length=hop)).reshape(-1)
    stft=np.abs(librosa.stft(y,n_fft=2048,hop_length=hop,window="hann"))
    freqs=librosa.fft_frequencies(sr=sr,n_fft=2048)
    total=np.sum(stft*stft,axis=0)+1e-12
    high=np.sum((stft[freqs>=4500,:])**2,axis=0)/total
    low=np.sum((stft[freqs<1200,:])**2,axis=0)/total
    try:
        f0,voiced,_=librosa.pyin(
            y,fmin=float(librosa.note_to_hz("C2")),fmax=float(librosa.note_to_hz("C7")),
            sr=sr,hop_length=hop,
        )
        voiced_mask=np.asarray(voiced,dtype=bool)
        finite=np.asarray(f0)[np.isfinite(f0)]
    except Exception:
        voiced_mask=np.zeros(rms.size,dtype=bool); finite=np.asarray([],dtype=float)

    frame_n=min(rms.size,flatness.size,high.size,voiced_mask.size)
    if frame_n<=0:
        raise ValueError("MUSIC_RESTORATION_VOCAL_PROFILE_EMPTY")
    median_rms=float(np.median(rms[:frame_n]))+1e-12
    breath=0; sibilance=0; mouth=0
    for i in range(frame_n):
        unvoiced=not bool(voiced_mask[i])
        level=float(rms[i])/median_rms
        if unvoiced and float(high[i])>=0.42 and float(flatness[i])>=0.22:
            sibilance+=1
        elif unvoiced and float(flatness[i])>=0.32 and 0.12<=level<=1.25 and float(low[i])<0.65:
            breath+=1
        if unvoiced and level>=1.8 and float(flatness[i])>=0.18:
            mouth+=1

    phrase_ms=500
    phrase_samples=max(1,int(sr*phrase_ms/1000))
    phrase=[]
    phrase_levels=[]
    for start in range(0,len(y),phrase_samples):
        end=min(len(y),start+phrase_samples)
        value=20*math.log10(max(_rms(y[start:end]),1e-9))
        phrase_levels.append(value)
    target=float(np.median(phrase_levels)) if phrase_levels else -120.0
    for idx,value in enumerate(phrase_levels):
        phrase.append({
            "index":idx,
            "startMs":idx*phrase_ms,
            "endMs":min((idx+1)*phrase_ms,len(y)*1000/sr),
            "rmsDb":value,
            "relativeGainDb":max(-6.0,min(6.0,target-value)),
        })

    harmonicity=0.0
    if finite.size:
        median_f0=float(np.median(finite))
        spectrum=np.abs(np.fft.rfft(y*np.hanning(len(y))))
        sfreq=np.fft.rfftfreq(len(y),d=1.0/sr)
        harmonic_energy=0.0
        for h in range(1,13):
            hz=median_f0*h
            if hz>=sr/2: break
            idx=int(np.argmin(np.abs(sfreq-hz)))
            lo=max(0,idx-1); hi=min(len(spectrum),idx+2)
            harmonic_energy+=float(np.sum(spectrum[lo:hi]**2))
        harmonicity=_clamp(harmonic_energy/(float(np.sum(spectrum**2))+1e-12))
    else:
        median_f0=None

    return {
        "sampleRate":int(sr),
        "durationSeconds":float(len(y))/float(sr),
        "medianF0Hz":median_f0,
        "f0SpreadCents":(
            float(1200*math.log2(max(float(np.percentile(finite,90)),1e-9)/max(float(np.percentile(finite,10)),1e-9)))
            if finite.size>=4 else None
        ),
        "voicedFraction":float(np.mean(voiced_mask[:frame_n])) if frame_n else 0.0,
        "spectralCentroidHz":float(np.mean(centroid)) if centroid.size else 0.0,
        "rmsDb":20*math.log10(max(_rms(y),1e-9)),
        "harmonicity":harmonicity,
        "harmonicFollowConfidence":_clamp(harmonicity*2.0),
        "breathFrameRatio":breath/frame_n,
        "sibilanceFrameRatio":sibilance/frame_n,
        "mouthEventFrameRatio":mouth/frame_n,
        "phraseLevelMap":phrase,
    }

def vocal_intelligence_analysis(
    vocal_path:Path,
    reference_path:Path|None=None,
    reference_relation:str="same-source",
)->dict[str,Any]:
    allowed={"same-phrase","same-song","same-session","known-clean","external-style","same-source"}
    if reference_relation not in allowed:
        raise ValueError("MUSIC_RESTORATION_VOCAL_REFERENCE_RELATION_INVALID")
    source=_profile_vocal(vocal_path)
    reference=_profile_vocal(reference_path) if reference_path else None
    distance=None
    if reference:
        components=[]
        def rel(a:float,b:float,scale:float=1.0)->float:
            return _clamp(abs(a-b)/(max(abs(b),1e-9)*scale))
        components.append(rel(float(source["spectralCentroidHz"]),float(reference["spectralCentroidHz"]),0.6))
        components.append(_clamp(abs(float(source["rmsDb"])-float(reference["rmsDb"]))/12.0))
        components.append(_clamp(abs(float(source["harmonicity"])-float(reference["harmonicity"]))/0.5))
        components.append(_clamp(abs(float(source["sibilanceFrameRatio"])-float(reference["sibilanceFrameRatio"]))/0.35))
        components.append(_clamp(abs(float(source["breathFrameRatio"])-float(reference["breathFrameRatio"]))/0.35))
        if source["medianF0Hz"] and reference["medianF0Hz"]:
            cents=abs(1200*math.log2(float(source["medianF0Hz"])/float(reference["medianF0Hz"])))
            components.append(_clamp(cents/300.0))
        distance=float(sum(components)/len(components))
    return {
        "referenceRelation":reference_relation,
        "sourceProfile":source,
        "referenceProfile":reference,
        "referenceDistance":distance,
        "externalReferenceCannotOverrideIdentity":reference_relation=="external-style",
        "notes":[
            "Phrase leveling and non-tonal event labels are analysis evidence, not automatic gain or removal authority.",
            "Breath, sibilance and mouth-event classifications are preservation cues unless independent damage evidence exists.",
        ],
    }

def _tonal_balance(y:Any,sr:int)->dict[str,float]:
    import numpy as np
    mono=np.mean(y,axis=1) if getattr(y,"ndim",1)>1 else np.asarray(y)
    spectrum=np.abs(np.fft.rfft(mono*np.hanning(len(mono))))**2
    freqs=np.fft.rfftfreq(len(mono),d=1.0/sr)
    bands=[("20-60",20,60),("60-120",60,120),("120-250",120,250),("250-500",250,500),
           ("500-2000",500,2000),("2000-4000",2000,4000),("4000-8000",4000,8000),
           ("8000-16000",8000,min(16000,sr/2))]
    total=float(np.sum(spectrum[(freqs>=20)&(freqs<=sr/2)]))+1e-12
    return {name:float(np.sum(spectrum[(freqs>=lo)&(freqs<hi)]))/total for name,lo,hi in bands if hi>lo}

def _band_crest(y:Any,sr:int,lo:float,hi:float)->float:
    import numpy as np
    mono=np.mean(y,axis=1) if getattr(y,"ndim",1)>1 else np.asarray(y)
    spec=np.fft.rfft(mono)
    freqs=np.fft.rfftfreq(len(mono),d=1.0/sr)
    masked=np.zeros_like(spec); mask=(freqs>=lo)&(freqs<hi); masked[mask]=spec[mask]
    band=np.fft.irfft(masked,n=len(mono))
    rms=_rms(band); peak=float(np.max(np.abs(band))) if len(band) else 0.0
    return 20*math.log10(max(peak,1e-12)/max(rms,1e-12))

def _masking_graph(stems:dict[str,Any],sr:int)->dict[str,Any]:
    import numpy as np
    roles=list(stems)
    bands=[(60,120),(120,250),(250,500),(500,2000),(2000,4000),(4000,8000)]
    band_energy={}
    for role,values in stems.items():
        mono=np.mean(values,axis=1) if values.ndim>1 else values
        spec=np.abs(np.fft.rfft(mono*np.hanning(len(mono))))**2
        freqs=np.fft.rfftfreq(len(mono),d=1.0/sr)
        band_energy[role]=[float(np.sum(spec[(freqs>=lo)&(freqs<hi)])) for lo,hi in bands]
    edges=[]
    cumulative={}
    for target in roles:
        total_target=sum(band_energy[target])+1e-12
        cumulative_mask=0.0
        for masker in roles:
            if masker==target: continue
            overlap=sum(min(a,b) for a,b in zip(band_energy[target],band_energy[masker]))/total_target
            edges.append({"target":target,"masker":masker,"score":_clamp(overlap)})
            cumulative_mask+=overlap
        cumulative[target]=_clamp(cumulative_mask)
    return {"edges":edges,"cumulative":cumulative}

def _ffmpeg_translation(source:Path,destination:Path,kind:str)->None:
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    args=[ffmpeg,"-nostdin","-v","error","-y","-i",str(source)]
    if kind=="mono":
        args+=["-ac","1"]
    elif kind=="phone":
        args+=["-ac","1","-af","highpass=f=300,lowpass=f=3400"]
    elif kind=="small-speaker":
        args+=["-ac","1","-af","highpass=f=150,lowpass=f=8000"]
    elif kind=="streaming-normalized":
        args+=["-af","loudnorm=I=-14:TP=-1:LRA=20:linear=true"]
    elif kind=="lossy":
        mp3=destination.with_suffix(".mp3")
        enc=subprocess.run(args+["-c:a","libmp3lame","-b:a","128k",str(mp3)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=False,timeout=180)
        if enc.returncode!=0:
            raise RuntimeError("MUSIC_RESTORATION_TRANSLATION_LOSSY_ENCODE_FAILED:"+enc.stderr.decode(errors="replace")[-300:])
        dec=subprocess.run([ffmpeg,"-nostdin","-v","error","-y","-i",str(mp3),"-c:a","pcm_f32le",str(destination)],
                           stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=False,timeout=180)
        if dec.returncode!=0: raise RuntimeError("MUSIC_RESTORATION_TRANSLATION_LOSSY_DECODE_FAILED")
        return
    args+=["-c:a","pcm_f32le",str(destination)]
    result=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=False,timeout=180)
    if result.returncode!=0:
        raise RuntimeError("MUSIC_RESTORATION_TRANSLATION_RENDER_FAILED:"+result.stderr.decode(errors="replace")[-300:])

def mix_translation_analysis(source_path:Path,stem_paths:dict[str,Path]|None=None)->dict[str,Any]:
    import numpy as np
    import soundfile as sf
    source,sr=sf.read(str(source_path),always_2d=True,dtype="float32")
    if source.size==0: raise ValueError("MUSIC_RESTORATION_TRANSLATION_SOURCE_REQUIRED")
    tonal=_tonal_balance(source,int(sr))
    crest={
        "20-60":_band_crest(source,int(sr),20,60),
        "60-120":_band_crest(source,int(sr),60,120),
        "120-250":_band_crest(source,int(sr),120,250),
        "full":20*math.log10(max(float(np.max(np.abs(source))),1e-12)/max(_rms(source),1e-12)),
    }
    stems=None
    masking={"edges":[],"cumulative":{}}
    if stem_paths:
        stems={role:_aligned_matrix(path,int(sr),source.shape[1],source.shape[0]) for role,path in stem_paths.items()}
        masking=_masking_graph(stems,int(sr))

    base_mono=np.mean(source,axis=1)
    base_rms=_rms(base_mono)
    base_centroid=0.0
    try:
        import librosa
        base_centroid=float(np.mean(librosa.feature.spectral_centroid(y=base_mono,sr=int(sr))))
    except Exception:
        pass

    translations={}
    with tempfile.TemporaryDirectory(prefix="music-translation-qc-") as td:
        for kind in ("mono","phone","small-speaker","lossy","streaming-normalized"):
            out=Path(td)/(kind+".wav")
            _ffmpeg_translation(source_path,out,kind)
            rendered,rr=sf.read(str(out),always_2d=True,dtype="float32")
            mono=np.mean(rendered,axis=1)
            length=min(len(base_mono),len(mono))
            a=base_mono[:length]; b=mono[:length]
            corr=0.0
            if length>128:
                aa=a-float(np.mean(a)); bb=b-float(np.mean(b))
                corr=float(np.sum(aa*bb))/(math.sqrt(float(np.sum(aa*aa))*float(np.sum(bb*bb)))+1e-12)
            rms_delta=20*math.log10(max(_rms(b),1e-9)/max(base_rms,1e-9))
            centroid=0.0
            try:
                import librosa
                centroid=float(np.mean(librosa.feature.spectral_centroid(y=b,sr=int(rr))))
            except Exception:
                pass
            spectral_delta=abs(centroid-base_centroid)/(max(base_centroid,1.0))
            failure=_clamp((1.0-max(-1.0,min(1.0,corr)))/2.0*0.55+min(1.0,abs(rms_delta)/12.0)*0.15+min(1.0,spectral_delta)*0.30)
            translations[kind]={
                "correlation":corr,"rmsDeltaDb":rms_delta,"spectralCentroidRelativeDelta":spectral_delta,
                "failureScore":failure,
            }
    return {
        "sampleRate":int(sr),"channels":int(source.shape[1]),"sampleCount":int(source.shape[0]),
        "tonalBalance":tonal,
        "bandCrestFactorDb":crest,
        "maskingGraph":masking,
        "translations":translations,
        "translationFailureCount":sum(1 for item in translations.values() if float(item["failureScore"])>=0.55),
        "notes":[
            "Translation renders are ephemeral QC simulations and never replace the canonical restoration artifact.",
            "Tonal balance and masking measurements are descriptive evidence; they do not authorize mastering changes.",
        ],
    }
