import {afterEach,describe,expect,it,vi} from "vitest"
import {HttpArtifactExtractor} from "./http-artifact-extractor"

const bytes=new TextEncoder().encode("hello")
const input={assetId:"artifact-1",sha256:"a".repeat(64),mimeType:"application/pdf",sizeBytes:bytes.byteLength,bytes}

afterEach(()=>vi.unstubAllGlobals())

describe("HttpArtifactExtractor",()=>{
 it("sends source bytes and hash through authenticated multipart",async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
   assetId:input.assetId,
   sourceSha256:input.sha256,
   mimeType:input.mimeType,
   text:"extracted body",
   metadata:{extractor:"test"},
   extractedAt:"2026-09-23T01:00:00Z",
  }),{status:200,headers:{"content-type":"application/json"}}))
  vi.stubGlobal("fetch",fetchMock)
  const extractor=new HttpArtifactExtractor("https://extractor.example/v1/extract","secret")
  await expect(extractor.extract(input)).resolves.toMatchObject({text:"extracted body",sourceSha256:input.sha256})
  const init=fetchMock.mock.calls[0]?.[1] as RequestInit
  expect((init.headers as Record<string,string>).authorization).toBe("Bearer secret")
  const form=init.body as FormData
  expect(form.get("expectedSha256")).toBe(input.sha256)
  expect(form.get("sizeBytes")).toBe(String(input.sizeBytes))
  expect(new Uint8Array(await (form.get("file") as Blob).arrayBuffer())).toEqual(bytes)
 })

 it("rejects extraction for different source bytes",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({
   assetId:input.assetId,
   sourceSha256:"0".repeat(64),
   mimeType:input.mimeType,
   text:"substituted",
   metadata:{extractor:"test"},
   extractedAt:"2026-09-23T01:00:00Z",
  }),{status:200,headers:{"content-type":"application/json"}})))
  const extractor=new HttpArtifactExtractor("https://extractor.example/v1/extract","secret")
  await expect(extractor.extract(input)).rejects.toThrow("ARTIFACT_EXTRACTOR_INVALID_RESPONSE")
 })
})
