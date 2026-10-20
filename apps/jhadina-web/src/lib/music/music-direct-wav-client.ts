/** Direct private WAV upload from iPhone Safari; no audio bytes through Next.js.
 * Small files use signed Storage upload; >6 MiB use TUS 6 MiB chunks
 * with per-chunk progress and bounded offset reconciliation on interruptions.
 * No audio touches the AI worker or a public bucket.
 */
import {createClient} from "@/lib/supabase/client";
import {getSupabasePublicConfig} from "@/lib/supabase/public-config";

type Ticket={success:boolean;caseId:string;path:string;token:string;bucket:string;maxBytes:number};
export type DirectWavResult={restorationCase:{id:string};sourceArtifact:{id:string;sha256:string};
  mode:string;workerUsed:false;restorationCertified:false};
const CHUNK=6*1024*1024;
const LIMIT=96*1024*1024;
const hex=(data:ArrayBuffer)=>[...new Uint8Array(data)]
  .map(v=>v.toString(16).padStart(2,"0")).join("");
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const b64=(v:string)=>btoa(v);
const metadata=(pairs:Record<string,string>)=>Object.entries(pairs)
  .map(([k,v])=>k+" "+b64(v)).join(",");
function tusOrigin():string {
  const url=new URL(getSupabasePublicConfig().url);
  if(url.protocol!=="https:"||!/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname))
    throw new Error("MUSIC_DIRECT_TUS_ORIGIN_REJECTED");
  url.hostname=url.hostname.replace(/\.supabase\.co$/,".storage.supabase.co");
  return url.origin;
}
function validateTusLocation(value:string,endpoint:string):string {
  const candidate=new URL(value,endpoint);
  if(candidate.origin!==new URL(endpoint).origin||
    !candidate.pathname.startsWith("/storage/v1/upload/resumable/")||
    candidate.username||candidate.password)
    throw new Error("MUSIC_DIRECT_TUS_LOCATION_REJECTED");
  return candidate.href;
}
async function tusSend(file:File,ticket:Ticket,onProgress:(pct:number)=>void){
  const endpoint=tusOrigin()+"/storage/v1/upload/resumable";
  const base={"Tus-Resumable":"1.0.0","x-signature":ticket.token};
  const started=await fetch(endpoint,{
    method:"POST",redirect:"error",headers:{
      ...base,"Upload-Length":String(file.size),
      "Upload-Metadata":metadata({
        bucketName:ticket.bucket,objectName:ticket.path,
        contentType:"audio/wav",cacheControl:"31536000",
      }),
    },
  });
  if(started.status!==201)throw new Error("MUSIC_DIRECT_TUS_CREATE_FAILED");
  const location=started.headers.get("Location");
  if(!location)throw new Error("MUSIC_DIRECT_TUS_LOCATION_MISSING");
  const url=validateTusLocation(location,endpoint);
  let offset=0;
  while(offset<file.size){
    const target=Math.min(file.size,offset+CHUNK);
    let nextOffset=offset;
    let ok=false;
    for(let attempt=0;attempt<4&&!ok;attempt++){
      try{
        const part=file.slice(nextOffset,target);
        const result=await fetch(url,{
          method:"PATCH",redirect:"error",headers:{
            ...base,"Upload-Offset":String(nextOffset),
            "Content-Type":"application/offset+octet-stream",
          },
          body:part,
        });
        if(result.status===204){
          const accepted=Number(result.headers.get("Upload-Offset"));
          if(!Number.isSafeInteger(accepted)||accepted!==target)
            throw new Error("MUSIC_DIRECT_TUS_OFFSET_INVALID");
          offset=accepted;ok=true;
          onProgress(Math.round(5+85*(offset/file.size)));
          break;
        }
        if(![408,409,429,500,502,503,504].includes(result.status))
          throw new Error("MUSIC_DIRECT_TUS_CHUNK_REJECTED");
      }catch(error){
        if(error instanceof Error &&
          /MUSIC_DIRECT_TUS_(OFFSET_INVALID|CHUNK_REJECTED)/.test(error.message))
          throw error;
      }
      if(attempt===3)break;
      await delay((attempt+1)*1000);
      const head=await fetch(url,{method:"HEAD",redirect:"error",headers:base});
      if(!head.ok)continue;
      const found=Number(head.headers.get("Upload-Offset"));
      if(!Number.isSafeInteger(found)||found<nextOffset||found>target)
        throw new Error("MUSIC_DIRECT_TUS_OFFSET_INVALID");
      nextOffset=found;
      // A committed chunk whose PATCH response was lost must not be sent
      // again at a new offset. Resume exactly the unacknowledged remainder.
      if(found===target){
        offset=found;ok=true;
        onProgress(Math.round(5+85*offset/file.size));
      }
    }
    if(!ok)throw new Error("MUSIC_DIRECT_TUS_RETRY_EXHAUSTED");
  }
}
export async function uploadPrivateDirectWav(input:{
  file:File;userId:string;onProgress?:(pct:number)=>void;
}):Promise<DirectWavResult>{
  const file=input.file;
  if(!/\.wav$/i.test(file.name)||file.size<44||file.size>LIMIT)
    throw new Error("MUSIC_DIRECT_WAV_FILE_OR_SIZE_INVALID");
  const onProgress=input.onProgress??(()=>{});
  onProgress(1);
  const sha256=hex(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()));
  onProgress(4);
  const inputBody={fileName:file.name,mimeType:file.type,
    sha256,sizeBytes:file.size};
  const call=async(body:Record<string,unknown>)=>{
    const response=await fetch("/api/music/restoration/direct-upload",{
      method:"POST",cache:"no-store",headers:{
        "content-type":"application/json","x-jhadina-user-id":input.userId,
      },body:JSON.stringify(body),
    });
    const data=await response.json() as Record<string,unknown>;
    if(!response.ok)throw new Error(String(data.error??"MUSIC_DIRECT_API_FAILED"));
    return data;
  };
  const ticket=await call({action:"ticket",...inputBody}) as Ticket;
  if(!ticket.success||ticket.maxBytes<file.size||
    !ticket.path||!ticket.token)throw new Error("MUSIC_DIRECT_TICKET_INVALID");
  if(file.size<=CHUNK){
    const {error}=await createClient().storage.from(ticket.bucket)
      .uploadToSignedUrl(ticket.path,ticket.token,file,{
        contentType:"audio/wav",upsert:false,
      });
    if(error)throw new Error("MUSIC_DIRECT_SIGNED_UPLOAD_FAILED");
    onProgress(90);
  }else{
    await tusSend(file,ticket,onProgress);
  }
  const confirmed=await call({action:"finalize",caseId:ticket.caseId,...inputBody});
  if(confirmed.mode!=="direct-private-wav"||confirmed.workerUsed!==false||
     !confirmed.restorationCase)throw new Error("MUSIC_DIRECT_FINALIZE_RECEIPT_INVALID");
  onProgress(100);
  return confirmed as unknown as DirectWavResult;
}
