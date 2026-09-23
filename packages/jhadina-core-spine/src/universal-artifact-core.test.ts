import { describe,it } from "node:test"
import assert from "node:assert/strict"
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
  assert.equal(result.status,"quarantine")
 })
 it("rejects MIME disagreement before storage",async()=>{
  let stored=false
  const core=new UniversalArtifactCore(
   {putQuarantine:async()=>{stored=true;throw new Error("no")}},
   {} as never,{} as never,
  )
  await assert.rejects(()=>core.ingest({...base,detectedMimeType:"application/pdf"}),/ARTIFACT_MIME_MISMATCH/)
  assert.equal(stored,false)
 })
})
