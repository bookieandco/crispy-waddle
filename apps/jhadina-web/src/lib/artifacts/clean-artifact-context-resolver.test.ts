import {describe,expect,it} from "vitest"
import {CleanArtifactContextResolver} from "./clean-artifact-context-resolver"

function client(rows:any[],payload="hello"){return{
 from:()=>({select:()=>({eq:()=>({in:async()=>({data:rows,error:null})})})}),
 storage:{from:()=>({download:async()=>({data:new Blob([payload]),error:null})})},
} as any}

describe("CleanArtifactContextResolver",()=>{
 it("hydrates clean owner text artifact",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x.txt",detected_mime_type:"text/plain",size_bytes:5,storage_bucket:"b",storage_path:"p",status:"clean",scanned_at:"2026-01-01T00:00:00Z",extracted_text_ref:null}]),"u");const x=await r.resolve([{id:"a"}]);expect(x[0]?.source).toBe("durable-artifact");expect(x[0]?.text).toBe("hello")})
 it("hydrates extracted text from a private derivative reference",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x.pdf",detected_mime_type:"application/pdf",size_bytes:10,storage_bucket:"q",storage_path:"source",status:"clean",scanned_at:"2026-01-01T00:00:00Z",extracted_text_ref:"supabase-private://jhadina-artifact-derived/u/a/extracted.txt"}],"pdf body"),"u");const x=await r.resolve([{id:"a"}]);expect(x[0]?.text).toBe("pdf body")})
 it("rejects quarantined artifact",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x",detected_mime_type:"text/plain",size_bytes:1,storage_bucket:"b",storage_path:"p",status:"quarantine",scanned_at:null,extracted_text_ref:null}]),"u");await expect(r.resolve([{id:"a"}])).rejects.toThrow(/ARTIFACT_CONTEXT_NOT_CLEAN/)})
 it("rejects missing or foreign artifact",async()=>{const r=new CleanArtifactContextResolver(client([]),"u");await expect(r.resolve([{id:"a"}])).rejects.toThrow(/ARTIFACT_CONTEXT_NOT_FOUND/)})
 it("rejects clean unsupported artifact without extraction",async()=>{const r=new CleanArtifactContextResolver(client([{id:"a",original_name:"x.pdf",detected_mime_type:"application/pdf",size_bytes:5,storage_bucket:"b",storage_path:"p",status:"clean",scanned_at:null,extracted_text_ref:null}]),"u");await expect(r.resolve([{id:"a"}])).rejects.toThrow(/ARTIFACT_CONTEXT_REPRESENTATION_UNAVAILABLE/)})
})
