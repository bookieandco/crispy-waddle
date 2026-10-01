"""Deterministic spatial/source-recovery and analog-transfer analysis.

This module has no authorization, storage, or network authority. Heavy audio
libraries are imported inside functions so syntax/unit tests remain lightweight.
"""
from __future__ import annotations

import math
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import Any

CUSTOM_SOURCE_RECOVERY_OPERATIONS={"mid-side-repair","dereverb","spectral-recovery"}

def _clamp(value:float,minimum:float=0.0,maximum:float=1.0)->float:
    return max(minimum,min(maximum,value))

def _finite(value:Any)->bool:
    try:
        return math.isfinite(float(value))
    except (TypeError,ValueError):
        return False

def _parabolic_peak(values:Any,index:int)->float:
    """Sub-bin peak offset in [-1, 1] using log-magnitude interpolation."""
    import numpy as np
    if index<=0 or index>=len(values)-1:
        return float(index)
    y0=math.log(max(float(values[index-1]),1e-12))
    y1=math.log(max(float(values[index]),1e-12))
    y2=math.log(max(float(values[index+1]),1e-12))
    denominator=y0-2.0*y1+y2
    if abs(denominator)<1e-12:
        return float(index)
    offset=0.5*(y0-y2)/denominator
    return float(index)+float(np.clip(offset,-1.0,1.0))

def corroborated_timebase_confidence(
    hum_confidence:float,
    program_tone_confidence:float,
    relative_drift_correlation:float,
    wow_energy_ratio:float,
    flutter_energy_ratio:float,
)->dict[str,float|bool]:
    """Timebase correction authority requires two correlated frequency tracks."""
    values=(hum_confidence,program_tone_confidence,relative_drift_correlation,wow_energy_ratio,flutter_energy_ratio)
    if not all(_finite(v) for v in values):
        return {"timebaseConfidence":0.0,"wowConfidence":0.0,"flutterConfidence":0.0,"corroborated":False}
    correlation_gate=_clamp((float(relative_drift_correlation)-0.40)/0.60)
    base=min(_clamp(float(hum_confidence)),_clamp(float(program_tone_confidence)))*correlation_gate
    wow=_clamp(base*_clamp(float(wow_energy_ratio))*1.5)
    flutter=_clamp(base*_clamp(float(flutter_energy_ratio))*1.5)
    return {
        "timebaseConfidence":_clamp(base),
        "wowConfidence":wow,
        "flutterConfidence":flutter,
        "corroborated":bool(base>=0.55 and max(wow,flutter)>=0.25),
    }

def validate_source_recovery_parameters(
    operation:str,
    parameters:dict[str,Any],
    sample_rate:int,
    channels:int,
)->dict[str,Any]:
    if operation not in CUSTOM_SOURCE_RECOVERY_OPERATIONS:
        raise ValueError("MUSIC_RESTORATION_SOURCE_RECOVERY_OPERATION_NOT_ADMITTED")
    if sample_rate<=0 or channels<=0:
        raise ValueError("MUSIC_RESTORATION_SOURCE_RECOVERY_DIMENSIONS_INVALID")
    resolved=dict(parameters)
    nyquist=sample_rate/2.0

    if operation=="mid-side-repair":
        if channels!=2:
            raise ValueError("MUSIC_RESTORATION_MID_SIDE_STEREO_REQUIRED")
        mode=str(resolved.get("mode","")).strip().lower()
        inner=str(resolved.get("innerOperation","")).strip().lower()
        if mode not in {"mid","side"}:
            raise ValueError("MUSIC_RESTORATION_MID_SIDE_MODE_INVALID")
        if inner not in {"gain","eq","denoise","dehum"}:
            raise ValueError("MUSIC_RESTORATION_MID_SIDE_INNER_OPERATION_INVALID")
        resolved["mode"]=mode
        resolved["innerOperation"]=inner
        if inner=="gain":
            gain=float(resolved.get("innerGainDb",0.0))
            if not _finite(gain) or abs(gain)>6:
                raise ValueError("MUSIC_RESTORATION_MID_SIDE_GAIN_INVALID")
        elif inner=="eq":
            frequency=float(resolved.get("innerFrequencyHz",0.0))
            gain=float(resolved.get("innerGainDb",0.0))
            q=float(resolved.get("innerQ",0.0))
            if not 20<=frequency<=min(22000,nyquist) or not _finite(gain) or abs(gain)>6 or not 0.2<=q<=10:
                raise ValueError("MUSIC_RESTORATION_MID_SIDE_EQ_INVALID")
        elif inner=="denoise":
            floor=float(resolved.get("innerNoiseFloorDb",-55.0))
            reduction=float(resolved.get("innerNoiseReductionDb",8.0))
            if not -80<=floor<=-20 or not 0<=reduction<=18:
                raise ValueError("MUSIC_RESTORATION_MID_SIDE_DENOISE_INVALID")
        else:
            fundamental=float(resolved.get("innerFundamentalHz",0.0))
            harmonics=int(resolved.get("innerHarmonics",4))
            q=float(resolved.get("innerQ",30.0))
            reduction=float(resolved.get("innerReductionDb",24.0))
            if not 40<=fundamental<=1000 or not 1<=harmonics<=8 or not 2<=q<=80 or not 6<=reduction<=50:
                raise ValueError("MUSIC_RESTORATION_MID_SIDE_DEHUM_INVALID")
        return resolved

    analysis_confidence=float(resolved.get("analysisConfidence",0.0))
    if not _finite(analysis_confidence) or analysis_confidence<0.65 or analysis_confidence>1:
        raise ValueError("MUSIC_RESTORATION_SOURCE_RECOVERY_ANALYSIS_CONFIDENCE_REQUIRED")

    if operation=="dereverb":
        strength=float(resolved.get("strength",0.35))
        maximum=float(resolved.get("maxReductionDb",6.0))
        decay=float(resolved.get("decayMs",140.0))
        if not 0<strength<=0.60 or not 1<=maximum<=12 or not 40<=decay<=400:
            raise ValueError("MUSIC_RESTORATION_DEREVERB_PARAMETERS_INVALID")
        return resolved

    cutoff=float(resolved.get("detectedCutoffHz",0.0))
    extension=float(resolved.get("maxExtensionHz",min(nyquist,16000.0)))
    strength=float(resolved.get("strength",0.25))
    decay=float(resolved.get("decayDbPerOctave",9.0))
    if not 1000<=cutoff<nyquist*0.90:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_RECOVERY_CUTOFF_INVALID")
    if not cutoff<extension<=nyquist:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_RECOVERY_EXTENSION_INVALID")
    if not 0<strength<=0.50 or not 3<=decay<=18:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_RECOVERY_PARAMETERS_INVALID")
    return resolved

def _mid_side_filter(parameters:dict[str,Any])->str:
    inner=str(parameters["innerOperation"])
    if inner=="gain":
        return f"volume={float(parameters.get('innerGainDb',0.0)):.6f}dB"
    if inner=="eq":
        return (
            f"equalizer=f={float(parameters['innerFrequencyHz']):.6f}:"
            f"width_type=q:width={float(parameters['innerQ']):.6f}:"
            f"g={float(parameters.get('innerGainDb',0.0)):.6f}"
        )
    if inner=="denoise":
        return (
            f"afftdn=nf={float(parameters.get('innerNoiseFloorDb',-55.0)):.6f}:"
            f"nr={float(parameters.get('innerNoiseReductionDb',8.0)):.6f}"
        )
    fundamental=float(parameters["innerFundamentalHz"])
    harmonics=int(parameters.get("innerHarmonics",4))
    q=float(parameters.get("innerQ",30.0))
    reduction=float(parameters.get("innerReductionDb",24.0))
    return ",".join(
        f"equalizer=f={fundamental*h:.6f}:width_type=q:width={q:.6f}:g={-reduction:.6f}"
        for h in range(1,harmonics+1)
    )

def _execute_mid_side(
    source_path:Path,
    output:Path,
    parameters:dict[str,Any],
    sample_rate:int,
    channels:int,
)->dict[str,Any]:
    import numpy as np
    import soundfile as sf
    resolved=validate_source_recovery_parameters("mid-side-repair",parameters,sample_rate,channels)
    data,sr=sf.read(str(source_path),always_2d=True,dtype="float32")
    if int(sr)!=sample_rate or data.shape[1]!=2:
        raise ValueError("MUSIC_RESTORATION_MID_SIDE_SOURCE_DIMENSIONS_MISMATCH")
    root2=math.sqrt(2.0)
    mid=(data[:,0]+data[:,1])/root2
    side=(data[:,0]-data[:,1])/root2
    target=mid if resolved["mode"]=="mid" else side
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("MUSIC_RESTORATION_FFMPEG_REQUIRED")
    with tempfile.TemporaryDirectory(prefix="music-mid-side-") as td:
        raw=Path(td)/"target.wav"
        processed=Path(td)/"processed.wav"
        sf.write(str(raw),target,sample_rate,subtype="FLOAT")
        result=subprocess.run(
            [ffmpeg,"-nostdin","-v","error","-y","-i",str(raw),"-af",_mid_side_filter(resolved),"-c:a","pcm_f32le",str(processed)],
            stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=300,check=False,
        )
        if result.returncode!=0 or not processed.is_file():
            raise RuntimeError("MUSIC_RESTORATION_MID_SIDE_FILTER_FAILED:"+result.stderr.decode(errors="replace")[-500:])
        repaired,_=sf.read(str(processed),dtype="float32")
    if repaired.shape[0]!=data.shape[0]:
        raise RuntimeError("MUSIC_RESTORATION_MID_SIDE_LENGTH_CHANGED")
    if resolved["mode"]=="mid":
        mid=repaired
    else:
        side=repaired
    left=(mid+side)/root2
    right=(mid-side)/root2
    rendered=np.column_stack((left,right)).astype(np.float32)
    peak=float(np.max(np.abs(rendered))) if rendered.size else 0.0
    if peak>1.0:
        raise ValueError("MUSIC_RESTORATION_MID_SIDE_OUTPUT_CLIPPING_RISK")
    sf.write(str(output),rendered,sample_rate,subtype="PCM_24")
    return {
        "midSideMode":str(resolved["mode"]),
        "midSideInnerOperation":str(resolved["innerOperation"]),
        "midSideOutputPeak":peak,
        "sourceRecovery":False,
    }

def _execute_dereverb(
    source_path:Path,
    output:Path,
    parameters:dict[str,Any],
    sample_rate:int,
    channels:int,
)->dict[str,Any]:
    import numpy as np
    import librosa
    import soundfile as sf
    resolved=validate_source_recovery_parameters("dereverb",parameters,sample_rate,channels)
    data,sr=sf.read(str(source_path),always_2d=True,dtype="float32")
    if int(sr)!=sample_rate or data.shape[1]!=channels:
        raise ValueError("MUSIC_RESTORATION_DEREVERB_SOURCE_DIMENSIONS_MISMATCH")
    n_fft=2048
    hop=512
    strength=float(resolved.get("strength",0.35))
    reduction_linear=10.0**(-float(resolved.get("maxReductionDb",6.0))/20.0)
    decay_seconds=float(resolved.get("decayMs",140.0))/1000.0
    alpha=math.exp(-(hop/float(sample_rate))/max(decay_seconds,1e-3))
    rendered=np.zeros_like(data)
    mean_tail=0.0
    observations=0
    for channel in range(channels):
        signal=np.asarray(data[:,channel],dtype=np.float32)
        spec=librosa.stft(signal,n_fft=n_fft,hop_length=hop,window="hann",center=True)
        magnitude=np.abs(spec)
        phase=np.exp(1j*np.angle(spec))
        gain=np.ones_like(magnitude,dtype=np.float32)
        previous=magnitude[:,0].copy()
        for frame in range(1,magnitude.shape[1]):
            current=magnitude[:,frame]
            tail=np.clip((previous-current)/(previous+1e-9),0.0,1.0)
            frame_gain=1.0-strength*tail*(1.0-reduction_linear)
            gain[:,frame]=frame_gain
            previous=alpha*previous+(1.0-alpha)*current
            mean_tail+=float(np.mean(tail))
            observations+=1
        restored=librosa.istft(magnitude*gain*phase,hop_length=hop,window="hann",center=True,length=signal.size)
        rendered[:,channel]=restored.astype(np.float32)
    peak=float(np.max(np.abs(rendered))) if rendered.size else 0.0
    if peak>1.0:
        raise ValueError("MUSIC_RESTORATION_DEREVERB_OUTPUT_CLIPPING_RISK")
    sf.write(str(output),rendered,sample_rate,subtype="PCM_24")
    return {
        "dereverbStrength":strength,
        "dereverbMaxReductionDb":float(resolved.get("maxReductionDb",6.0)),
        "dereverbDecayMs":float(resolved.get("decayMs",140.0)),
        "dereverbMeanTailLikelihood":mean_tail/max(1,observations),
        "analysisConfidence":float(resolved["analysisConfidence"]),
        "sourceRecovery":False,
    }

def _execute_spectral_recovery(
    source_path:Path,
    output:Path,
    parameters:dict[str,Any],
    sample_rate:int,
    channels:int,
)->dict[str,Any]:
    import numpy as np
    import librosa
    import soundfile as sf
    resolved=validate_source_recovery_parameters("spectral-recovery",parameters,sample_rate,channels)
    data,sr=sf.read(str(source_path),always_2d=True,dtype="float32")
    if int(sr)!=sample_rate or data.shape[1]!=channels:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_RECOVERY_SOURCE_DIMENSIONS_MISMATCH")
    n_fft=4096
    hop=1024
    cutoff=float(resolved["detectedCutoffHz"])
    extension=float(resolved.get("maxExtensionHz",min(sample_rate/2.0,16000.0)))
    strength=float(resolved.get("strength",0.25))
    decay=float(resolved.get("decayDbPerOctave",9.0))
    rendered=np.zeros_like(data)
    synthesized_bins=0
    for channel in range(channels):
        signal=np.asarray(data[:,channel],dtype=np.float32)
        spec=librosa.stft(signal,n_fft=n_fft,hop_length=hop,window="hann",center=True)
        freqs=librosa.fft_frequencies(sr=sample_rate,n_fft=n_fft)
        target=np.where((freqs>cutoff)&(freqs<=extension))[0]
        if target.size==0:
            raise ValueError("MUSIC_RESTORATION_SPECTRAL_RECOVERY_TARGET_BAND_EMPTY")
        source_freqs=freqs[target]/2.0
        source_bins=np.clip(np.searchsorted(freqs,source_freqs),1,len(freqs)-1)
        source_bins=np.where(
            np.abs(freqs[source_bins]-source_freqs)<np.abs(freqs[source_bins-1]-source_freqs),
            source_bins,source_bins-1,
        )
        source_values=spec[source_bins,:]
        source_magnitude=np.abs(source_values)
        source_phase=np.angle(source_values)
        octave=np.log2(np.maximum(freqs[target],cutoff+1e-9)/cutoff)
        attenuation=10.0**(-(decay*octave)/20.0)
        synthesized=source_magnitude*np.exp(1j*2.0*source_phase)*attenuation[:,None]*strength
        reference_bins=np.where((freqs>=cutoff*0.60)&(freqs<=cutoff))[0]
        cap=np.median(np.abs(spec[reference_bins,:]),axis=0) if reference_bins.size else np.max(np.abs(spec),axis=0)
        magnitude=np.abs(synthesized)
        scale=np.minimum(1.0,cap[None,:]/(magnitude+1e-9))
        synthesized=synthesized*scale
        spec[target,:]=spec[target,:]+synthesized
        synthesized_bins=max(synthesized_bins,int(target.size))
        restored=librosa.istft(spec,hop_length=hop,window="hann",center=True,length=signal.size)
        rendered[:,channel]=restored.astype(np.float32)
    peak=float(np.max(np.abs(rendered))) if rendered.size else 0.0
    if peak>1.0:
        raise ValueError("MUSIC_RESTORATION_SPECTRAL_RECOVERY_OUTPUT_CLIPPING_RISK")
    sf.write(str(output),rendered,sample_rate,subtype="PCM_24")
    return {
        "detectedCutoffHz":cutoff,
        "maxExtensionHz":extension,
        "spectralRecoveryStrength":strength,
        "spectralRecoveryDecayDbPerOctave":decay,
        "spectralRecoveryBins":synthesized_bins,
        "analysisConfidence":float(resolved["analysisConfidence"]),
        "reconstructedHighFrequency":True,
        "sourceRecovery":True,
        "authenticatedOriginalContent":False,
    }

def execute_source_recovery_operation(
    source_path:Path,
    output:Path,
    operation:str,
    parameters:dict[str,Any],
    sample_rate:int,
    channels:int,
)->dict[str,Any]:
    if operation=="mid-side-repair":
        return _execute_mid_side(source_path,output,parameters,sample_rate,channels)
    if operation=="dereverb":
        return _execute_dereverb(source_path,output,parameters,sample_rate,channels)
    if operation=="spectral-recovery":
        return _execute_spectral_recovery(source_path,output,parameters,sample_rate,channels)
    raise ValueError("MUSIC_RESTORATION_SOURCE_RECOVERY_OPERATION_NOT_ADMITTED")

def _fft_autocorrelation(values:Any)->Any:
    import numpy as np
    x=np.asarray(values,dtype=float)
    if x.size<4:
        return np.zeros_like(x)
    x=x-float(np.mean(x))
    size=1
    while size<2*x.size:
        size*=2
    spectrum=np.fft.rfft(x,n=size)
    corr=np.fft.irfft(spectrum*np.conjugate(spectrum),n=size)[:x.size]
    if corr.size and corr[0]>1e-12:
        corr=corr/corr[0]
    return corr

def _select_reference_bin(median_spectrum:Any,freqs:Any,low:float,high:float)->tuple[int,float]:
    import numpy as np
    indices=np.where((freqs>=low)&(freqs<=high))[0]
    if indices.size==0:
        return 0,0.0
    local=np.asarray(median_spectrum)[indices]
    offset=int(np.argmax(local))
    index=int(indices[offset])
    background=float(np.median(local))+1e-12
    ratio=float(local[offset])/background
    return index,ratio

def _track_near_frequency(magnitude:Any,freqs:Any,reference_hz:float,fraction:float)->tuple[Any,float]:
    import numpy as np
    low=max(0.0,reference_hz*(1.0-fraction))
    high=reference_hz*(1.0+fraction)
    indices=np.where((freqs>=low)&(freqs<=high))[0]
    if indices.size<3:
        return np.asarray([],dtype=float),0.0
    local=np.asarray(magnitude)[indices,:]
    tracks=[]
    ratios=[]
    bin_hz=float(freqs[1]-freqs[0]) if len(freqs)>1 else 0.0
    for frame in range(local.shape[1]):
        column=local[:,frame]
        offset=int(np.argmax(column))
        global_index=int(indices[offset])
        interpolated=_parabolic_peak(np.asarray(magnitude)[:,frame],global_index)
        tracks.append(interpolated*bin_hz)
        ratios.append(float(column[offset])/(float(np.median(column))+1e-12))
    confidence=_clamp((float(np.median(ratios))-1.0)/12.0) if ratios else 0.0
    return np.asarray(tracks,dtype=float),confidence

def _modulation_energy_ratios(relative_track:Any,frame_rate:float)->tuple[float,float]:
    import numpy as np
    track=np.asarray(relative_track,dtype=float)
    if track.size<64 or frame_rate<=0:
        return 0.0,0.0
    track=track-float(np.median(track))
    spectrum=np.abs(np.fft.rfft(track*np.hanning(track.size)))**2
    freqs=np.fft.rfftfreq(track.size,d=1.0/frame_rate)
    total=float(np.sum(spectrum[(freqs>=0.1)&(freqs<=20.0)]))+1e-12
    wow=float(np.sum(spectrum[(freqs>=0.1)&(freqs<6.0)]))/total
    flutter=float(np.sum(spectrum[(freqs>=6.0)&(freqs<=20.0)]))/total
    return _clamp(wow),_clamp(flutter)

def analyze_source_recovery_audio(path:Path)->dict[str,Any]:
    import numpy as np
    import librosa
    import soundfile as sf

    data,sr=sf.read(str(path),always_2d=True,dtype="float32")
    if data.size==0 or sr<=0:
        raise ValueError("MUSIC_RESTORATION_SOURCE_RECOVERY_AUDIO_REQUIRED")
    channels=int(data.shape[1])
    mono=np.mean(data,axis=1,dtype=np.float64).astype(np.float32)
    max_samples=min(mono.size,int(sr*30.0))
    if max_samples<max(4096,int(sr*0.25)):
        raise ValueError("MUSIC_RESTORATION_SOURCE_RECOVERY_AUDIO_TOO_SHORT")
    analysis=mono[:max_samples]
    n_fft=8192 if analysis.size>=8192 else 4096
    hop=512
    spec=librosa.stft(analysis,n_fft=n_fft,hop_length=hop,window="hann",center=True)
    magnitude=np.abs(spec)+1e-12
    power=magnitude*magnitude
    freqs=librosa.fft_frequencies(sr=sr,n_fft=n_fft)
    median_mag=np.median(magnitude,axis=1)
    peak=float(np.max(median_mag))+1e-12
    median_db=20.0*np.log10(median_mag/peak)

    active=np.where((freqs>=1000)&(median_db>=-48.0))[0]
    edge_hz=float(freqs[int(active[-1])]) if active.size else 0.0
    cutoff=edge_hz
    pre=np.where((freqs>=max(500.0,cutoff-1000.0))&(freqs<=cutoff))[0]
    post=np.where((freqs>=cutoff+500.0)&(freqs<=min(sr/2.0,cutoff+2500.0)))[0]
    pre_db=float(np.median(median_db[pre])) if pre.size else -120.0
    post_db=float(np.median(median_db[post])) if post.size else -120.0
    edge_drop=max(0.0,pre_db-post_db)
    cutoff_ratio=cutoff/(sr/2.0)
    band_confidence=_clamp((edge_drop-8.0)/30.0)*_clamp((0.92-cutoff_ratio)/0.42)
    band_limited=bool(cutoff>=2500 and band_confidence>=0.65)
    high=np.where(freqs>=min(sr/2.0,max(cutoff+1000.0,8000.0)))[0]
    total_power=float(np.sum(power))+1e-12
    high_ratio=float(np.sum(power[high,:]))/total_power if high.size else 0.0

    rms=np.asarray(librosa.feature.rms(y=analysis,frame_length=2048,hop_length=hop)).reshape(-1)
    tail_ratios=[]
    if rms.size>=12:
        threshold=float(np.percentile(rms,90))
        peak_frames=np.where(rms>=threshold)[0]
        start_offset=max(1,int(round(0.04*sr/hop)))
        end_offset=max(start_offset+1,int(round(0.25*sr/hop)))
        for frame in peak_frames.tolist()[:200]:
            end=min(rms.size,frame+end_offset)
            start=min(end,frame+start_offset)
            if start<end and rms[frame]>1e-9:
                tail_ratios.append(float(np.median(rms[start:end]))/float(rms[frame]))
    tail_persistence=_clamp(float(np.median(tail_ratios)) if tail_ratios else 0.0)
    reverb_confidence=_clamp((tail_persistence-0.18)/0.55)*0.75

    onset=np.asarray(librosa.onset.onset_strength(y=analysis,sr=sr,hop_length=hop),dtype=float)
    autocorr=_fft_autocorrelation(onset)
    min_lag=max(1,int(round(0.03*sr/hop)))
    max_lag=min(len(autocorr)-1,int(round(0.35*sr/hop))) if len(autocorr) else 0
    echo_delay_ms=None
    echo_confidence=0.0
    if max_lag>min_lag:
        window=autocorr[min_lag:max_lag+1]
        index=int(np.argmax(window))+min_lag
        peak_corr=max(0.0,float(autocorr[index]))
        echo_delay_ms=float(index*hop*1000.0/sr)
        echo_confidence=_clamp((peak_corr-0.12)/0.45)*0.85

    hum_index,hum_ratio=_select_reference_bin(median_mag,freqs,45.0,65.0)
    hum_reference=float(freqs[hum_index]) if hum_index else 0.0
    hum_track,hum_track_confidence=_track_near_frequency(magnitude,freqs,hum_reference,0.12) if hum_reference else (np.asarray([],dtype=float),0.0)
    hum_confidence=_clamp(0.55*_clamp((hum_ratio-1.0)/15.0)+0.45*hum_track_confidence)
    hum_std=float(np.std(hum_track)) if hum_track.size else 0.0
    hum_range=float(np.ptp(hum_track)) if hum_track.size else 0.0
    hum_class="drifting" if hum_confidence>=0.45 and hum_std>=0.12 else "stationary" if hum_confidence>=0.45 else "unresolved"

    tone_index,tone_ratio=_select_reference_bin(median_mag,freqs,200.0,min(2000.0,sr/2.0))
    tone_reference=float(freqs[tone_index]) if tone_index else 0.0
    tone_track,tone_track_confidence=_track_near_frequency(magnitude,freqs,tone_reference,0.04) if tone_reference else (np.asarray([],dtype=float),0.0)
    program_confidence=_clamp(0.55*_clamp((tone_ratio-1.0)/18.0)+0.45*tone_track_confidence)
    drift_correlation=0.0
    wow_ratio=0.0
    flutter_ratio=0.0
    if hum_track.size and tone_track.size and min(hum_track.size,tone_track.size)>=64:
        count=min(hum_track.size,tone_track.size)
        hum_relative=hum_track[:count]/max(float(np.median(hum_track[:count])),1e-9)-1.0
        tone_relative=tone_track[:count]/max(float(np.median(tone_track[:count])),1e-9)-1.0
        if float(np.std(hum_relative))>1e-8 and float(np.std(tone_relative))>1e-8:
            drift_correlation=float(np.corrcoef(hum_relative,tone_relative)[0,1])
            if not math.isfinite(drift_correlation):
                drift_correlation=0.0
        frame_rate=float(sr)/float(hop)
        wow_ratio,flutter_ratio=_modulation_energy_ratios(tone_relative,frame_rate)
    timebase=corroborated_timebase_confidence(
        hum_confidence,program_confidence,drift_correlation,wow_ratio,flutter_ratio,
    )

    low_rumble=np.where(freqs<40.0)[0]
    bass_reference=np.where((freqs>=40.0)&(freqs<250.0))[0]
    rumble_ratio=float(np.sum(power[low_rumble,:]))/(float(np.sum(power[bass_reference,:]))+1e-12) if low_rumble.size and bass_reference.size else 0.0
    rumble_confidence=_clamp((rumble_ratio-0.08)/0.45)

    high_hiss=np.where(freqs>=min(8000.0,sr/2.0*0.75))[0]
    mid_reference=np.where((freqs>=1000.0)&(freqs<min(8000.0,sr/2.0*0.75)))[0]
    hiss_ratio=float(np.sum(power[high_hiss,:]))/(float(np.sum(power[mid_reference,:]))+1e-12) if high_hiss.size and mid_reference.size else 0.0
    high_values=median_mag[high_hiss] if high_hiss.size else np.asarray([],dtype=float)
    if high_values.size:
        hiss_flatness=float(math.exp(float(np.mean(np.log(high_values+1e-12))))/(float(np.mean(high_values))+1e-12))
    else:
        hiss_flatness=0.0
    hiss_confidence=_clamp((hiss_flatness-0.25)/0.55)*_clamp(hiss_ratio*18.0)

    channel_delay_ms=None
    channel_delay_confidence=0.0
    azimuth_risk=0.0
    stereo_correlation=None
    mid_side_ratio=None
    if channels==2:
        left=np.asarray(data[:max_samples,0],dtype=float)
        right=np.asarray(data[:max_samples,1],dtype=float)
        left=left-float(np.mean(left)); right=right-float(np.mean(right))
        maximum_lag=max(1,int(round(sr*0.002)))
        best_corr=-1.0; best_lag=0
        for lag in range(-maximum_lag,maximum_lag+1):
            if lag<0:
                a=left[-lag:]; b=right[:right.size+lag]
            elif lag>0:
                a=left[:left.size-lag]; b=right[lag:]
            else:
                a=left; b=right
            if a.size<128:
                continue
            denominator=math.sqrt(float(np.sum(a*a))*float(np.sum(b*b)))+1e-12
            corr=float(np.sum(a*b))/denominator
            if corr>best_corr:
                best_corr=corr; best_lag=lag
        stereo_correlation=float(best_corr)
        channel_delay_ms=float(best_lag*1000.0/sr)
        channel_delay_confidence=_clamp((best_corr-0.25)/0.65)
        azimuth_risk=_clamp(abs(channel_delay_ms)/1.25)*channel_delay_confidence
        mid=(left+right)/math.sqrt(2.0)
        side=(left-right)/math.sqrt(2.0)
        mid_side_ratio=float(np.mean(side*side))/(float(np.mean(mid*mid))+1e-12)

    return {
        "analysisWindowSeconds":float(max_samples)/float(sr),
        "bandLimit":{
            "detected":band_limited,
            "cutoffHz":cutoff if band_limited else None,
            "confidence":band_confidence,
            "edgeDropDb":edge_drop,
            "highBandEnergyRatio":high_ratio,
        },
        "reverberation":{
            "tailPersistence":tail_persistence,
            "excessReverbConfidence":reverb_confidence,
            "echoDelayMs":echo_delay_ms,
            "echoConfidence":echo_confidence,
            "sustainConfoundPossible":True,
        },
        "analogTransfer":{
            "humClass":hum_class,
            "humReferenceHz":hum_reference if hum_reference else None,
            "humConfidence":hum_confidence,
            "humDriftStdHz":hum_std,
            "humDriftRangeHz":hum_range,
            "programToneReferenceHz":tone_reference if tone_reference else None,
            "programToneConfidence":program_confidence,
            "relativeDriftCorrelation":drift_correlation,
            "wowModulationEnergyRatio":wow_ratio,
            "flutterModulationEnergyRatio":flutter_ratio,
            **timebase,
            "timebaseCorrectionEligible":bool(timebase["corroborated"]),
            "rumbleRatio":rumble_ratio,
            "rumbleConfidence":rumble_confidence,
            "hissHighBandRatio":hiss_ratio,
            "hissSpectralFlatness":hiss_flatness,
            "hissConfidence":hiss_confidence,
            "channelDelayMs":channel_delay_ms,
            "channelDelayConfidence":channel_delay_confidence,
            "azimuthRisk":azimuth_risk,
        },
        "spatial":{
            "stereoCorrelation":stereo_correlation,
            "sideToMidEnergyRatio":mid_side_ratio,
        },
        "notes":[
            "Band-limit, reverb, hum, timebase, rumble, hiss and azimuth values are evidence, not automatic edit authority.",
            "Timebase correction eligibility requires correlated hum and program-tone drift; a drifting hum line alone is insufficient.",
            "Reverberation tail evidence can be confounded by musical sustain and therefore remains candidate evidence.",
        ],
    }
