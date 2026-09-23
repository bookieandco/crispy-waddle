import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {CleanArtifactContextResolver} from "./clean-artifact-context-resolver"

function client(rows:any[],payload="hello"){return{
 from:()=>({select:()=>({eq:()=>({in:async()=>({data:rows,error:null})})})}),
 storage:{from:()=>({download:async()=>({data:new Blob([payload]),error:null})})},
} as any}

describe("CleanArtifactContextResolver",()=>{
 it("hydrates clean owner text artifact",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x.txt",detected_mime_type:"text/plain",size_bytes:5,storage_bucket:"b",storage_path:"p",status:"clean",scanned_at:"2026-01-01T00:00:00Z",extracted_text_ref:null}]),"u");const x=await r.resolve([{id:"a"}]);assert.equal(x[0]?.source,"durable-artifact");assert.equal(x[0]?.text,"hello")})
 it("rejects quarantined artifact",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x",detected_mime_type:"text/plain",size_bytes:1,storage_bucket:"b",storage_path:"p",status:"quarantine",scanned_at:null,extracted_text_ref:null}]),"u");await assert.rejects(()=>r.resolve([{id:"a"}]),/ARTIFACT_CONTEXT_NOT_CLEAN/)})
 it("rejects missing or foreign artifact",async()=>{const r=new CleanArtifactContextResolver(client([]),"u");await assert.rejects(()=>r.resolve([{id:"a"}]),/ARTIFACT_CONTEXT_NOT_FOUND/)})
 it("rejects clean unsupported artifact without extraction",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x.pdf",detected_mime_type:"application/pdf",size_bytes:5,storage_bucket:"b",storage_path:"p",status:"clean",scanned_at:null,extracted_text_ref:null}]),"u");await assert.rejects(()=>r.resolve([{id:"a"}]),/ARTIFACT_CONTEXT_REPRESENTATION_UNAVAILABLE/)})
})
