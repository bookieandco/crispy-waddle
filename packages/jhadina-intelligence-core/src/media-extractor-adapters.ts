import type { EvidenceRef } from '@jhadina/core-spine';
import type { PerceptionExtractionInput,PerceptionExtractionOutput,PerceptionExtractor } from './perception-extraction.js';
import type { IntakeModality } from './universal-intake.js';

export interface MediaExtractionBackend {
 extract(input:{assetRef:string;mediaType:string;segment?:{startMs:number;endMs:number}}):Promise<{
  observations:readonly {kind:string;summary:string;observedAt?:string}[];
  uncertainty?:readonly string[];
 }>;
}

export abstract class BackendPerceptionExtractor implements PerceptionExtractor{
 abstract readonly modality:IntakeModality;
 constructor(protected readonly backend:MediaExtractionBackend){}
 async extract(input:PerceptionExtractionInput):Promise<PerceptionExtractionOutput>{
  const result=await this.backend.extract({assetRef:input.asset.assetRef,mediaType:input.asset.mediaType,segment:input.segment});
  const evidence=result.observations.map((o,i):EvidenceRef=>({id:`asset:${input.asset.id}:${o.kind}:${i}`,source:`perception:${input.asset.modality}`,observedAt:o.observedAt??input.asset.createdAt,summary:o.summary,immutable:true}));
  return Object.freeze({assetId:input.asset.id,evidence:Object.freeze(evidence),uncertainty:Object.freeze(result.uncertainty??[])});
 }
}
export class VideoPerceptionExtractor extends BackendPerceptionExtractor{readonly modality='video' as const}
export class AudioPerceptionExtractor extends BackendPerceptionExtractor{readonly modality='audio' as const}
export class ImagePerceptionExtractor extends BackendPerceptionExtractor{readonly modality='image' as const}
export class DocumentPerceptionExtractor extends BackendPerceptionExtractor{readonly modality='document' as const}
export class TextPerceptionExtractor extends BackendPerceptionExtractor{readonly modality='text' as const}
export class CodePerceptionExtractor extends BackendPerceptionExtractor{readonly modality='code' as const}
