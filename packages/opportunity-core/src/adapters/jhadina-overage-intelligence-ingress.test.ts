import { describe, expect, it } from "vitest";
import { OverageOsIntelligenceAdapter } from "./jhadina-overage-intelligence-ingress.js";

const request:any = {
  actorId:"u1", assetId:"a1", assetRef:"storage/u1/county.pdf",
  mediaType:"application/pdf", contentSha256:"a".repeat(64),
  evidence:[{id:"asset:a1:page:0",source:"perception:document",observedAt:"2026-01-01T00:00:00Z",summary:"county surplus list",immutable:true}],
  uncertainty:[], intent:"analyze this county surplus list",
};

describe("OverageOsIntelligenceAdapter",()=>{
  it("registers uploaded documents as source material only",async()=>{
    let seen:any;
    const a=new OverageOsIntelligenceAdapter({async registerSourceDocument(i){seen=i;return{receiptId:"ovr-r1",acceptedEvidenceIds:i.evidenceIds}}});
    const out=await a.ingest(request);
    expect(seen.assetRef).toBe("storage/u1/county.pdf");
    expect(seen.contentSha256).toBe("a".repeat(64));
    expect(out.subsystem).toBe("overageos");
  });
  it("rejects unrelated evidence claims",async()=>{
    const a=new OverageOsIntelligenceAdapter({async registerSourceDocument(){return{receiptId:"r",acceptedEvidenceIds:["asset:other:x"]}}});
    await expect(a.ingest(request)).rejects.toThrow("EVIDENCE_NOT_ASSET_BOUND");
  });
  it("has no verification, contact, claim, or execution authority",()=>{
    const a:any=new OverageOsIntelligenceAdapter({} as any);
    expect(a.verify).toBeUndefined(); expect(a.contact).toBeUndefined();
    expect(a.submitClaim).toBeUndefined(); expect(a.execute).toBeUndefined();
  });
});
