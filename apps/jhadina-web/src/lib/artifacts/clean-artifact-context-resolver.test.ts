import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {CleanArtifactContextResolver} from "./clean-artifact-context-resolver"

function client(rows:any[]){return{from:()=>({select:()=>({eq:()=>({in:async()=>({data:rows,error:null})})})})} as any}
describe("CleanArtifactContextResolver",()=>{
 it("admits clean owner artifact",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x.png",detected_mime_type:"image/png",status:"clean",scanned_at:"2026-01-01T00:00:00Z",extracted_text_ref:null}]),"u");const x=await r.resolve([{id:"a"}]);assert.equal(x[0]?.source,"durable-artifact")})
 it("rejects quarantined artifact",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x",detected_mime_type:"text/plain",status:"quarantine",scanned_at:null,extracted_text_ref:null}]),"u");await assert.rejects(()=>r.resolve([{id:"a"}]),/ARTIFACT_CONTEXT_NOT_CLEAN/)})
 it("rejects missing or foreign artifact",async()=>{const r=new CleanArtifactContextResolver(client([]),"u");await assert.rejects(()=>r.resolve([{id:"a"}]),/ARTIFACT_CONTEXT_NOT_FOUND/)})
})
