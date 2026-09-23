import type { MediaSecurityScanner, MediaScanInput, MediaScanResult } from "@jhadina/security-core"

export class HttpMediaSecurityScanner implements MediaSecurityScanner {
 constructor(private readonly endpoint:string,private readonly bearerToken:string){}
 async scan(input:MediaScanInput):Promise<MediaScanResult>{
  if(!this.endpoint||!this.bearerToken) throw new Error("MEDIA_SCANNER_NOT_CONFIGURED")
  const form=new FormData()
  form.set("assetId",input.assetId)
  form.set("mimeType",input.mimeType)
  form.set("sizeBytes",String(input.sizeBytes))
  form.set("expectedSha256",input.sha256)
  form.set("file",new Blob([input.bytes],{type:input.mimeType}),input.assetId)
  const response=await fetch(this.endpoint,{
   method:"POST",
   headers:{authorization:`Bearer ${this.bearerToken}`},
   body:form,
   signal:AbortSignal.timeout(60_000),
  })
  if(!response.ok) throw new Error(`MEDIA_SCANNER_HTTP_${response.status}`)
  const body=await response.json() as Partial<MediaScanResult>
  if(
   body.assetId!==input.assetId||
   body.sha256!==input.sha256||
   body.mimeType!==input.mimeType||
   body.sizeBytes!==input.sizeBytes||
   !body.scannedAt||
   !Array.isArray(body.reasons)||
   !["clean","quarantine","rejected","needs_review"].includes(body.verdict??"")
  ) throw new Error("MEDIA_SCANNER_INVALID_RESPONSE")
  return body as MediaScanResult
 }
}
