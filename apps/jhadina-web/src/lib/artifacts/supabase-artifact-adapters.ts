import type { SupabaseClient } from "@supabase/supabase-js"
import type { ArtifactBlobStore, ArtifactRecord, ArtifactRepository } from "@jhadina/core-spine"
import type { MediaScanResult } from "@jhadina/security-core"

export class SupabaseArtifactBlobStore implements ArtifactBlobStore {
 constructor(private readonly client:SupabaseClient,private readonly bucket="jhadina-artifact-quarantine"){}
 async putQuarantine(path:string,bytes:Uint8Array,contentType:string){
  const {error}=await this.client.storage.from(this.bucket).upload(path,bytes,{contentType,upsert:false})
  if(error) throw new Error(`ARTIFACT_QUARANTINE_UPLOAD_FAILED: ${error.message}`)
  return {bucket:this.bucket,path,uri:`supabase-private://${this.bucket}/${path}`}
 }
}

export class SupabaseArtifactDerivativeStore {
 constructor(private readonly client:SupabaseClient,private readonly bucket="jhadina-artifact-derived"){}
 async putExtractedText(ownerUserId:string,assetId:string,text:string){
  const bytes=new TextEncoder().encode(text)
  if(!bytes.length||bytes.length>10*1024*1024)throw new Error("ARTIFACT_DERIVATIVE_SIZE_NOT_ADMITTED")
  const path=`${ownerUserId}/${assetId}/extracted.txt`
  const {error}=await this.client.storage.from(this.bucket).upload(path,bytes,{contentType:"text/plain; charset=utf-8",upsert:true})
  if(error)throw new Error(`ARTIFACT_DERIVATIVE_WRITE_FAILED: ${error.message}`)
  return {bucket:this.bucket,path,uri:`supabase-private://${this.bucket}/${path}`,sizeBytes:bytes.length}
 }
}

export class SupabaseArtifactRepository implements ArtifactRepository {
 constructor(private readonly client:SupabaseClient,private readonly ownerUserId:string){}
 async createQuarantined(input:Omit<ArtifactRecord,"status"|"scanReasons"|"derivativeRefs">){
  if(input.ownerUserId!==this.ownerUserId) throw new Error("ARTIFACT_OWNER_MISMATCH")
  const row=toRow({...input,status:"quarantine" as const,scanReasons:[],derivativeRefs:[]})
  const {data,error}=await this.client.from("jhadina_artifacts").insert(row).select("*").single()
  if(error) throw new Error(`ARTIFACT_METADATA_WRITE_FAILED: ${error.message}`)
  return fromRow(data)
 }
 async applyScan(assetId:string,result:MediaScanResult){
  if(result.assetId!==assetId) throw new Error("ARTIFACT_SCAN_ID_MISMATCH")
  const {data,error}=await this.client.from("jhadina_artifacts").update({
   status:result.verdict,detected_mime_type:result.mimeType,sha256:result.sha256,
   scan_reasons:result.reasons,scanned_at:result.scannedAt,
  }).eq("id",assetId).eq("owner_user_id",this.ownerUserId).select("*").single()
  if(error) throw new Error(`ARTIFACT_SCAN_WRITE_FAILED: ${error.message}`)
  return fromRow(data)
 }
 async applyExtraction(assetId:string,input:{extractedTextRef:string;derivativeRefs:string[]}){
  const {data:current,error:readError}=await this.client.from("jhadina_artifacts").select("derivative_refs,status").eq("id",assetId).eq("owner_user_id",this.ownerUserId).single()
  if(readError)throw new Error(`ARTIFACT_EXTRACTION_READ_FAILED: ${readError.message}`)
  if(current?.status!=="clean")throw new Error("ARTIFACT_EXTRACTION_REQUIRES_CLEAN")
  const existing=Array.isArray(current.derivative_refs)?current.derivative_refs.filter((value:unknown):value is string=>typeof value==="string"):[]
  const derivativeRefs=[...new Set([...existing,...input.derivativeRefs])]
  const {data,error}=await this.client.from("jhadina_artifacts").update({extracted_text_ref:input.extractedTextRef,derivative_refs:derivativeRefs}).eq("id",assetId).eq("owner_user_id",this.ownerUserId).eq("status","clean").select("*").single()
  if(error)throw new Error(`ARTIFACT_EXTRACTION_WRITE_FAILED: ${error.message}`)
  return fromRow(data)
 }
}
function toRow(a:ArtifactRecord){return {id:a.id,owner_user_id:a.ownerUserId,original_name:a.originalName,declared_mime_type:a.declaredMimeType,detected_mime_type:a.detectedMimeType??null,size_bytes:a.sizeBytes,sha256:a.sha256,storage_bucket:a.storageBucket,storage_path:a.storagePath,status:a.status,scan_reasons:a.scanReasons,provenance:a.provenance,derivative_refs:a.derivativeRefs}}
function fromRow(r:any):ArtifactRecord{return {id:r.id,ownerUserId:r.owner_user_id,originalName:r.original_name,declaredMimeType:r.declared_mime_type,detectedMimeType:r.detected_mime_type??undefined,sizeBytes:Number(r.size_bytes),sha256:r.sha256,storageBucket:r.storage_bucket,storagePath:r.storage_path,status:r.status,scanReasons:Array.isArray(r.scan_reasons)?r.scan_reasons:[],provenance:r.provenance??{},derivativeRefs:Array.isArray(r.derivative_refs)?r.derivative_refs:[]}}
