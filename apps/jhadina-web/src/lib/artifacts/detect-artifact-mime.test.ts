import { describe,it } from "node:test"
import assert from "node:assert/strict"
import { detectArtifactMime } from "./detect-artifact-mime"

describe("artifact MIME detection",()=>{
 it("recognizes PDF content independent of filename",()=>assert.equal(detectArtifactMime(new TextEncoder().encode("%PDF-1.7"),"application/pdf"),"application/pdf"))
 it("rejects unknown binary content",()=>assert.throws(()=>detectArtifactMime(new Uint8Array([0,1,2,3]),"application/octet-stream"),/ARTIFACT_MIME_UNVERIFIED/))
})
