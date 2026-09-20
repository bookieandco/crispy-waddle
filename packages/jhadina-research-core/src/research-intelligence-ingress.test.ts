import { JhadinaResearchIntelligenceAdapter } from "./research-intelligence-ingress.js";

const req:any={actorId:"u",assetId:"a",evidence:[{id:"asset:a:page:0"}],uncertainty:[],intent:"research this statute"};

let queued:any;
const adapter=new JhadinaResearchIntelligenceAdapter({async enqueue(queue){queued=queue;return{receiptId:"rr1"}}});
const result=await adapter.ingest(req);
if (queued.tasks[0].authorizationClass !== "analysis") throw new Error("Research intake must remain analysis-only");
if (queued.tasks[0].state !== "ready") throw new Error("Research intake task must enter ready state");
if (result.receiptId !== "rr1") throw new Error("Research receipt was not preserved");

let rejected=false;
try {
  await adapter.ingest({...req,evidence:[{id:"asset:other:x"}]});
} catch (error) {
  rejected=error instanceof Error && error.message.includes("EVIDENCE_NOT_ASSET_BOUND");
}
if (!rejected) throw new Error("Cross-asset research evidence was accepted");
