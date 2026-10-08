/** DAW.9.1: inspect real source PCM and render clip-relative waveform peaks.
 * PCM, not metadata/name inference. No source writes, cloud caches or ML.
 */
import type { MusicDawClip } from "./music-daw-session.js";

export interface MusicDawWaveformEnvelope {
  schema: "jhadina-daw-verified-waveform/v1";
  sourceSha256: string;
  sampleRate: number;
  sampleCount: number;
  minimum: Float32Array;
  maximum: Float32Array;
}
export interface MusicDawWaveformBar { low: number; high: number }

export function analyzeMusicDawWaveform(
  channels: Float32Array[], sampleRate: number, sourceSha256: string,
  binsPerSecond = 24,
): MusicDawWaveformEnvelope {
  const frames = channels[0]?.length ?? 0;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      !Number.isFinite(binsPerSecond) || binsPerSecond < 1 || binsPerSecond > 120 ||
      !/^[a-f0-9]{64}$/i.test(sourceSha256) ||
      ![1, 2].includes(channels.length) || !frames ||
      frames > 30 * 60 * 192000 || channels.some(c => c.length !== frames)) {
    throw new Error("MUSIC_DAW_WAVEFORM_SOURCE_INVALID");
  }
  const count=Math.min(frames,8192,Math.max(64,Math.ceil(frames / sampleRate * binsPerSecond)));
  const minimum=new Float32Array(count), maximum=new Float32Array(count);
  for(let i=0;i<count;i++){
    let low=Infinity,high=-Infinity;
    const a=Math.floor(i*frames/count);
    const b=Math.max(a+1,Math.floor((i+1)*frames/count));
    for(const channel of channels){
      for(let f=a;f<b;f++){
        const v=channel[f]!;
        if(!Number.isFinite(v))throw new Error("MUSIC_DAW_WAVEFORM_PCM_NONFINITE");
        if(v<low)low=v;
        if(v>high)high=v;
      }
    }
    minimum[i]=low;maximum[i]=high;
  }
  return {schema:"jhadina-daw-verified-waveform/v1",
    sourceSha256:sourceSha256.toLowerCase(),sampleRate,
    sampleCount:frames,minimum,maximum};
}

/** Region positions are based on SOURCE sample clock, not display clock.
 * Split/trim/slip/copy correctly show the specific samples now referenced. */
export function sampleMusicDawClipWaveform(
  envelope: MusicDawWaveformEnvelope, clip: MusicDawClip, bars = 90,
): MusicDawWaveformBar[] {
  if(!envelope||envelope.schema!=="jhadina-daw-verified-waveform/v1"||
     !Number.isSafeInteger(bars)||bars<1||bars>256||
     envelope.minimum.length!==envelope.maximum.length||
     !envelope.minimum.length||!Number.isFinite(clip.sourceOffsetSeconds)||
     !Number.isFinite(clip.startSeconds)||!Number.isFinite(clip.endSeconds)||
     clip.startSeconds<0||clip.endSeconds<=clip.startSeconds||
     clip.sourceOffsetSeconds<0||
     clip.sourceOffsetSeconds + (clip.endSeconds-clip.startSeconds) >
       envelope.sampleCount/envelope.sampleRate + .001) {
    throw new Error("MUSIC_DAW_WAVEFORM_CLIP_OR_SOURCE_INVALID");
  }
  const binCount=envelope.minimum.length;
  const sourceStart=clip.sourceOffsetSeconds*envelope.sampleRate;
  const clipFrames=(clip.endSeconds-clip.startSeconds)*envelope.sampleRate;
  const values:MusicDawWaveformBar[]=[];
  for(let x=0;x<bars;x++){
    const first=Math.max(0,Math.floor((sourceStart+x*clipFrames/bars)*binCount/envelope.sampleCount));
    const end=Math.min(binCount,Math.max(first+1,
      Math.ceil((sourceStart+(x+1)*clipFrames/bars)*binCount/envelope.sampleCount)));
    let low=0,high=0;
    for(let b=first;b<end;b++){
      low=Math.min(low,envelope.minimum[b]!);
      high=Math.max(high,envelope.maximum[b]!);
    }
    values.push({low:Math.max(-1,low),high:Math.min(1,high)});
  }
  return values;
}
