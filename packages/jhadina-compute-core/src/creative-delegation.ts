import {planFreeFirstCreative,type CreativeLocalBackend,type CreativeLocalPlan,type CreativeLocalRequest} from './creative-local-first.js';

/** Delegation *without submission*; an existing domain owns every actual job. */
export type LocalCreativeDelegation={
  decision:CreativeLocalPlan;
  responsibleSubsystem:'director'|'pupson-creative-job'|'pod-creative-job';
  submissionRoute:'director-authorized-take'|'pupson-existing-creative-jobs'|'pod-existing-creative-jobs';
  productionActivated:false;
};
export function planLocalCreativeDelegation(request:CreativeLocalRequest,
  backends:readonly CreativeLocalBackend[]):LocalCreativeDelegation{
  const decision=planFreeFirstCreative(request,backends);
  const responsibleSubsystem=request.consumer==='pupsonstuff'?'pupson-creative-job'
    :request.consumer==='pod'?'pod-creative-job':'director';
  const submissionRoute=responsibleSubsystem==='director'?'director-authorized-take'
    :responsibleSubsystem==='pupson-creative-job'?'pupson-existing-creative-jobs'
    :'pod-existing-creative-jobs';
  return {decision,responsibleSubsystem,submissionRoute,productionActivated:false};
}
