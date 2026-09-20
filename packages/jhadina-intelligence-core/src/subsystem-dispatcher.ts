import type { EvidenceRef } from '@jhadina/core-spine';
import type { SubsystemId } from './universal-intake.js';
import type { AssetIntelligencePacket } from './media-pipeline.js';

export interface SubsystemIntelligenceRequest {readonly actorId:string;readonly assetId:string;readonly assetRef?:string;readonly mediaType?:string;readonly privacyClass?:string;readonly contentSha256?:string;readonly evidence:readonly EvidenceRef[];readonly uncertainty:readonly string[];readonly intent?:string;}
export interface SubsystemIntelligenceResponse {readonly subsystem:SubsystemId;readonly acceptedEvidenceIds:readonly string[];readonly receiptId:string;}
export interface SubsystemIntelligenceAdapter {readonly subsystem:SubsystemId;ingest(input:SubsystemIntelligenceRequest):Promise<SubsystemIntelligenceResponse>;}

export interface SubsystemDispatchResult {readonly assetId:string;readonly responses:readonly SubsystemIntelligenceResponse[];readonly skipped:readonly SubsystemId[];}

export class GovernedSubsystemDispatcher{
 constructor(private readonly adapters:readonly SubsystemIntelligenceAdapter[]){}
 async dispatch(packet:AssetIntelligencePacket,intent?:string):Promise<SubsystemDispatchResult>{
  if(packet.routing.requiresHumanSelection)throw new Error('SUBSYSTEM_SELECTION_REQUIRED');
  const responses:SubsystemIntelligenceResponse[]=[];const skipped:SubsystemId[]=[];
  for(const route of packet.routing.routes){
   const adapter=this.adapters.find(a=>a.subsystem===route.subsystem);
   if(!adapter){skipped.push(route.subsystem);continue}
   const response=await adapter.ingest({actorId:packet.asset.actorId,assetId:packet.asset.id,assetRef:packet.asset.assetRef,mediaType:packet.asset.mediaType,privacyClass:packet.asset.privacyClass,contentSha256:packet.asset.contentSha256,evidence:packet.evidence,uncertainty:packet.uncertainty,intent});
   if(response.subsystem!==route.subsystem)throw new Error('SUBSYSTEM_RESPONSE_MISMATCH');
   const allowed=new Set(packet.evidence.map(e=>e.id));
   if(response.acceptedEvidenceIds.some(id=>!allowed.has(id)))throw new Error('SUBSYSTEM_EVIDENCE_NOT_ASSET_BOUND');
   responses.push(Object.freeze({...response,acceptedEvidenceIds:Object.freeze([...response.acceptedEvidenceIds])}));
  }
  return Object.freeze({assetId:packet.asset.id,responses:Object.freeze(responses),skipped:Object.freeze(skipped)});
 }
}
