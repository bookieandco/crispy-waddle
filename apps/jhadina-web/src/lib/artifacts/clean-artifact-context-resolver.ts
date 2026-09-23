import type { SupabaseClient } from "@supabase/supabase-js"
import type { EphemeralArtifactContext } from "@jhadina/core-spine"

export type DurableArtifactRef={id:string}

const MAX_CONTEXT_IMAGE_BYTES=4_000_000
const MAX_CONTEXT_TEXT_BYTES=20_000
const DIRECT_IMAGE_MIME=new Set(["image/jpeg","image/png"])

export class CleanArtifactContextResolver{
 constructor(private readonly client:SupabaseClient,private readonly ownerUserId:string){}
 async resolve(refs:DurableArtifactRef[]):Promise<EphemeralArtifactContext[]>{
  if(!refs.length)return[]
  const ids=[...new Set(refs.map(r=>r.id).filter(Boolean))].slice(0,8)
  const {data,error}=await this.client.from("jhadina_artifacts").select("id,original_name,detected_mime_type,size_bytes,storage_bucket,storage_path,status,scanned_at,extracted_text_ref").eq("owner_user_id",this.ownerUserId).in("id",ids)
  if(error)throw new Error(`ARTIFACT_CONTEXT_READ_FAILED: ${error.message}`)
  const rows=data??[]
  const found=new Set(rows.map(r=>r.id))
  const missing=ids.filter(id=>!found.has(id));if(missing.length)throw new Error("ARTIFACT_CONTEXT_NOT_FOUND")
  const unclean=rows.filter(r=>r.status!=="clean");if(unclean.length)throw new Error("ARTIFACT_CONTEXT_NOT_CLEAN")

  const resolved:EphemeralArtifactContext[]=[]
  for(const row of rows){
   const mime=String(row.detected_mime_type??"")
   const base={id:row.id,mimeType:mime,source:"durable-artifact" as const,name:row.original_name,observedAt:row.scanned_at??new Date(0).toISOString()}
   if(DIRECT_IMAGE_MIME.has(mime)){
    if(Number(row.size_bytes)>MAX_CONTEXT_IMAGE_BYTES)throw new Error("ARTIFACT_CONTEXT_IMAGE_TOO_LARGE")
    const bytes=await this.download(row.storage_bucket,row.storage_path)
    resolved.push({...base,kind:"image",base64:Buffer.from(bytes).toString("base64")})
    continue
   }
   if(mime==="text/plain"){
    if(Number(row.size_bytes)>MAX_CONTEXT_TEXT_BYTES)throw new Error("ARTIFACT_CONTEXT_TEXT_TOO_LARGE")
    const bytes=await this.download(row.storage_bucket,row.storage_path)
    resolved.push({...base,kind:"text",text:new TextDecoder().decode(bytes).slice(0,MAX_CONTEXT_TEXT_BYTES)})
    continue
   }
   if(row.extracted_text_ref){
    resolved.push({...base,kind:"text",text:`[clean artifact extraction reference: ${row.extracted_text_ref}]`})
    continue
   }
   throw new Error("ARTIFACT_CONTEXT_REPRESENTATION_UNAVAILABLE")
  }
  return resolved
 }
 private async download(bucket:string,path:string):Promise<Uint8Array>{
  const {data,error}=await this.client.storage.from(bucket).download(path)
  if(error||!data)throw new Error(`ARTIFACT_CONTEXT_DOWNLOAD_FAILED: ${error?.message??"missing object"}`)
  return new Uint8Array(await data.arrayBuffer())
 }
}
