import {describe,it,expect} from "vitest";
import {createHash} from "node:crypto";
import {directWavPath,inspectDirectWavHeader,verifyStoredWav,
  validateDirectUploadIntent,DIRECT_WAV_MAX_BYTES} from "./direct-wav-upload";

function wav(frames=200,channels=2){
  const bytes=new Uint8Array(44+frames*channels*2);
  const v=new DataView(bytes.buffer);
  const text=(off:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(off+i,s.charCodeAt(i));};
  text(0,"RIFF");v.setUint32(4,bytes.length-8,true);text(8,"WAVE");
  text(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,channels,true);v.setUint32(24,48000,true);
  v.setUint32(28,48000*channels*2,true);v.setUint16(32,channels*2,true);
  v.setUint16(34,16,true);text(36,"data");v.setUint32(40,frames*channels*2,true);
  return bytes;
}
describe("direct owner WAV import integrity",()=>{
  it("scopes paths to auth uid, server-generated case and hash",()=>{
    const owner="f6d0ab0f-a35c-4523-9f10-a19ca63b2da5";
    const cid="music-restoration:608a309b-15d3-4e86-bd88-a4d85156d28a";
    const sha="f".repeat(64);
    expect(directWavPath(owner,cid,sha,"song.wav"))
      .toContain(owner+"/music-restoration-608a309b-15d3-4e86-bd88-a4d85156d28a/source/"+sha);
    expect(()=>directWavPath(owner,"music-restoration:../../etc",sha,"song.wav")).toThrow();
    expect(()=>directWavPath(owner,cid,sha,"../song.wav")).toThrow();
  });
  it("rejects oversized, non WAV and forged hashes before minting",()=>{
    expect(()=>validateDirectUploadIntent({fileName:"a.wav",sha256:"z".repeat(64),
      sizeBytes:100,mimeType:"audio/wav"})).toThrow("SHA256_INVALID");
    expect(()=>validateDirectUploadIntent({fileName:"song.wav",sha256:"a".repeat(64),
      sizeBytes:DIRECT_WAV_MAX_BYTES+1,mimeType:"audio/wav"})).toThrow("SIZE_INVALID");
    expect(()=>validateDirectUploadIntent({fileName:"song.mp3",sha256:"a".repeat(64),
      sizeBytes:100,mimeType:"audio/mpeg"})).toThrow();
  });
  it("reads genuine PCM dimensions and rejects forged RIFF/data structures",()=>{
    expect(inspectDirectWavHeader(wav(),wav().length))
      .toEqual({sampleRate:48000,channels:2,sampleCount:200,bitDepth:16});
    const forged=wav();new DataView(forged.buffer).setUint32(4,900,true);
    expect(()=>inspectDirectWavHeader(forged,forged.length)).toThrow("RIFF_INVALID");
    const malformed=wav();new DataView(malformed.buffer).setUint32(40,900,true);
    expect(()=>inspectDirectWavHeader(malformed,malformed.length)).toThrow("CHUNK_INVALID");
  });
  it("verifies streamed Storage bytes independently of browser receipt",async()=>{
    const bytes=wav(3400);
    const sha=createHash("sha256").update(bytes).digest("hex");
    const mock=async()=>new Response(new Blob([bytes]).stream(),{status:200});
    const signedUrl="https://kqbkaozfjubkjevdfvic.supabase.co/storage/v1/object/sign/jhadina-music-restoration/demo?token=fake";
    const checked=await verifyStoredWav({signedUrl,expectedHash:sha,
      expectedBytes:bytes.length,fetcher:mock as typeof fetch});
    expect(checked.sampleCount).toBe(3400);
    await expect(verifyStoredWav({signedUrl,expectedHash:"0".repeat(64),
      expectedBytes:bytes.length,fetcher:mock as typeof fetch}))
      .rejects.toThrow("HASH_MISMATCH");
    await expect(verifyStoredWav({signedUrl:"https://evil.example/fake",
      expectedHash:sha,expectedBytes:bytes.length,fetcher:mock as typeof fetch}))
      .rejects.toThrow("URL_REJECTED");
  });
});
