import {describe,it,expect} from "vitest";
import {inspectRestorationWav} from "./wav-integrity.js";
function wav(frames=200,rate=48000,channels=2){
  const bytes=new Uint8Array(44+frames*channels*2),v=new DataView(bytes.buffer);
  const word=(n:number,s:string)=>{for(let j=0;j<s.length;j++)v.setUint8(n+j,s.charCodeAt(j))};
  word(0,"RIFF");v.setUint32(4,bytes.length-8,true);word(8,"WAVE");
  word(12,"fmt ");v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,channels,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);
  v.setUint16(32,channels*2,true);v.setUint16(34,16,true);
  word(36,"data");v.setUint32(40,frames*channels*2,true);
  return bytes;
}
describe("untrusted WAV frame readback",()=>{
  it("measures exact dimensions from bytes, not receipt claims",()=>{
    expect(inspectRestorationWav(wav())).toEqual({sampleRate:48000,channels:2,sampleCount:200});
  });
  it("rejects truncated and forged RIFF lengths",()=>{
    expect(()=>inspectRestorationWav(wav().subarray(0,60))).toThrow();
    const forged=wav();new DataView(forged.buffer).setUint32(4,100,true);
    expect(()=>inspectRestorationWav(forged)).toThrow("RIFF_INVALID");
  });
});
