import {describe,expect,it} from "vitest"
import { detectArtifactMime } from "./detect-artifact-mime"

describe("artifact MIME detection",()=>{
 it("recognizes PDF content independent of filename",()=>expect(detectArtifactMime(new TextEncoder().encode("%PDF-1.7"),"application/pdf")).toBe("application/pdf"))
 it("recognizes JSON only when it parses",()=>expect(detectArtifactMime(new TextEncoder().encode('{"ok":true}'),"application/json")).toBe("application/json"))
 it("preserves an MP4 container as audio when declared audio/mp4",()=>{
  const bytes=new Uint8Array([0,0,0,20,102,116,121,112,109,112,52,50])
  expect(detectArtifactMime(bytes,"audio/mp4")).toBe("audio/mp4")
  expect(detectArtifactMime(bytes,"video/mp4")).toBe("video/mp4")
 })
 it("recognizes OOXML subtype from ZIP member names",()=>{
  const docx=new TextEncoder().encode("PK\u0003\u0004xxxxword/document.xml")
  const xlsx=new TextEncoder().encode("PK\u0003\u0004xxxxxl/workbook.xml")
  expect(detectArtifactMime(docx,"application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toContain("wordprocessingml")
  expect(detectArtifactMime(xlsx,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toContain("spreadsheetml")
 })
 it("rejects unknown binary content",()=>expect(()=>detectArtifactMime(new Uint8Array([0,1,2,3]),"application/octet-stream")).toThrow(/ARTIFACT_MIME_UNVERIFIED/))
})
