import {describe,expect,it} from "vitest"
import { detectArtifactMime } from "./detect-artifact-mime"

describe("artifact MIME detection",()=>{
 it("recognizes PDF content independent of filename",()=>expect(detectArtifactMime(new TextEncoder().encode("%PDF-1.7"),"application/pdf")).toBe("application/pdf"))
 it("rejects unknown binary content",()=>expect(()=>detectArtifactMime(new Uint8Array([0,1,2,3]),"application/octet-stream")).toThrow(/ARTIFACT_MIME_UNVERIFIED/))
})
