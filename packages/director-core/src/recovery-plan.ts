export type DirectorRecoveryFinding={kind:'submission'|'review_transition'|'rerun';id:string;action:'reconcile'|'resume'|'manual';reason:string};
export function planDirectorRecovery(i:{pendingSubmissionIds?:string[];decisionsWithoutTransitions?:string[];transitionsWithoutReruns?:string[];unsafeProviderSubmissionIds?:string[]}):DirectorRecoveryFinding[]{
 const unsafe=new Set(i.unsafeProviderSubmissionIds??[]);const out:DirectorRecoveryFinding[]=[];
 for(const id of i.pendingSubmissionIds??[])out.push({kind:'submission',id,action:unsafe.has(id)?'manual':'reconcile',reason:unsafe.has(id)?'provider retry is not proven idempotent':'durable submission requires reconciliation'});
 for(const id of i.decisionsWithoutTransitions??[])out.push({kind:'review_transition',id,action:'resume',reason:'immutable decision exists without transition receipt'});
 for(const id of i.transitionsWithoutReruns??[])out.push({kind:'rerun',id,action:'resume',reason:'rerun-required transition exists without deterministic rerun receipt'});
 return out;
}
