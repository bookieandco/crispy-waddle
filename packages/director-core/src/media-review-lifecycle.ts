import type { CreativeProvenance } from './creative-provenance.js';
import type { GeneratedAssetRecord } from './generation-assets.js';
import type { MediaQualityEvidence } from './media-quality-evidence.js';
import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage } from './creative-stage-graph.js';
import { evaluateDirectorMediaReviewGate } from './media-review-gate-adapter.js';

export type MediaReviewDecision='approved'|'changes_requested'|'rejected';
export type MediaReviewDecisionRecord={id:string;projectId:string;runId:string;gateId:string;generationStageId:string;generationStageVersion:number;reviewStageId:string;reviewStageVersion:number;assetId:string;generationJobId:string;decision:MediaReviewDecision;note?:string;evidenceIds:string[];decidedBy:string;decidedAt:string;provenance:CreativeProvenance};
export interface DirectorReviewRepository {
 getAsset(id:string,projectId:string):Promise<GeneratedAssetRecord|null>;
 listEvidence(assetId:string,projectId:string):Promise<MediaQualityEvidence[]>;
 getDecision(projectId:string,runId:string,reviewStageId:string,reviewStageVersion:number,assetId:string):Promise<MediaReviewDecisionRecord|null>;
 appendDecision(record:MediaReviewDecisionRecord):Promise<void>;
}
export type DirectorReviewAuthority={run:ProductionRun;gate:CreativeGate;generationStage:CreativeStage;reviewStage:CreativeStage;asset:GeneratedAssetRecord;evidence:MediaQualityEvidence[];expectedProvenance:CreativeProvenance};

export class DirectorReviewAuthorityResolver {
 constructor(private readonly production:{getRun(id:string,p:string):Promise<ProductionRun|null>;getGate(id:string,r:string,p:string):Promise<CreativeGate|null>;getStage(id:string,p:string):Promise<CreativeStage|null>},private readonly reviews:DirectorReviewRepository){}
 async resolve(i:{projectId:string;runId:string;gateId:string;generationStageId:string;reviewStageId:string;assetId:string}):Promise<DirectorReviewAuthority>{
  const [run,gate,generationStage,reviewStage,asset]=await Promise.all([this.production.getRun(i.runId,i.projectId),this.production.getGate(i.gateId,i.runId,i.projectId),this.production.getStage(i.generationStageId,i.projectId),this.production.getStage(i.reviewStageId,i.projectId),this.reviews.getAsset(i.assetId,i.projectId)]);
  if(!run)throw new Error('DIRECTOR_REVIEW_RUN_NOT_FOUND'); if(!gate||!run.gateIds.includes(gate.id))throw new Error('DIRECTOR_REVIEW_GATE_NOT_FOUND');
  if(!generationStage||generationStage.kind!=='generation')throw new Error('DIRECTOR_REVIEW_GENERATION_STAGE_NOT_FOUND');
  if(!reviewStage||reviewStage.kind!=='review')throw new Error('DIRECTOR_REVIEW_STAGE_NOT_FOUND');
  if(!asset||asset.projectId!==i.projectId)throw new Error('DIRECTOR_REVIEW_ASSET_NOT_FOUND');
  if(!asset.provenance)throw new Error('DIRECTOR_REVIEW_ASSET_PROVENANCE_MISSING');
  if(asset.provenance.generationStageId!==generationStage.id||asset.provenance.generationStageVersion!==generationStage.version)throw new Error('DIRECTOR_REVIEW_STALE_GENERATION');
  const evidence=await this.reviews.listEvidence(asset.id,i.projectId);
  return {run,gate,generationStage,reviewStage,asset,evidence,expectedProvenance:asset.provenance};
 }
}
export async function commitDirectorMediaReview(input:{authority:DirectorReviewAuthority;decision:MediaReviewDecision;decisionId:string;decidedBy:string;note?:string;repository:DirectorReviewRepository;now?:string}):Promise<MediaReviewDecisionRecord>{
 const a=input.authority; const gate=evaluateDirectorMediaReviewGate(a); if(!gate.allowed)throw new Error(`DIRECTOR_REVIEW_BLOCKED: ${gate.reason}`);
 const existing=await input.repository.getDecision(a.run.projectId,a.run.id,a.reviewStage.id,a.reviewStage.version,a.asset.id);
 if(existing){if(existing.decision===input.decision)return existing;throw new Error('DIRECTOR_REVIEW_DECISION_CONFLICT');}
 const record:MediaReviewDecisionRecord={id:input.decisionId,projectId:a.run.projectId,runId:a.run.id,gateId:a.gate.id,generationStageId:a.generationStage.id,generationStageVersion:a.generationStage.version,reviewStageId:a.reviewStage.id,reviewStageVersion:a.reviewStage.version,assetId:a.asset.id,generationJobId:a.asset.generationJobId,decision:input.decision,evidenceIds:a.evidence.map(e=>e.id),decidedBy:input.decidedBy,decidedAt:input.now??new Date().toISOString(),provenance:a.expectedProvenance,...(input.note?{note:input.note}:{})};
 await input.repository.appendDecision(record); return record;
}
