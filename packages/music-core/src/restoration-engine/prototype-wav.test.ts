import {describe,it,expect,vi} from "vitest";
import {ingestRestorationPrototypeWav,MAX_MUSIC_PROTOTYPE_WAV_BYTES,
  type RestorationArtifactStore} from "./ingest-runtime.js";

function pcmWav(frames=128,channels=1) {
  const b=new Uint8Array(44+frames*channels*2);
  const v=new DataView(b.buffer);
  const tag=(offset:number,label:string)=>{for(let i=0;i<label.length;i++)
    v.setUint8(offset+i,label.charCodeAt(i));};
  tag(0,"RIFF");v.setUint32(4,b.length-8,true);tag(8,"WAVE");
  tag(12,"fmt ");v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,channels,true);
  v.setUint32(24,48000,true);v.setUint32(28,48000*channels*2,true);
  v.setUint16(32,channels*2,true);v.setUint16(34,16,true);
  tag(36,"data");v.setUint32(40,frames*channels*2,true);
  return b;
}
function harness() {
  const events:string[]=[];
  const store={
    get:vi.fn(async()=>undefined),
    putImmutableSource:vi.fn(async()=>{events.push("source");return{
      storageUri:"supabase-private://jhadina-music-restoration/owner/source/demo.wav",
      runtimeUri:"https://private.test/signed",
    };}),
    registerCase:vi.fn(async()=>{events.push("case");}),
    register:vi.fn(async()=>{events.push("artifact");}),
  } as unknown as RestorationArtifactStore;
  return {store,events};
}
const request=(store:RestorationArtifactStore,bytes:Uint8Array=pcmWav())=>({
  ownerUserId:"owner-001",caseId:"prototype-case-001",
  fileName:"my-take.wav",mimeType:"audio/wav",bytes,store,now:"2026-10-20T00:00:00Z",
});
describe("prototype WAV ingest, no AI worker",()=>{
 it("hashes real WAV bytes, preserves raw source and records owner case before artifact",async()=>{
  const {store,events}=harness();
  const result=await ingestRestorationPrototypeWav(request(store));
  expect(result.mode).toBe("prototype-wav");
  expect(result.workerUsed).toBe(false);
  expect(result.restorationCertified).toBe(false);
  expect(result.artifact.runtimeReceiptId).toBeUndefined();
  expect(result.fingerprint.sampleRateHz).toBe(48000);
  expect(result.fingerprint.channels).toBe(1);
  expect(result.artifact.contentHash).toMatch(/^[0-9a-f]{64}$/);
  expect(events).toEqual(["source","case","artifact"]);
  expect(store.putImmutableSource).toHaveBeenCalledWith(
    expect.objectContaining({ownerUserId:"owner-001",fileName:"my-take.wav",
       bytes:expect.any(Uint8Array)}));
 });
 it("fails closed for malformed RIFF before any persistence",async()=>{
  const {store,events}=harness();
  await expect(ingestRestorationPrototypeWav(request(store,new Uint8Array(512))))
    .rejects.toThrow("WAV_RIFF_INVALID");
  expect(events).toEqual([]);
 });
 it("rejects oversized uploads and suspicious MIME/extension mismatch",async()=>{
  const {store,events}=harness();
  await expect(ingestRestorationPrototypeWav(
    request(store,new Uint8Array(MAX_MUSIC_PROTOTYPE_WAV_BYTES+1))))
    .rejects.toThrow("MUSIC_PROTOTYPE_WAV_SIZE_INVALID");
  await expect(ingestRestorationPrototypeWav({...request(store),fileName:"track.mp3"}))
    .rejects.toThrow("MUSIC_PROTOTYPE_WAV_ONLY");
  expect(events).toEqual([]);
 });
 it("does not allow stereo-unready channel layouts or forged frame sizes",async()=>{
  const {store,events}=harness();
  await expect(ingestRestorationPrototypeWav(request(store,pcmWav(256,3))))
    .rejects.toThrow("MUSIC_PROTOTYPE_STEREO_96KHZ_MAX");
  const forged=pcmWav();new DataView(forged.buffer).setUint32(40,4096,true);
  await expect(ingestRestorationPrototypeWav(request(store,forged))).rejects.toThrow();
  expect(events).toEqual([]);
 });
});
