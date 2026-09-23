import {describe,expect,it} from "vitest"
import {artifactRuntimeState} from "./artifact-extraction-runtime"

const base={
 id:"artifact-1",
 original_name:"file.pdf",
 detected_mime_type:"application/pdf",
 size_bytes:123,
 status:"clean" as const,
 extracted_text_ref:null as string|null,
}

describe("artifactRuntimeState",()=>{
 it("marks direct clean text context-ready without extraction",()=>{
  expect(artifactRuntimeState({...base,original_name:"note.txt",detected_mime_type:"text/plain"})).toMatchObject({
   contextReady:true,
   extractionStatus:"not_required",
  })
 })

 it("marks clean extractable files pending until a derivative exists",()=>{
  expect(artifactRuntimeState(base)).toMatchObject({
   contextReady:false,
   extractionStatus:"pending",
  })
 })

 it("marks a clean extracted artifact ready",()=>{
  expect(artifactRuntimeState({...base,extracted_text_ref:"supabase-private://jhadina-artifact-derived/u/a/extracted.txt"})).toMatchObject({
   contextReady:true,
   extractionStatus:"ready",
  })
 })

 it("never admits non-clean artifacts even if a derivative reference exists",()=>{
  expect(artifactRuntimeState({...base,status:"quarantine",extracted_text_ref:"supabase-private://jhadina-artifact-derived/u/a/extracted.txt"})).toMatchObject({
   contextReady:false,
   extractionStatus:"unsupported",
  })
 })
})
