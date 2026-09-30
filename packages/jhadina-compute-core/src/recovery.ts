import type { ComputeExecutionResultReceipt, ComputeSubmissionReceipt } from './execution-contract.js';

export type ComputeFailureClass=
  |'worker-crash'
  |'node-lost'
  |'provider-unavailable'
  |'storage-unavailable'
  |'invalid-input'
  |'policy-denied'
  |'cancelled'
  |'unknown';

export type ComputeRecoveryDecision={
  disposition:'retry'|'fail'|'complete'|'cancelled';
  failureClass?:ComputeFailureClass;
  reason:string;
};

export function classifyComputeFailure(errorCode:string|undefined):ComputeFailureClass{
  const code=(errorCode??'').toUpperCase();
  if(code.includes('WORKER')||code.includes('PROCESS_EXIT'))return 'worker-crash';
  if(code.includes('NODE')||code.includes('EVICT')||code.includes('OOM'))return 'node-lost';
  if(code.includes('PROVIDER')||code.includes('RATE_LIMIT')||code.includes('TIMEOUT'))return 'provider-unavailable';
  if(code.includes('STORAGE')||code.includes('CEPH')||code.includes('MOUNT'))return 'storage-unavailable';
  if(code.includes('INPUT')||code.includes('VALIDATION'))return 'invalid-input';
  if(code.includes('POLICY')||code.includes('AUTH'))return 'policy-denied';
  if(code.includes('CANCEL'))return 'cancelled';
  return 'unknown';
}

export function decideComputeRecovery(
  result:ComputeExecutionResultReceipt,
  attempt:number,
  maxAttempts:number,
):ComputeRecoveryDecision{
  if(result.status==='succeeded')return {disposition:'complete',reason:'COMPUTE_SUCCEEDED'};
  if(result.status==='cancelled')return {disposition:'cancelled',failureClass:'cancelled',reason:'COMPUTE_CANCELLED'};
  const failureClass=classifyComputeFailure(result.errorCode);
  const retryableByClass=
    failureClass==='worker-crash'||
    failureClass==='node-lost'||
    failureClass==='provider-unavailable'||
    failureClass==='storage-unavailable';
  const retryable=result.retryable??retryableByClass;
  if(retryable&&attempt<maxAttempts){
    return {disposition:'retry',failureClass,reason:`COMPUTE_RETRYABLE:${failureClass}`};
  }
  return {
    disposition:'fail',
    failureClass,
    reason:attempt>=maxAttempts?'COMPUTE_RETRY_BUDGET_EXHAUSTED':`COMPUTE_NON_RETRYABLE:${failureClass}`,
  };
}

export function dedupeSubmissionReceipts(
  receipts:readonly ComputeSubmissionReceipt[],
):readonly ComputeSubmissionReceipt[]{
  const byKey=new Map<string,ComputeSubmissionReceipt>();
  for(const receipt of receipts){
    const key=`${receipt.workSessionId}:${receipt.taskId}:${receipt.idempotencyKey}`;
    const existing=byKey.get(key);
    if(!existing||receipt.submittedAt<existing.submittedAt)byKey.set(key,receipt);
  }
  return Object.freeze([...byKey.values()].sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)||a.submissionId.localeCompare(b.submissionId)));
}

export type CheckpointReceipt={
  checkpointId:string;
  workloadId:string;
  localWrittenAt:string;
  localPathRef:string;
  durableWrittenAt?:string;
  durableObjectRef?:string;
  digest?:string;
};

export function checkpointRestartSafe(receipt:CheckpointReceipt):boolean{
  return Boolean(
    receipt.durableWrittenAt&&
    receipt.durableObjectRef?.trim()&&
    receipt.digest?.trim()&&
    Number.isFinite(Date.parse(receipt.durableWrittenAt)),
  );
}
