export type ArtifactExtractionResult={
 assetId:string
 sourceSha256:string
 mimeType:string
 text:string
 metadata:Record<string,unknown>
 extractedAt:string
}

export type ArtifactExtractionInput={
 assetId:string
 sha256:string
 mimeType:string
 sizeBytes:number
 bytes:Uint8Array
}

export class HttpArtifactExtractor{
 constructor(private readonly endpoint:string,private readonly bearerToken:string){}
 async extract(input:ArtifactExtractionInput):Promise<ArtifactExtractionResult>{
  if(!this.endpoint||!this.bearerToken)throw new Error("ARTIFACT_EXTRACTOR_NOT_CONFIGURED")
  const uploadBytes=new Uint8Array(input.bytes.byteLength);uploadBytes.set(input.bytes)
  const form=new FormData()
  form.set("assetId",input.assetId)
  form.set("mimeType",input.mimeType)
  form.set("sizeBytes",String(input.sizeBytes))
  form.set("expectedSha256",input.sha256)
  form.set("file",new Blob([uploadBytes],{type:input.mimeType}),input.assetId)
  const response=await fetch(this.endpoint,{method:"POST",headers:{authorization:`Bearer ${this.bearerToken}`},body:form,signal:AbortSignal.timeout(120_000)})
  if(!response.ok)throw new Error(`ARTIFACT_EXTRACTOR_HTTP_${response.status}`)
  const body=await response.json() as Partial<ArtifactExtractionResult>
  if(body.assetId!==input.assetId||body.sourceSha256!==input.sha256||body.mimeType!==input.mimeType||typeof body.text!=="string"||!body.extractedAt||!body.metadata||typeof body.metadata!=="object")throw new Error("ARTIFACT_EXTRACTOR_INVALID_RESPONSE")
  return body as ArtifactExtractionResult
 }
}

export const DIRECT_CONTEXT_MIME=new Set(["image/png","image/jpeg","text/plain"])
export const EXTRACTABLE_CONTEXT_MIME=new Set([
 "application/pdf",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 "text/csv",
 "application/json",
 "audio/wav",
 "audio/mpeg",
 "audio/mp4",
 "audio/webm",
 "video/mp4",
 "video/webm",
])
