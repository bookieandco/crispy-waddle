import type { SubsystemIntelligenceAdapter,SubsystemIntelligenceRequest,SubsystemIntelligenceResponse } from './subsystem-dispatcher.js';

export interface SportsEvidenceIngress {
 ingest(input:{
  actorId:string;
  assetId:string;
  evidence:SubsystemIntelligenceRequest['evidence'];
  uncertainty:readonly string[];
  intent?:string;
 }):Promise<{receiptId:string;acceptedEvidenceIds:readonly string[]}>;
}

/**
 * Intelligence-only Sports adapter. It forwards bounded observations to the
 * existing Sports ingress; it cannot place bets, create orders, or execute actions.
 */
export class SportsIntelligenceAdapter implements SubsystemIntelligenceAdapter {
 readonly subsystem='sports-intelligence' as const;
 constructor(private readonly ingress:SportsEvidenceIngress){}
 async ingest(input:SubsystemIntelligenceRequest):Promise<SubsystemIntelligenceResponse>{
  const result=await this.ingress.ingest({
   actorId:input.actorId,assetId:input.assetId,evidence:input.evidence,
   uncertainty:input.uncertainty,intent:input.intent,
  });
  const allowed=new Set(input.evidence.map(e=>e.id));
  if(result.acceptedEvidenceIds.some(id=>!allowed.has(id))) throw new Error('SPORTS_INGRESS_EVIDENCE_NOT_BOUND');
  return Object.freeze({subsystem:this.subsystem,acceptedEvidenceIds:Object.freeze([...result.acceptedEvidenceIds]),receiptId:result.receiptId});
 }
}
