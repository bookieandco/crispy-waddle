/** Private full-song WAV import contract. No production migration or worker call.
 * Short-lived presigned storage upload paths are minted on server for a verified owner.
 * Finalization re-downloads and hashes the entire original before registration.
 */
import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createRestorationCase, type StoredRestorationArtifact} from "@jhadina/music-core";
import {SupabaseMusicRestorationArtifactStore,MUSIC_RESTORATION_BUCKET} from "./restoration-supabase-store";

export const DIRECT_WAV_MAX_BYTES=96*1024*1024;
export const DIRECT_WAV_MIN_BYTES=44;
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE=/^music-restoration:([0-9a-f-]{36})$/i;

export function normalizeDirectWavFileName(value:string):string {
  const name=value.trim();
  if(name.length<5||name.length>120||!/^[-a-zA-Z0-9_. ()]+\.wav$/i.test(name)||
    name.includes("..")||name.startsWith("."))throw new Error("MUSIC_DIRECT_FILE_NAME_INVALID");
  return name;
}
export function validateDirectUploadIntent(input:{
  fileName:string;sha256:string;sizeBytes:number;mimeType:string;
}){
  const fileName=normalizeDirectWavFileName(input.fileName);
  const sha256=input.sha256.toLowerCase();
  if(!HEX.test(sha256))throw new Error("MUSIC_DIRECT_SHA256_INVALID");
  if(!Number.isSafeInteger(input.sizeBytes)||input.sizeBytes<DIRECT_WAV_MIN_BYTES||
      input.sizeBytes>DIRECT_WAV_MAX_BYTES)throw new Error("MUSIC_DIRECT_SIZE_INVALID");
  if(!["audio/wav","audio/x-wav","audio/wave",""].includes(input.mimeType.toLowerCase()))
    throw new Error("MUSIC_DIRECT_WAV_ONLY");
  return {fileName,sha256,sizeBytes:input.sizeBytes,mimeType:"audio/wav" as const};
}
export function directWavPath(ownerId:string,caseId:string,sha256:string,fileName:string):string {
  if(!ID.test(ownerId)||!CASE.test(caseId)||!HEX.test(sha256)||
     !ID.test(caseId.slice("music-restoration:".length)))throw new Error("MUSIC_DIRECT_PATH_INVALID");
  const safeName=normalizeDirectWavFileName(fileName).replaceAll(" ","-");
  return [ownerId.toLowerCase(),caseId.replace(":","-").toLowerCase(),
    "source",sha256.toLowerCase(),safeName].join("/");
}
function word(bytes:Uint8Array,n:number){return String.fromCharCode(...bytes.subarray(n,n+4));}
export function inspectDirectWavHeader(prefix:Uint8Array,totalBytes:number){
  if(prefix.length<44||totalBytes<DIRECT_WAV_MIN_BYTES||
    totalBytes>DIRECT_WAV_MAX_BYTES)throw new Error("MUSIC_DIRECT_WAV_SIZE_INVALID");
  const v=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength);
  if(word(prefix,0)!=="RIFF"||word(prefix,8)!=="WAVE"||
      v.getUint32(4,true)+8!==totalBytes)throw new Error("MUSIC_DIRECT_WAV_RIFF_INVALID");
  let formatSeen=false;let format=0,channels=0,rate=0,align=0,bits=0;
  for(let pos=12;pos+8<=prefix.length;){
    const name=word(prefix,pos),len=v.getUint32(pos+4,true),start=pos+8,end=start+len;
    if(end>totalBytes)throw new Error("MUSIC_DIRECT_WAV_CHUNK_INVALID");
    if(name==="fmt "){
      if(formatSeen||len<16||end>prefix.length)throw new Error("MUSIC_DIRECT_WAV_FMT_INVALID");
      formatSeen=true;format=v.getUint16(start,true);channels=v.getUint16(start+2,true);
      rate=v.getUint32(start+4,true);align=v.getUint16(start+12,true);
      bits=v.getUint16(start+14,true);
      if(format!==1||![16,24,32].includes(bits)||channels<1||channels>2||
        rate<8000||rate>96000||align!==channels*(bits/8)||
        v.getUint32(start+8,true)!==rate*align)
        throw new Error("MUSIC_DIRECT_PCM_FORMAT_UNSUPPORTED");
    }
    if(name==="data"){
      if(!formatSeen||len===0||len%align!==0||
        end+(len&1)>totalBytes)throw new Error("MUSIC_DIRECT_WAV_DATA_INVALID");
      return {sampleRate:rate,channels,sampleCount:len/align,bitDepth:bits};
    }
    if(end>prefix.length)break;
    pos=end+(len&1);
  }
  throw new Error("MUSIC_DIRECT_WAV_HEADER_UNAVAILABLE");
}
export async function verifyStoredWav(input:{
  signedUrl:string;expectedHash:string;expectedBytes:number;
  fetcher?:typeof fetch;
}){
  const url=new URL(input.signedUrl);
  if(url.protocol!=="https:"||!/^([a-z0-9-]+)\.supabase\.co$/.test(url.hostname)||
     !url.pathname.startsWith("/storage/v1/object/sign/"))
    throw new Error("MUSIC_DIRECT_DOWNLOAD_URL_REJECTED");
  const response=await (input.fetcher??fetch)(url.href,{
    redirect:"error",cache:"no-store",signal:AbortSignal.timeout(120000),
  });
  if(!response.ok||!response.body)throw new Error("MUSIC_DIRECT_DOWNLOAD_FAILED");
  const stream=response.body.getReader();
  const hash=createHash("sha256");
  let seen=0,head=new Uint8Array(0);
  try{
    while(true){
      const {done,value}=await stream.read();
      if(done)break;
      if(!value)continue;
      seen+=value.byteLength;
      if(seen>input.expectedBytes||seen>DIRECT_WAV_MAX_BYTES)
        throw new Error("MUSIC_DIRECT_DOWNLOAD_SIZE_MISMATCH");
      hash.update(value);
      if(head.length<65536){
        const needed=Math.min(value.length,65536-head.length);
        const bigger=new Uint8Array(head.length+needed);
        bigger.set(head);bigger.set(value.subarray(0,needed),head.length);
        head=bigger;
      }
    }
  }finally{stream.releaseLock();}
  if(seen!==input.expectedBytes)throw new Error("MUSIC_DIRECT_DOWNLOAD_SIZE_MISMATCH");
  if(hash.digest("hex")!==input.expectedHash)
    throw new Error("MUSIC_DIRECT_DOWNLOAD_HASH_MISMATCH");
  return inspectDirectWavHeader(head,seen);
}
export async function finalizeDirectWav(input:{
  client:SupabaseClient;ownerUserId:string;caseId:string;
  fileName:string;sha256:string;sizeBytes:number;mimeType:string;
  fetcher?:typeof fetch;
}){
  const intent=validateDirectUploadIntent(input);
  const path=directWavPath(input.ownerUserId,input.caseId,intent.sha256,intent.fileName);
  const store=new SupabaseMusicRestorationArtifactStore(input.client,input.ownerUserId);
  const artifactId=`music-source:${input.caseId}:${intent.sha256.slice(0,24)}`;
  const existing=await store.getCase(input.caseId);
  if(existing){
    if(String(existing.source_artifact_id)!==artifactId)
      throw new Error("MUSIC_DIRECT_CASE_CONFLICT");
    const found=await store.get(input.ownerUserId,artifactId);
    if(found && found.contentHash===intent.sha256 &&
      found.sizeBytes===intent.sizeBytes &&
      found.storageUri===`supabase-private://${MUSIC_RESTORATION_BUCKET}/${path}`)
      return {caseId:input.caseId,artifactId,sha256:intent.sha256,
        sampleRate:found.sampleRate,channels:found.channels,sampleCount:found.sampleCount,
        alreadyRegistered:true};
    if(found)throw new Error("MUSIC_DIRECT_ARTIFACT_CONFLICT");
  }
  const {data,error}=await input.client.storage.from(MUSIC_RESTORATION_BUCKET)
    .createSignedUrl(path,60*10);
  if(error||!data?.signedUrl)throw new Error("MUSIC_DIRECT_SOURCE_UNAVAILABLE");
  const dimensions=await verifyStoredWav({signedUrl:data.signedUrl,
    expectedHash:intent.sha256,expectedBytes:intent.sizeBytes,fetcher:input.fetcher});
  const original=createRestorationCase({
    id:input.caseId,userId:input.ownerUserId,title:intent.fileName.replace(/\.wav$/i,""),
    sourceArtifactId:artifactId,
  });
  const artifact:StoredRestorationArtifact={
    id:artifactId,kind:"source",contentHash:intent.sha256,
    sampleRate:dimensions.sampleRate,channels:dimensions.channels,
    sampleCount:dimensions.sampleCount,createdAt:original.createdAt,
    ownerUserId:input.ownerUserId,caseId:input.caseId,
    storageUri:`supabase-private://${MUSIC_RESTORATION_BUCKET}/${path}`,
    mimeType:"audio/wav",sizeBytes:intent.sizeBytes,
  };
  if(!existing)await store.registerCase(original);
  await store.register(artifact);
  return {caseId:input.caseId,artifactId,sha256:intent.sha256,
    ...dimensions,alreadyRegistered:false};
}
