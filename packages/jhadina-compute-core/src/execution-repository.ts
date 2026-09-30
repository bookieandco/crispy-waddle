import type {
  ComputeExecutionResultReceipt,
  ComputeSubmissionReceipt,
} from './execution-contract.js';

export type ComputeExecutionRecord={
  submission:ComputeSubmissionReceipt;
  result?:ComputeExecutionResultReceipt;
  updatedAt:string;
};

export interface ComputeExecutionRepository{
  getByIdempotency(
    userId:string,
    workSessionId:string,
    taskId:string,
    idempotencyKey:string,
  ):Promise<ComputeExecutionRecord|null>;
  saveSubmission(receipt:ComputeSubmissionReceipt):Promise<void>;
  saveResult(receipt:ComputeExecutionResultReceipt,updatedAt:string):Promise<void>;
}

function key(userId:string,workSessionId:string,taskId:string,idempotencyKey:string):string{
  return `${userId}:${workSessionId}:${taskId}:${idempotencyKey}`;
}

export class InMemoryComputeExecutionRepository implements ComputeExecutionRepository{
  private readonly records=new Map<string,ComputeExecutionRecord>();
  private readonly submissionToKey=new Map<string,string>();

  async getByIdempotency(
    userId:string,
    workSessionId:string,
    taskId:string,
    idempotencyKey:string,
  ):Promise<ComputeExecutionRecord|null>{
    return this.records.get(key(userId,workSessionId,taskId,idempotencyKey))??null;
  }

  async saveSubmission(receipt:ComputeSubmissionReceipt):Promise<void>{
    const recordKey=key(receipt.userId,receipt.workSessionId,receipt.taskId,receipt.idempotencyKey);
    const current=this.records.get(recordKey);
    if(current){
      if(
        current.submission.submissionId!==receipt.submissionId||
        current.submission.workloadId!==receipt.workloadId||
        current.submission.manifestFingerprint!==receipt.manifestFingerprint
      ){
        throw new Error('COMPUTE_EXECUTION_IDEMPOTENCY_CONFLICT');
      }
      return;
    }
    const existingKey=this.submissionToKey.get(receipt.submissionId);
    if(existingKey&&existingKey!==recordKey)throw new Error('COMPUTE_EXECUTION_SUBMISSION_ID_CONFLICT');
    this.records.set(recordKey,{submission:Object.freeze({...receipt}),updatedAt:receipt.submittedAt});
    this.submissionToKey.set(receipt.submissionId,recordKey);
  }

  async saveResult(receipt:ComputeExecutionResultReceipt,updatedAt:string):Promise<void>{
    const recordKey=this.submissionToKey.get(receipt.submissionId);
    if(!recordKey)throw new Error('COMPUTE_EXECUTION_SUBMISSION_NOT_FOUND');
    const current=this.records.get(recordKey);
    if(!current)throw new Error('COMPUTE_EXECUTION_SUBMISSION_NOT_FOUND');
    if(current.submission.workloadId!==receipt.workloadId)throw new Error('COMPUTE_EXECUTION_RESULT_WORKLOAD_MISMATCH');
    if(current.result){
      if(
        current.result.status!==receipt.status||
        current.result.completedAt!==receipt.completedAt||
        current.result.errorCode!==receipt.errorCode
      )throw new Error('COMPUTE_EXECUTION_RESULT_CONFLICT');
      return;
    }
    this.records.set(recordKey,{
      submission:current.submission,
      result:Object.freeze({...receipt,outputRefs:Object.freeze([...receipt.outputRefs])}),
      updatedAt,
    });
  }
}
