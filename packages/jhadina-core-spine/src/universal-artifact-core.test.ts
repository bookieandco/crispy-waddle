import { describe, expect, it } from "vitest"
import { UniversalArtifactCore } from "./universal-artifact-core.js"

const base={ownerUserId:"u1",name:"note.txt",declaredMimeType:"text/plain",detectedMimeType:"text/plain",bytes:new TextEncoder().encode("hello")}

describe("UniversalArtifactCore",()=>{
 it("keeps scanner failures quarantined",async()=>{
  const core=new UniversalArtifactCore(
   {putQuarantine:async(path)=>({bucket:"q",path,uri:`private://${path}`})},
   {createQuarantined:async(i)=>({...i,status:"quarantine",scanReasons:[],derivativeRefs:[]}),applyScan:async()=>{throw new Error("should not")}},
   {scan:async()=>{throw new Error("offline")}},
  )
  const result=await core.ingest(base)
  expect(result.status).toBe("quarantine")
 })
 it("rejects MIME disagreement before storage",async()=>{
  let stored=false
  const core=new UniversalArtifactCore(
   {putQuarantine:async()=>{stored=true;throw new Error("no")}},
   {} as never,{} as never,
  )
  await expect(core.ingest({...base,detectedMimeType:"application/pdf"})).rejects.toThrow(/ARTIFACT_MIME_MISMATCH/)
  expect(stored).toBe(false)
 })
})
