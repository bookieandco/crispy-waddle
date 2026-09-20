import type { EvidenceRef } from '@jhadina/core-spine';
import type { IntakeModality, RegisteredIntelligenceAsset } from './asset-registry.js';

export interface PerceptionExtractionInput {readonly asset:RegisteredIntelligenceAsset;readonly segment?:{startMs:number;endMs:number};}
export interface PerceptionExtractionOutput {readonly assetId:string;readonly evidence:readonly EvidenceRef[];readonly uncertainty:readonly string[];}
export interface PerceptionExtractor {readonly modality:IntakeModality;extract(input:PerceptionExtractionInput):Promise<PerceptionExtractionOutput>;}
export interface PerceptionExtractionRouter {extract(input:PerceptionExtractionInput):Promise<PerceptionExtractionOutput>;}

export class GovernedPerceptionExtractionRouter implements PerceptionExtractionRouter {
 constructor(private readonly extractors:readonly PerceptionExtractor[]){}
 async extract(input:PerceptionExtractionInput):Promise<PerceptionExtractionOutput>{
  const e=this.extractors.find(x=>x.modality===input.asset.modality);
  if(!e)throw new Error(`PERCEPTION_EXTRACTOR_UNAVAILABLE:${input.asset.modality}`);
  const out=await e.extract(input);
  if(out.assetId!==input.asset.id)throw new Error('PERCEPTION_ASSET_MISMATCH');
  for(const ref of out.evidence) if(!ref.id.startsWith(`asset:${input.asset.id}:`))throw new Error('PERCEPTION_EVIDENCE_NOT_ASSET_BOUND');
  return Object.freeze({assetId:out.assetId,evidence:Object.freeze(out.evidence.map(x=>Object.freeze({...x}))),uncertainty:Object.freeze([...out.uncertainty])});
 }
}
export function assetEvidenceRef(asset:RegisteredIntelligenceAsset,kind:string,summary:string,observedAt=asset.createdAt):EvidenceRef{
 if(!kind.trim())throw new Error('PERCEPTION_KIND_REQUIRED');
 return Object.freeze({id:`asset:${asset.id}:${kind}`,source:`asset-perception:${asset.modality}`,observedAt,summary,immutable:true});
}
