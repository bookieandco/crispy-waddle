import type { SupabaseClient } from "@supabase/supabase-js"
import { DIRECT_CONTEXT_MIME,EXTRACTABLE_CONTEXT_MIME,HttpArtifactExtractor } from "./http-artifact-extractor"
import { SupabaseArtifactDerivativeStore,SupabaseArtifactRepository } from "./supabase-artifact-adapters"

export type ArtifactExtractionStatus="not_required"|"pending"|"ready"|"unsupported"
export type ArtifactRuntimeState={
 id:string
 name:string
 mimeType:string
 sizeBytes:number
 status:"quarantine"|"clean"|"rejected"|"needs_review"
 contextReady:boolean
 extractionStatus:ArtifactExtractionStatus
}

type ArtifactRow={
 id:string
 owner_user_id:string
 original_name:string
 detected_mime_type:string|null
 size_bytes:number|string
 sha256:string
 storage_bucket:string
 storage_path:string
 status:ArtifactRuntimeState["status"]
 extracted_text_ref:string|null
}

const SELECT="id,owner_user_id,original_name,detected_mime_type,size_bytes,sha256,storage_bucket,storage_path,status,extracted_text_ref"

export function artifactRuntimeState(row:Pick<ArtifactRow,"id"|"original_name"|"detected_mime_type"|"size_bytes"|"status"|"extracted_text_ref">):ArtifactRuntimeState{
 const mimeType=String(row.detected_mime_type??"")
 const clean=row.status==="clean"
 const direct=clean&&DIRECT_CONTEXT_MIME.has(mimeType)
 const extractable=clean&&EXTRACTABLE_CONTEXT_MIME.has(mimeType)
 const extracted=extractable&&Boolean(row.extracted_text_ref)
 return{
  id:row.id,
  name:row.original_name,
  mimeType,
  sizeBytes:Number(row.size_bytes),
  status:row.status,
  contextReady:direct||extracted,
  extractionStatus:direct?"not_required":extracted?"ready":extractable?"pending":"unsupported",
 }
}

async function loadOwnerArtifact(client:SupabaseClient,ownerUserId:string,artifactId:string):Promise<ArtifactRow>{
 const {data,error}=await client.from("jhadina_artifacts").select(SELECT).eq("id",artifactId).eq("owner_user_id",ownerUserId).single()
 if(error||!data)throw new Error("ARTIFACT_NOT_FOUND")
 return data as ArtifactRow
}

export async function getArtifactRuntimeState(client:SupabaseClient,ownerUserId:string,artifactId:string):Promise<ArtifactRuntimeState>{
 return artifactRuntimeState(await loadOwnerArtifact(client,ownerUserId,artifactId))
}

export async function retryArtifactExtraction(input:{
 client:SupabaseClient
 ownerUserId:string
 artifactId:string
 extractorUrl:string
 extractorToken:string
}):Promise<ArtifactRuntimeState>{
 const row=await loadOwnerArtifact(input.client,input.ownerUserId,input.artifactId)
 const current=artifactRuntimeState(row)
 if(row.status!=="clean")throw new Error("ARTIFACT_EXTRACTION_REQUIRES_CLEAN")
 if(current.contextReady)return current
 if(!EXTRACTABLE_CONTEXT_MIME.has(current.mimeType))throw new Error("ARTIFACT_EXTRACTION_MIME_UNSUPPORTED")

 const {data,error}=await input.client.storage.from(row.storage_bucket).download(row.storage_path)
 if(error||!data)throw new Error(`ARTIFACT_SOURCE_DOWNLOAD_FAILED: ${error?.message??"missing object"}`)
 const bytes=new Uint8Array(await data.arrayBuffer())
 if(bytes.byteLength!==Number(row.size_bytes))throw new Error("ARTIFACT_SOURCE_SIZE_MISMATCH")
 const sha256=await digestSha256(bytes)
 if(sha256!==row.sha256)throw new Error("ARTIFACT_SOURCE_HASH_MISMATCH")

 const extractor=new HttpArtifactExtractor(input.extractorUrl,input.extractorToken)
 const extraction=await extractor.extract({
  assetId:row.id,
  sha256:row.sha256,
  mimeType:current.mimeType,
  sizeBytes:bytes.byteLength,
  bytes,
 })
 const derivative=await new SupabaseArtifactDerivativeStore(input.client).putExtractedText(input.ownerUserId,row.id,extraction.text)
 await new SupabaseArtifactRepository(input.client,input.ownerUserId).applyExtraction(row.id,{
  extractedTextRef:derivative.uri,
  derivativeRefs:[derivative.uri],
 })
 return getArtifactRuntimeState(input.client,input.ownerUserId,row.id)
}

async function digestSha256(bytes:Uint8Array):Promise<string>{
 const copy=new Uint8Array(bytes.byteLength)
 copy.set(bytes)
 const digest=await crypto.subtle.digest("SHA-256",copy)
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")
}
