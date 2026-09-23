import type { MediaSecurityScanner, MediaScanResult } from "@jhadina/security-core"

export class HttpMediaSecurityScanner implements MediaSecurityScanner {
 constructor(private readonly endpoint:string,private readonly bearerToken:string){}
 async scan(input:{assetId:string;uri:string;mimeType:string;sizeBytes:number}):Promise<MediaScanResult>{
  if(!this.endpoint||!this.bearerToken) throw new Error("MEDIA_SCANNER_NOT_CONFIGURED")
  const response=await fetch(this.endpoint,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${this.bearerToken}`},body:JSON.stringify(input),signal:AbortSignal.timeout(30_000)})
  if(!response.ok) throw new Error(`MEDIA_SCANNER_HTTP_${response.status}`)
  const body=await response.json() as Partial<MediaScanResult>
  if(body.assetId!==input.assetId||!body.sha256||!body.mimeType||!body.scannedAt||!Array.isArray(body.reasons)||!["clean","quarantine","rejected","needs_review"].includes(body.verdict??"")) throw new Error("MEDIA_SCANNER_INVALID_RESPONSE")
  return body as MediaScanResult
 }
}
