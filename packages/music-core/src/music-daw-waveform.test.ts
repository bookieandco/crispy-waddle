import { describe,expect,it } from "vitest";
import { analyzeMusicDawWaveform,sampleMusicDawClipWaveform } from "./music-daw-waveform.js";
const hash="a".repeat(64);
const region=(start:number,source:number,duration:number)=>({
  id:"clip",startSeconds:start,endSeconds:start+duration,sourceOffsetSeconds:source,
  fadeInSeconds:0,fadeOutSeconds:0,
});
describe("actual content-derived owner-scoped DAW waveform",()=>{
  it("renders the verified source's transient at the sample-relative time",()=>{
    const audio=new Float32Array(8000);
    audio[6000]=.9;audio[6001]=-.75;
    const e=analyzeMusicDawWaveform([audio],8000,hash,64);
    expect(e.sourceSha256).toBe(hash);
    const full=sampleMusicDawClipWaveform(e,region(0,0,1),64);
    expect(full.slice(46,50).some(v=>v.high>.8)).toBe(true);
    expect(full.slice(46,50).some(v=>v.low<-.7)).toBe(true);
    expect(full.slice(0,25).every(v=>v.low===0&&v.high===0)).toBe(true);
  });
  it("shows the right source material after a split, trim or copied clip",()=>{
    const audio=new Float32Array(16000);
    audio[2000]=.8; audio[11000]=-.6;
    const e=analyzeMusicDawWaveform([audio],8000,hash,64);
    const a=sampleMusicDawClipWaveform(e,region(0,0,1),48);
    const b=sampleMusicDawClipWaveform(e,region(8,1,1),48);
    expect(a.some(v=>v.high>.7)).toBe(true);
    expect(a.some(v=>v.low<-.5)).toBe(false);
    expect(b.some(v=>v.low<-.5)).toBe(true);
    expect(b.some(v=>v.high>.7)).toBe(false);
  });
  it("handles stereo dynamics but rejects corrupt PCM, source and clock",()=>{
    const left=new Float32Array(8000),right=new Float32Array(8000);
    right[3500]=-.4;left[3500]=.8;
    const e=analyzeMusicDawWaveform([left,right],8000,hash);
    expect(sampleMusicDawClipWaveform(e,region(0,0,1)).some(v=>v.low<-.3&&v.high>.7)).toBe(true);
    left[0]=Number.NaN;
    expect(()=>analyzeMusicDawWaveform([left,right],8000,hash)).toThrow("NONFINITE");
    expect(()=>analyzeMusicDawWaveform([right],8000,"forged")).toThrow("INVALID");
    expect(()=>sampleMusicDawClipWaveform(e,region(0,1,1))).toThrow("INVALID");
  });
});
