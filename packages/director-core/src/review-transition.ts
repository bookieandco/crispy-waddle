import type { CreativeStage } from './creative-stage-graph.js';
import type { MediaReviewDecisionRecord } from './media-review-lifecycle.js';

export type DirectorReviewTransition={decisionId:string;projectId:string;reviewStageId:string;expectedReviewVersion:number;generationStageId:string;expectedGenerationVersion:number;nextReviewStatus:'approved'|'stale';nextGenerationStatus:'approved'|'stale';successorGenerationVersion?:number;reason:string};
export function planDirectorReviewTransition(d:MediaReviewDecisionRecord):DirectorReviewTransition{
 if(d.decision==='approved')return {decisionId:d.id,projectId:d.projectId,reviewStageId:d.reviewStageId,expectedReviewVersion:d.reviewStageVersion,generationStageId:d.generationStageId,expectedGenerationVersion:d.generationStageVersion,nextReviewStatus:'approved',nextGenerationStatus:'approved',reason:'media-review-approved'};
 return {decisionId:d.id,projectId:d.projectId,reviewStageId:d.reviewStageId,expectedReviewVersion:d.reviewStageVersion,generationStageId:d.generationStageId,expectedGenerationVersion:d.generationStageVersion,nextReviewStatus:'stale',nextGenerationStatus:'stale',successorGenerationVersion:d.generationStageVersion+1,reason:`media-review-${d.decision}`};
}
export interface DirectorReviewTransitionRepository{apply(t:DirectorReviewTransition):Promise<{applied:boolean;successorGenerationStage?:CreativeStage}>}
export async function applyDirectorReviewTransition(d:MediaReviewDecisionRecord,r:DirectorReviewTransitionRepository){return r.apply(planDirectorReviewTransition(d));}
