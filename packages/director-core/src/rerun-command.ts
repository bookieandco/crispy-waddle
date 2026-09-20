import type { PlannedGeneration } from './generation-plan-adapter.js';
import type { TakeRequest } from './generation-orchestrator.js';
import type { MediaReviewDecisionRecord } from './media-review-lifecycle.js';
export type DirectorRerunCommand={id:string;decisionId:string;projectId:string;successorGenerationStageId:string;take:TakeRequest;plan:PlannedGeneration};
export function compileDirectorRerunCommand(input:{decision:MediaReviewDecisionRecord;successorGenerationStageId:string;previousTake:TakeRequest;previousPlan:PlannedGeneration;promptRevision?:string}):DirectorRerunCommand{
 const {decision:d,successorGenerationStageId:s,previousTake:t,previousPlan:p}=input;
 if(d.decision==='approved')throw new Error('DIRECTOR_RERUN_NOT_REQUIRED');
 const nextVersion=d.generationStageVersion+1;
 if(s!==d.generationStageId+':v'+nextVersion)throw new Error('DIRECTOR_RERUN_SUCCESSOR_MISMATCH');
 return {id:`director:${d.projectId}:rerun:${d.id}`,decisionId:d.id,projectId:d.projectId,successorGenerationStageId:s,take:{...t,takeId:`${t.takeId}:review:${d.id}:v${nextVersion}`,parentTakeId:t.takeId,prompt:input.promptRevision??t.prompt},plan:{...p,parameters:{...(p.parameters??{}),reviewDecisionId:d.id,rerunOfGenerationJobId:d.generationJobId,generationStageVersion:nextVersion}}};
}
