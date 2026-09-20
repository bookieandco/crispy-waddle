import { createHash } from 'node:crypto'
import type { ExecutionAttempt } from './execution-attempt.js'
import type { ProviderExecutionEvent, ProviderExecutionEventState } from './execution-receipt-contracts.js'

export type BrokerEnvironment='SANDBOX'
export type BrokerOrderSide='BUY'|'SELL'
export type BrokerOrderType='MARKET'|'LIMIT'
export type BrokerTimeInForce='DAY'|'GTC'|'IOC'
export type BrokerOrderRequest=Readonly<{clientOrderId:string;instrumentId:string;side:BrokerOrderSide;orderType:BrokerOrderType;quantity:string;limitPrice?:string;timeInForce:BrokerTimeInForce;currency:string}>
export type BrokerCancelRequest=Readonly<{clientOrderId:string;providerReference:string}>
export type BrokerOrderSnapshot=Readonly<{providerReference:string;clientOrderId:string;state:ProviderExecutionEventState;filledQuantity:string;averageFillPrice?:string;fee?:string;updatedAt:string}>
export type BrokerSubmissionResult=Readonly<{providerReference:string;state:ProviderExecutionEventState;acceptedAt:string;rawEvidenceId:string}>
export type BrokerCancellationResult=Readonly<{providerReference:string;state:'CANCELLED'|'FILLED'|'UNKNOWN';observedAt:string;rawEvidenceId:string}>
export type BrokerAdapterContext=Readonly<{environment:BrokerEnvironment;executionId:string;idempotencyKey:string;actionFingerprint:string;provider:string;now:string}>
export interface SandboxBrokerAdapter{readonly provider:string;readonly environment:'SANDBOX';submitOrder(context:BrokerAdapterContext,request:BrokerOrderRequest):Promise<BrokerSubmissionResult>;cancelOrder(context:BrokerAdapterContext,request:BrokerCancelRequest):Promise<BrokerCancellationResult>;getOrder(context:BrokerAdapterContext,providerReference:string):Promise<BrokerOrderSnapshot|undefined>}
export type SandboxFaultMode='NONE'|'TIMEOUT_AFTER_ACCEPT'|'REJECT'|'DUPLICATE_ACK'|'UNKNOWN_QUERY'
export type BrokerCertificationCase=Readonly<{caseId:string;name:string;passed:boolean;evidenceIds:readonly string[]}>
export type BrokerCertificationReport=Readonly<{reportId:string;provider:string;environment:'SANDBOX';cases:readonly BrokerCertificationCase[];passed:boolean;liveEligible:false;authority:'CERTIFICATION_ONLY';provenanceHash:string}>

export function hash044(v:unknown){return createHash('sha256').update(JSON.stringify(v)).digest('hex')}
export function assertSandboxExecutionAttempt(attempt:ExecutionAttempt){if(attempt.actionSnapshot.capability!=='money.simulation.order.submit'&&attempt.actionSnapshot.capability!=='money.simulation.order.cancel')throw new Error('MONEY_044_LIVE_CAPABILITY_FORBIDDEN');if(!attempt.idempotencyKey||!attempt.actionFingerprint)throw new Error('MONEY_044_EXECUTION_IDENTITY_REQUIRED');if(attempt.provider!==attempt.actionSnapshot.provider)throw new Error('MONEY_044_PROVIDER_BINDING_INVALID')}
export function brokerContextFromAttempt(attempt:ExecutionAttempt,now:string):BrokerAdapterContext{assertSandboxExecutionAttempt(attempt);return Object.freeze({environment:'SANDBOX',executionId:attempt.attemptId,idempotencyKey:attempt.idempotencyKey,actionFingerprint:attempt.actionFingerprint,provider:attempt.provider,now})}
export function assertBrokerRequest(r:BrokerOrderRequest){if(!r.clientOrderId||!r.instrumentId||!r.currency)throw new Error('MONEY_044_ORDER_INCOMPLETE');if(Number(r.quantity)<=0||!Number.isFinite(Number(r.quantity)))throw new Error('MONEY_044_QUANTITY_INVALID');if(r.orderType==='LIMIT'&&(!r.limitPrice||Number(r.limitPrice)<=0))throw new Error('MONEY_044_LIMIT_PRICE_REQUIRED');if(r.orderType==='MARKET'&&r.limitPrice!==undefined)throw new Error('MONEY_044_MARKET_LIMIT_PRICE_FORBIDDEN')}
export function toProviderExecutionEvent(input:{attempt:ExecutionAttempt;providerEventId:string;providerReference?:string;state:ProviderExecutionEventState;occurredAt:string;observedAt:string;receivedAt:string;availableAt:string;evidenceId:string;sequence:number}):ProviderExecutionEvent{assertSandboxExecutionAttempt(input.attempt);const payload={providerEventId:input.providerEventId,state:input.state,providerReference:input.providerReference,sequence:input.sequence};return Object.freeze({eventId:'sandbox-event:'+hash044({executionId:input.attempt.attemptId,...payload}),providerEventId:input.providerEventId,provider:input.attempt.provider,executionId:input.attempt.attemptId,actionFingerprint:input.attempt.actionFingerprint,providerReference:input.providerReference,state:input.state,occurredAt:input.occurredAt,observedAt:input.observedAt,receivedAt:input.receivedAt,availableAt:input.availableAt,sequence:input.sequence,evidenceIds:Object.freeze([input.evidenceId]),payloadHash:hash044(payload),provenanceHash:hash044({payload,evidenceId:input.evidenceId}),authority:'EVIDENCE_ONLY'})}
