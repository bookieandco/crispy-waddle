import { afterEach, describe, expect, it, vi } from "vitest"
import { HttpMediaSecurityScanner } from "./http-media-security-scanner"

const bytes=new TextEncoder().encode("hello")
const input={
 assetId:"artifact-1",
 uri:"supabase-private://bucket/path",
 mimeType:"text/plain",
 sizeBytes:bytes.byteLength,
 sha256:"a".repeat(64),
 bytes,
}

afterEach(()=>vi.unstubAllGlobals())

describe("HttpMediaSecurityScanner",()=>{
 it("sends original bytes and hash through authenticated multipart",async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
   assetId:input.assetId,
   sha256:input.sha256,
   verdict:"clean",
   mimeType:input.mimeType,
   sizeBytes:input.sizeBytes,
   reasons:[],
   scannedAt:"2026-09-23T00:00:00Z",
  }),{status:200,headers:{"content-type":"application/json"}}))
  vi.stubGlobal("fetch",fetchMock)
  const scanner=new HttpMediaSecurityScanner("https://scanner.example/v1/scan","secret")
  await expect(scanner.scan(input)).resolves.toMatchObject({verdict:"clean",sha256:input.sha256})

  const init=fetchMock.mock.calls[0]?.[1] as RequestInit
  expect((init.headers as Record<string,string>).authorization).toBe("Bearer secret")
  const form=init.body as FormData
  expect(form.get("assetId")).toBe(input.assetId)
  expect(form.get("expectedSha256")).toBe(input.sha256)
  expect(form.get("sizeBytes")).toBe(String(input.sizeBytes))
  const uploaded=form.get("file")
  expect(uploaded).toBeInstanceOf(Blob)
  expect(new Uint8Array(await (uploaded as Blob).arrayBuffer())).toEqual(bytes)
 })

 it("rejects a clean response that does not match the scanned artifact",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({
   assetId:input.assetId,
   sha256:"0".repeat(64),
   verdict:"clean",
   mimeType:input.mimeType,
   sizeBytes:input.sizeBytes,
   reasons:[],
   scannedAt:"2026-09-23T00:00:00Z",
  }),{status:200,headers:{"content-type":"application/json"}})))
  const scanner=new HttpMediaSecurityScanner("https://scanner.example/v1/scan","secret")
  await expect(scanner.scan(input)).rejects.toThrow("MEDIA_SCANNER_INVALID_RESPONSE")
 })
})
