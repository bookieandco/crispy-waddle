import type { EvidenceRef } from '@jhadina/core-spine';
import type { RegisteredIntelligenceAsset } from './asset-registry.js';
import type { PerceptionExtractionRouter } from './perception-extraction.js';
import type { UniversalIntakeRouter,IntakeRoutingDecision } from './universal-intake.js';

export interface AssetIntelligencePacket {
 readonly asset:RegisteredIntelligenceAsset;
 readonly evidence:readonly EvidenceRef[];
 readonly uncertainty:readonly string[];
 readonly routing:IntakeRoutingDecision;
}
export interface MediaPipelineInput {readonly asset:RegisteredIntelligenceAsset;readonly intent?:string;}
export interface MediaPipeline {process(input:MediaPipelineInput):Promise<AssetIntelligencePacket>;}

export class GovernedMediaPipeline implements MediaPipeline{
 constructor(private readonly perception:PerceptionExtractionRouter,private readonly intake:UniversalIntakeRouter){}
 async process(input:MediaPipelineInput):Promise<AssetIntelligencePacket>{
  const extraction=await this.perception.extract({asset:input.asset});
  const routing=await this.intake.route(input.asset,input.intent);
  const evidence=Object.freeze(extraction.evidence.map(x=>Object.freeze({...x})));
  return Object.freeze({asset:Object.freeze({...input.asset}),evidence,uncertainty:Object.freeze([...extraction.uncertainty]),routing});
 }
}
