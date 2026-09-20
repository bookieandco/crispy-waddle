import { OverageOsIntelligenceAdapter } from "./jhadina-overage-intelligence-ingress.js";

const assert = (condition: unknown, message: string): void => { if (!condition) throw new Error(message) };
const request:any = {
  actorId:"u1", assetId:"a1", assetRef:"storage/u1/county.pdf",
  mediaType:"application/pdf", contentSha256:"a".repeat(64),
  evidence:[{id:"asset:a1:page:0",source:"perception:document",observedAt:"2026-01-01T00:00:00Z",summary:"county surplus list",immutable:true}],
  uncertainty:[], intent:"analyze this county surplus list",
};

let seen:any;
const adapter=new OverageOsIntelligenceAdapter({async registerSourceDocument(input){seen=input;return{receiptId:"ovr-r1",acceptedEvidenceIds:input.evidenceIds}}});
const output=await adapter.ingest(request);
assert(seen.assetRef === "storage/u1/county.pdf", "Asset reference was not preserved");
assert(seen.contentSha256 === "a".repeat(64), "Content hash was not preserved");
assert(output.subsystem === "overageos", "Wrong subsystem response");

let crossAssetRejected=false;
try {
  const bad=new OverageOsIntelligenceAdapter({async registerSourceDocument(){return{receiptId:"r",acceptedEvidenceIds:["asset:other:x"]}}});
  await bad.ingest(request);
} catch (error) {
  crossAssetRejected=error instanceof Error && error.message.includes("EVIDENCE_NOT_ASSET_BOUND");
}
assert(crossAssetRejected, "Cross-asset evidence claim was accepted");

let hashRejected=false;
try { await adapter.ingest({...request,contentSha256:undefined}); } catch (error) {
  hashRejected=error instanceof Error && error.message.includes("SHA256_REQUIRED");
}
assert(hashRejected, "Hashless OverageOS source was accepted");

const authority:any=adapter;
assert(authority.verify === undefined && authority.contact === undefined && authority.submitClaim === undefined && authority.execute === undefined,
  "Overage intake adapter exposed consequential authority");
