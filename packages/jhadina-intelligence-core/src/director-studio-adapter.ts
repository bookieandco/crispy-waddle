import type { SubsystemIntelligenceAdapter,SubsystemIntelligenceRequest,SubsystemIntelligenceResponse } from './subsystem-dispatcher.js';

export interface DirectorIntelligenceIngress {
 ingest(input:{
  actorId:string;assetId:string;
  evidence:SubsystemIntelligenceRequest['evidence'];
  uncertainty:readonly string[];intent?:string;
 }):Promise<{receiptId:string;acceptedEvidenceIds:readonly string[]}>;
}

/**
 * Director receives analysis/context only. Rendering, replacement, tracking,
 * voice-sync and other mutations remain behind Director's ActionExecutor bridge.
 */
export class DirectorStudioIntelligenceAdapter implements SubsystemIntelligenceAdapter {
 readonly subsystem='director-studio' as const;
 constructor(private readonly ingress:DirectorIntelligenceIngress){}
 async ingest(input:SubsystemIntelligenceRequest):Promise<SubsystemIntelligenceResponse>{
  const result=await this.ingress.ingest({
   actorId:input.actorId,assetId:input.assetId,evidence:input.evidence,
   uncertainty:input.uncertainty,intent:input.intent,
  });
  const allowed=new Set(input.evidence.map(e=>e.id));
  if(result.acceptedEvidenceIds.some(id=>!allowed.has(id)))throw new Error('DIRECTOR_INGRESS_EVIDENCE_NOT_BOUND');
  return Object.freeze({subsystem:this.subsystem,acceptedEvidenceIds:Object.freeze([...result.acceptedEvidenceIds]),receiptId:result.receiptId});
 }
}
