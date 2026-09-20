import { createHash } from 'node:crypto';
import { fingerprintAction, type ExecutionAction } from './execution-permit.js';

export type ExecutionAttemptState = 'STARTED'|'SUCCEEDED'|'FAILED'|'UNKNOWN'|'RECOVERY_REQUIRED';
export type ExecutionActionSnapshot = Readonly<ExecutionAction>;

export interface ExecutionAttempt {
  attemptId:string; requestId:string; permitId:string; actionFingerprint:string; actionSnapshot:ExecutionActionSnapshot;
  provider:string; operation:string; idempotencyKey:string; state:ExecutionAttemptState; providerReference?:string;
  errorCode?:string; errorMessage?:string; startedAt:string; completedAt?:string; recoveryRequired:boolean;
  /** Persisted parent execution for a recovery child. Never inferred from request input. */
  recoveryOfExecutionId?:string;
}
export type ExecutionAttemptOutcome=Pick<ExecutionAttempt,'state'|'providerReference'|'errorCode'|'errorMessage'|'recoveryRequired'>;
export interface ExecutionAttemptStore {
  start(attempt:ExecutionAttempt):Promise<void>|void;
  complete(attemptId:string,outcome:ExecutionAttemptOutcome,completedAt?:string):Promise<void>|void;
  resolve(attemptId:string,outcome:ExecutionAttemptOutcome,completedAt?:string):Promise<void>|void;
  get(attemptId:string):Promise<ExecutionAttempt|undefined>|ExecutionAttempt|undefined;
}
export function executionIdempotencyKey(permitId:string,actionFingerprint:string):string{return createHash('sha256').update(`jhadina-money-execution:v1:${permitId}:${actionFingerprint}`,'utf8').digest('hex')}
export function createExecutionAttempt(input:{attemptId:string;requestId:string;permitId:string;action:ExecutionAction;operation:string;now:string;recoveryOfExecutionId?:string}):ExecutionAttempt{
 const actionFingerprint=fingerprintAction(input.action);const actionSnapshot:ExecutionActionSnapshot=Object.freeze({...input.action});
 return {attemptId:input.attemptId,requestId:input.requestId,permitId:input.permitId,actionFingerprint,actionSnapshot,provider:input.action.provider,operation:input.operation,idempotencyKey:executionIdempotencyKey(input.permitId,actionFingerprint),state:'STARTED',startedAt:input.now,recoveryRequired:false,recoveryOfExecutionId:input.recoveryOfExecutionId}
}
