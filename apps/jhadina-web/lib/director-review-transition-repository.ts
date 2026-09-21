import type { DirectorReviewTransition,DirectorReviewTransitionRepository } from '@jhadina/director-core';
export type DirectorReviewTransitionClient={rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:{message:string}|null}>};
export class SupabaseDirectorReviewTransitionRepository implements DirectorReviewTransitionRepository{
 constructor(private readonly c:DirectorReviewTransitionClient){}
 async apply(t:DirectorReviewTransition){const {data,error}=await this.c.rpc('apply_director_review_transition',{p_decision_id:t.decisionId,p_project_id:t.projectId,p_review_stage_id:t.reviewStageId,p_review_version:t.expectedReviewVersion,p_generation_stage_id:t.generationStageId,p_generation_version:t.expectedGenerationVersion,p_review_status:t.nextReviewStatus,p_generation_status:t.nextGenerationStatus,p_successor_version:t.successorGenerationVersion??null,p_reason:t.reason});if(error)throw new Error(error.message);const d=data as {applied?:boolean;successorGenerationStageId?:string};return {applied:d.applied===true};}
}
