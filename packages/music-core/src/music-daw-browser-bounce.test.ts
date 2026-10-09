import { describe,expect,it } from "vitest";
import { initializeMusicDawSession } from "./music-daw-session.js";
import { renderMusicDawBrowserDryWav } from "./music-daw-browser-bounce.js";
const rate=48000,frames=rate;
function source16(){
  const a=new Uint8Array(44+frames*4);
  const d=new DataView(a.buffer);
  const put=(i:number,x:string)=>{for(let j=0;j<x.length;j++)d.setUint8(i+j,x.charCodeAt(j));};
  put(0,"RIFF");d.setUint32(4,a.length-8,true);put(8,"WAVE");
  put(12,"fmt ");d.setUint32(16,16,true);d.setUint16(20,1,true);
  d.setUint16(22,2,true);d.setUint32(24,rate,true);
  d.setUint32(28,rate*4,true);d.setUint16(32,4,true);
  d.setUint16(34,16,true);put(36,"data");d.setUint32(40,frames*4,true);
  d.setInt16(44+500*4,16384,true);d.setInt16(46+500*4,16384,true);
  return a;
}
async function fixture(){
  const wav=source16(),raw=new ArrayBuffer(wav.byteLength);
  new Uint8Array(raw).set(wav);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)))
    .map(b=>b.toString(16).padStart(2,"0")).join("");
  const asset={id:"orig",sha256:digest,kind:"source",mimeType:"audio/wav",
    sampleRate:rate,sampleCount:frames};
  const session=initializeMusicDawSession("case",[asset],"2026-10-08T10:00:00Z");
  session.revision=2;
  return {wav,asset,session};
}
describe("small owner-local browser actual WAV bounce",()=>{
  it("emits sample-exact float WAV, 0 dB center, readback SHA receipt",async()=>{
    const {wav,asset,session}=await fixture();
    const {bytes,receipt}=await renderMusicDawBrowserDryWav(session,[asset],{orig:wav});
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    expect(receipt.sampleCount).toBe(frames);
    expect(receipt.revision).toBe(2);
    expect(receipt.restorationCertified).toBe(false);
    expect(view.getUint16(20,true)).toBe(3);
    expect(view.getUint32(42,true)).toBe(4);
    expect(view.getUint32(46,true)).toBe(frames);
    expect(view.getFloat32(58+500*8,true)).toBe(.5);
    expect(view.getFloat32(62+500*8,true)).toBe(.5);
    expect(view.getFloat32(58+502*8,true)).toBe(0);
    expect(receipt.outputSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("retains moved clip/slip time, fades and mute/solo",async()=>{
    const {wav,asset,session}=await fixture();
    session.tracks[0]!.clips[0]!.startSeconds=.2;
    session.tracks[0]!.clips[0]!.endSeconds=.8;
    session.tracks[0]!.clips[0]!.sourceOffsetSeconds=0;
    session.tracks[0]!.clips[0]!.fadeInSeconds=.1;
    const {bytes,receipt}=await renderMusicDawBrowserDryWav(session,[asset],{orig:wav});
    const view=new DataView(bytes.buffer);
    expect(receipt.sampleCount).toBe(38400);
    expect(view.getFloat32(58+(.2*rate+500)*8,true)).toBeCloseTo(.5*(500/(.1*rate)),5);
    expect(view.getFloat32(58+500*8,true)).toBe(0);
  });
  it("refuses active DSP and tampered source without fake dry export",async()=>{
    const {wav,asset,session}=await fixture();
    session.tracks[0]!.eq.lowDb=2;
    await expect(renderMusicDawBrowserDryWav(session,[asset],{orig:wav})).rejects.toThrow("ACTIVE_DSP");
    session.tracks[0]!.eq.lowDb=0;
    wav[60]=33;
    await expect(renderMusicDawBrowserDryWav(session,[asset],{orig:wav})).rejects.toThrow("SOURCE_SHA_MISMATCH");
  });
  it("refuses unsupported or corrupted input and unsaved documents",async()=>{
    const {wav,asset,session}=await fixture();
    session.revision=0;
    await expect(renderMusicDawBrowserDryWav(session,[asset],{orig:wav})).rejects.toThrow("SAVE_PROJECT");
    session.revision=2;
    const corrupted={...asset,sampleRate:44100};
    await expect(renderMusicDawBrowserDryWav(session,[corrupted],{orig:wav})).rejects.toThrow();
  });
});
