import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex, type StoredRestorationArtifact } from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

const MAX = 24*1024*1024;

function measureFloatWav(bytes:Uint8Array){
  if(bytes.length<48||bytes.length>MAX)throw new Error("MUSIC_DAW_NATIVE_WAV_SIZE_INVALID");
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(n:number)=>String.fromCharCode(...bytes.slice(n,n+4));
  if(text(0)!=="RIFF"||text(8)!=="WAVE")throw new Error("MUSIC_DAW_NATIVE_WAV_HEADER_INVALID");
  let fmt:{rate:number;channels:number;bits:number;align:number;format:number}|null=null;
  let frames=0,foundData=false;
  for(let off=12;off+8<=bytes.length;){
    const tag=text(off),size=d.getUint32(off+4,true),start=off+8;
    if(start+size>bytes.length)throw new Error("MUSIC_DAW_NATIVE_WAV_CHUNK_INVALID");
    if(tag==="fmt "){
      if(size<16)throw new Error("MUSIC_DAW_NATIVE_WAV_FMT_INVALID");
      fmt={format:d.getUint16(start,true),channels:d.getUint16(start+2,true),
        rate:d.getUint32(start+4,true),align:d.getUint16(start+12,true),
        bits:d.getUint16(start+14,true)};
    }
    if(tag==="data"){
      if(!fmt||fmt.format!==3||fmt.channels!==2||
         fmt.rate<8000||fmt.rate>192000||fmt.bits!==32||fmt.align!==8||
         size%8!==0||size===0)throw new Error("MUSIC_DAW_NATIVE_WAV_FLOAT_REQUIRED");
      frames=size/8;
      if(frames/fmt.rate>90)throw new Error("MUSIC_DAW_NATIVE_WAV_DURATION_INVALID");
      for(let i=start;i<start+size;i+=4){
        const v=d.getFloat32(i,true);
        if(!Number.isFinite(v)||Math.abs(v)>8)
          throw new Error("MUSIC_DAW_NATIVE_WAV_NONFINITE_OR_EXTREME");
      }
      foundData=true;
    }
    off=start+size+(size%2);
  }
  if(!fmt||!foundData||!frames)throw new Error("MUSIC_DAW_NATIVE_WAV_CONTENT_INVALID");
  return {sampleRate:fmt.rate,channels:fmt.channels,sampleCount:frames};
}

/** Owner-supplied local plugin DSP result is an UNVERIFIED processed candidate.
 * The case's immutable source, approved restoration version and certification
 * are NEVER modified by this import. Local process/identity is self-attested. */
export async function importOwnerLocalPluginRender(input:{
  client:SupabaseClient; ownerUserId:string; caseId:string;
  parentArtifactId:string; pluginId:string; sourceSha256:string;
  renderedSha256:string; renderedBytes:Uint8Array; approval:true;
  localReceipt:Record<string,unknown>;
}){
  if(!input.approval||!/^native-installed:[a-f0-9]{40}$/.test(input.pluginId)||
     !/^[a-f0-9]{64}$/i.test(input.sourceSha256)||
     !/^[a-f0-9]{64}$/i.test(input.renderedSha256))
    throw new Error("MUSIC_DAW_NATIVE_PLUGIN_OR_OWNER_APPROVAL_INVALID");
  const store=new SupabaseMusicRestorationArtifactStore(input.client,input.ownerUserId);
  const parent=await store.get(input.ownerUserId,input.parentArtifactId);
  if(!parent||parent.caseId!==input.caseId||parent.mimeType!=="audio/wav"||
     parent.contentHash.toLowerCase()!==input.sourceSha256.toLowerCase())
    throw new Error("MUSIC_DAW_NATIVE_SOURCE_OWNER_OR_SHA_MISMATCH");
  const {data,error}=await input.client.from("music_daw_sessions")
    .select("document").eq("case_id",input.caseId)
    .eq("owner_user_id",input.ownerUserId).single();
  if(error||!data)throw new Error("MUSIC_DAW_NATIVE_SAVE_PROJECT_BEFORE_RENDER");
  const tracks=((data.document as {tracks?:Array<{
    artifactId:string;pluginRack?:Array<{pluginId:string;format:string;enabled:boolean}>
  }>}).tracks??[]);
  const bound=tracks.find(t=>t.artifactId===parent.id)?.pluginRack?.some(p=>
    p.pluginId===input.pluginId&&p.enabled&&["vst3","au"].includes(p.format));
  if(!bound)throw new Error("MUSIC_DAW_NATIVE_PLUGIN_NOT_IN_SAVED_OWNER_SESSION");
  const receipt=input.localReceipt;
  if(receipt.sourceSha256!==input.sourceSha256 ||
     receipt.outputSha256!==input.renderedSha256 ||
     receipt.pluginId!==input.pluginId ||
     receipt.ownerApproved!==true ||
     receipt.sourceImmutable!==true ||
     receipt.originalRecovered!==false ||
     receipt.restorationCertified!==false ||
     receipt.nativePluginExecuted!==true ||
     receipt.effectIdentityAttested!==false){
    throw new Error("MUSIC_DAW_NATIVE_LOCAL_RECEIPT_NOT_SOURCE_BOUND");
  }
  if((await sha256Hex(input.renderedBytes)).toLowerCase()!==input.renderedSha256.toLowerCase())
    throw new Error("MUSIC_DAW_NATIVE_RENDER_SHA256_MISMATCH");
  const audio=measureFloatWav(input.renderedBytes);
  if(audio.sampleRate!==parent.sampleRate||audio.channels!==parent.channels||
     audio.sampleCount!==parent.sampleCount)
    throw new Error("MUSIC_DAW_NATIVE_RENDER_TIMEBASE_MISMATCH");
  const id="music-plugin-processed:"+crypto.randomUUID();
  const jobId="music-plugin-local:"+crypto.randomUUID();
  await store.createJob({
    id:jobId,caseId:input.caseId,kind:"repair",sourceArtifactId:parent.id,
    metadata:{operationClass:"plugin-processed",pluginId:input.pluginId,
      localHostOwnerAttestationOnly:true,needsHumanReview:true,
      restorationCertified:false,sourceSha256:input.sourceSha256,
      outputSha256:input.renderedSha256},
  });
  try{
    const saved=await store.putDerived({
      ownerUserId:input.ownerUserId,caseId:input.caseId,artifactId:id,
      parentArtifactId:parent.id,fileName:"plugin-processed.wav",
      mimeType:"audio/wav",sha256:input.renderedSha256,
      bytes:input.renderedBytes,role:"plugin-processed."+ (parent.role??"audio"),
    });
    const artifact:StoredRestorationArtifact={
      id,ownerUserId:input.ownerUserId,caseId:input.caseId,kind:"derived",
      parentArtifactId:parent.id,role:"plugin-processed."+(parent.role??"audio"),
      contentHash:input.renderedSha256.toLowerCase(),storageUri:saved.storageUri,
      mimeType:"audio/wav",sizeBytes:input.renderedBytes.length,
      sampleRate:audio.sampleRate,channels:audio.channels,sampleCount:audio.sampleCount,
      runtimeReceiptId:"owner-local-unverified:"+input.renderedSha256.slice(0,16),
      createdAt:new Date().toISOString(),
    };
    await store.register(artifact);
    await store.completeJob({id:jobId,outputArtifactIds:[id],
      runtimeReceiptId:artifact.runtimeReceiptId,
      metadata:{outputArtifactId:id,pluginId:input.pluginId,
        localHostOwnerAttestationOnly:true,needsHumanReview:true,restorationCertified:false},
    });
    return {artifactId:id,jobId,parentArtifactId:parent.id,
      outputSha256:input.renderedSha256,needsHumanReview:true,
      restorationCertified:false,localHostOwnerAttestationOnly:true};
  }catch(e){
    await store.failJob(jobId,e instanceof Error?e.message:"Native plugin candidate import failed");
    throw e;
  }
}
