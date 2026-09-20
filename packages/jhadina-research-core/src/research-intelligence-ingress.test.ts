import { describe, expect, it } from "vitest";
import { JhadinaResearchIntelligenceAdapter } from "./research-intelligence-ingress.js";

const req:any={actorId:"u",assetId:"a",evidence:[{id:"asset:a:page:0"}],uncertainty:[],intent:"research this statute"};
describe("JhadinaResearchIntelligenceAdapter",()=>{
  it("creates an analysis-only ready research task",async()=>{
    let q:any; const a=new JhadinaResearchIntelligenceAdapter({async enqueue(x){q=x;return{receiptId:"rr1"}}});
    const out=await a.ingest(req);
    expect(q.tasks[0].authorizationClass).toBe("analysis");
    expect(q.tasks[0].state).toBe("ready");
    expect(out.receiptId).toBe("rr1");
  });
  it("rejects cross-asset evidence",async()=>{
    const a=new JhadinaResearchIntelligenceAdapter({async enqueue(){return{receiptId:"x"}}});
    await expect(a.ingest({...req,evidence:[{id:"asset:other:x"}]})).rejects.toThrow("EVIDENCE_NOT_ASSET_BOUND");
  });
});
