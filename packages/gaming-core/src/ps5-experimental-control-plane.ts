import {Ps5ExperimentalReferenceCatalog} from './ps5-experimental-catalog.js';
import {authorizePs5ExperimentalAction,type Ps5ExperimentalAction} from './ps5-experimental-policy.js';
import {Ps5ExperimentalAuditLedger,type Ps5ExperimentalReceipt} from './ps5-experimental-ledger.js';

export interface Ps5ExperimentalActionRequest {
  referenceId:string;
  action:Ps5ExperimentalAction;
  experimentalModeEnabled:boolean;
  explicitUserApproval:boolean;
  nowMs?:number;
}

export interface Ps5ExperimentalActionDecision {
  receipt:Ps5ExperimentalReceipt;
  allowed:boolean;
}

export class Ps5ExperimentalControlPlane {
  constructor(
    private readonly catalog:Ps5ExperimentalReferenceCatalog,
    private readonly ledger:Ps5ExperimentalAuditLedger,
  ){}

  authorize(request:Ps5ExperimentalActionRequest):Ps5ExperimentalActionDecision{
    const reference=this.catalog.get(request.referenceId);
    if(!reference)throw new Error(`Unknown PS5 experimental reference: ${request.referenceId}`);
    const result=authorizePs5ExperimentalAction({
      experimentalModeEnabled:request.experimentalModeEnabled,
      explicitUserApproval:request.explicitUserApproval,
      action:request.action,
      reference,
    });
    const receipt=this.ledger.record(reference,request.action,result,request.explicitUserApproval,request.nowMs);
    return{receipt,allowed:result.allowed};
  }
}
