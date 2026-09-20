import type {Ps5ExperimentalAction,Ps5ExperimentalAuthorizationResult} from './ps5-experimental-policy.js';
import type {Ps5ExperimentalReference} from './ps5-experimental-catalog.js';

export interface Ps5ExperimentalReceipt {
  receiptId:string;
  referenceId:string;
  repository:string;
  action:Ps5ExperimentalAction;
  allowed:boolean;
  reason:Ps5ExperimentalAuthorizationResult['reason'];
  explicitUserApproval:boolean;
  observedAtMs:number;
}

export interface Ps5ExperimentalReceiptSink {
  record(receipt:Ps5ExperimentalReceipt):Promise<void>|void;
}

export class InMemoryPs5ExperimentalReceiptSink implements Ps5ExperimentalReceiptSink {
  private readonly receipts:Ps5ExperimentalReceipt[]=[];
  record(receipt:Ps5ExperimentalReceipt):void{this.receipts.push(Object.freeze({...receipt}));}
  list():readonly Ps5ExperimentalReceipt[]{return this.receipts.map(receipt=>({...receipt}));}
}

export class Ps5ExperimentalAuditLedger {
  private sequence=1;

  constructor(private readonly sink:Ps5ExperimentalReceiptSink){}

  record(
    reference:Ps5ExperimentalReference,
    action:Ps5ExperimentalAction,
    authorization:Ps5ExperimentalAuthorizationResult,
    explicitUserApproval:boolean,
    observedAtMs=Date.now(),
  ):Ps5ExperimentalReceipt{
    if(!Number.isFinite(observedAtMs))throw new Error('observedAtMs must be finite');
    const receipt:Ps5ExperimentalReceipt={
      receiptId:`ps5x:${this.sequence++}`,
      referenceId:reference.id,
      repository:reference.repository,
      action,
      allowed:authorization.allowed,
      reason:authorization.reason,
      explicitUserApproval,
      observedAtMs,
    };
    void this.sink.record(receipt);
    return{...receipt};
  }
}
