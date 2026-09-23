import { MEDIA_SECURITY_RULES, assertSafeMedia, type MediaScanResult, type MediaSecurityScanner } from "@jhadina/security-core"

export type ArtifactStatus="quarantine"|"clean"|"rejected"|"needs_review"
export interface ArtifactRecord {
 id:string; ownerUserId:string; originalName:string; declaredMimeType:string; detectedMimeType?:string;
 sizeBytes:number; sha256:string; storageBucket:string; storagePath:string; status:ArtifactStatus;
 scanReasons:string[]; provenance:Record<string,unknown>; derivativeRefs:string[];
}
export interface ArtifactRepository {
 createQuarantined(input:Omit<ArtifactRecord,"status"|"scanReasons"|"derivativeRefs">):Promise<ArtifactRecord>
 applyScan(assetId:string,result:MediaScanResult):Promise<ArtifactRecord>
}
export interface ArtifactBlobStore { putQuarantine(path:string,bytes:Uint8Array,contentType:string):Promise<{bucket:string;path:string;uri:string}> }

const MAX_BYTES=250*1024*1024
export class UniversalArtifactCore {
 constructor(private readonly blobs:ArtifactBlobStore,private readonly repo:ArtifactRepository,private readonly scanner:MediaSecurityScanner){}
 async ingest(input:{ownerUserId:string;name:string;declaredMimeType:string;detectedMimeType:string;bytes:Uint8Array;provenance?:Record<string,unknown>}){
  if(!input.bytes.length||input.bytes.length>MAX_BYTES) throw new Error("ARTIFACT_SIZE_NOT_ADMITTED")
  if(!input.detectedMimeType||input.detectedMimeType==="application/octet-stream") throw new Error("ARTIFACT_MIME_UNVERIFIED")
  if(input.declaredMimeType!==input.detectedMimeType) throw new Error("ARTIFACT_MIME_MISMATCH")
  const hashInput=new Uint8Array(input.bytes.byteLength)
  hashInput.set(input.bytes)
  const digest=await crypto.subtle.digest("SHA-256",hashInput)
  const sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")
  const id=crypto.randomUUID(); const safeName=input.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,180)
  const stored=await this.blobs.putQuarantine(`${input.ownerUserId}/${id}/${safeName}`,input.bytes,input.detectedMimeType)
  const record=await this.repo.createQuarantined({id,ownerUserId:input.ownerUserId,originalName:safeName,declaredMimeType:input.declaredMimeType,detectedMimeType:input.detectedMimeType,sizeBytes:input.bytes.length,sha256,storageBucket:stored.bucket,storagePath:stored.path,provenance:input.provenance??{}})
  let scan:MediaScanResult
  try { scan=await this.scanner.scan({assetId:id,uri:stored.uri,mimeType:input.detectedMimeType,sizeBytes:input.bytes.length,sha256,bytes:input.bytes}) }
  catch { return record } // scanner failure stays quarantined
  if(scan.assetId!==id||scan.sha256!==sha256||scan.mimeType!==input.detectedMimeType||scan.sizeBytes!==input.bytes.length) return record
  const updated=await this.repo.applyScan(id,scan)
  if(scan.verdict==="clean") assertSafeMedia(scan)
  return updated
 }
}
export { MEDIA_SECURITY_RULES }
