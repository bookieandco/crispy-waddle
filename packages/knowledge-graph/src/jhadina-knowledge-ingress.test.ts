import test from "node:test";import assert from "node:assert/strict";
import { InMemoryKnowledgeGraph } from "./index.js";
import { KnowledgeGraphIntelligenceAdapter } from "./jhadina-knowledge-ingress.js";
test("registers asset and evidence provenance nodes",async()=>{
 const g=new InMemoryKnowledgeGraph();const a=new KnowledgeGraphIntelligenceAdapter(g);
 const out=await a.ingest({actorId:"u",assetId:"a",mediaType:"application/pdf",evidence:[{id:"asset:a:page:0",source:"p",observedAt:"2026-01-01T00:00:00Z",summary:"statute",immutable:true}],uncertainty:[],intent:"law"});
 assert.equal(g.getNode("asset:a")?.nodeType,"intelligence-asset");
 assert.equal(g.getRelations("asset:a")[0]?.relationType,"derived-from");
 assert.equal(out.subsystem,"knowledge");
});
test("rejects cross-asset evidence",async()=>{
 const a=new KnowledgeGraphIntelligenceAdapter(new InMemoryKnowledgeGraph());
 await assert.rejects(()=>a.ingest({actorId:"u",assetId:"a",evidence:[{id:"asset:b:x",source:"p",observedAt:"x",summary:"x"}],uncertainty:[]}),/EVIDENCE_NOT_ASSET_BOUND/);
});
