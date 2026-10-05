export type HomebaseResultEvidence={
  sourceUrl?:string;
  observedAt:string;
  sha256:string;
  ref:string;
};

export type HomebaseResultEnvelope={
  schema:'jhadina.homebase-result.v1';
  jobId:string;
  subsystemOwner:string;
  executionProvider:'HOMEBASE'|'RUNPOD';
  status:'SUCCEEDED'|'FAILED';
  producedAt:string;
  outputRefs:readonly string[];
  evidence:readonly HomebaseResultEvidence[];
  authority:'EVIDENCE_ONLY';
  canonicalCommitRequired:true;
  idempotencyKey:string;
};

const SHA=/^[a-f0-9]{64}$/i;

export function validateHomebaseResultEnvelope(e:HomebaseResultEnvelope):readonly string[]{
  const r:string[]=[];
  if(!e.jobId.trim())r.push('HOMEBASE_RESULT_JOB_ID_REQUIRED');
  if(!e.subsystemOwner.trim())r.push('HOMEBASE_RESULT_OWNER_REQUIRED');
  if(!Number.isFinite(Date.parse(e.producedAt)))r.push('HOMEBASE_RESULT_TIME_INVALID');
  if(!e.idempotencyKey.trim())r.push('HOMEBASE_RESULT_IDEMPOTENCY_REQUIRED');
  if(e.authority!=='EVIDENCE_ONLY')r.push('HOMEBASE_RESULT_AUTHORITY_INVALID');
  if(e.canonicalCommitRequired!==true)r.push('HOMEBASE_RESULT_CANONICAL_COMMIT_REQUIRED');
  for(const item of e.evidence){
    if(!Number.isFinite(Date.parse(item.observedAt)))r.push('HOMEBASE_RESULT_EVIDENCE_TIME_INVALID:'+item.ref);
    if(!SHA.test(item.sha256))r.push('HOMEBASE_RESULT_EVIDENCE_HASH_INVALID:'+item.ref);
    if(!item.ref.trim())r.push('HOMEBASE_RESULT_EVIDENCE_REF_REQUIRED');
  }
  return Object.freeze([...new Set(r)]);
}
