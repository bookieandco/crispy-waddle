export type GamingInputDeliveryState=
  |'captured'
  |'authorized'
  |'integrity-accepted'
  |'transport-started'
  |'transport-confirmed'
  |'runtime-delivered'
  |'acknowledged'
  |'rejected'
  |'stale'
  |'cancelled-before-send'
  |'failed'
  |'delivery-unknown';

export interface GamingInputDeliverySnapshot {
  inputId:string;
  sequenceNumber:number;
  sessionId?:string;
  deviceId?:string;
  state:GamingInputDeliveryState;
  observedAtMs:number;
  reason?:string;
}

const TERMINAL=new Set<GamingInputDeliveryState>([
  'acknowledged','rejected','stale','cancelled-before-send','failed','delivery-unknown',
]);

const NEXT:Readonly<Record<GamingInputDeliveryState,readonly GamingInputDeliveryState[]>>={
  captured:['authorized','rejected','stale','cancelled-before-send'],
  authorized:['integrity-accepted','rejected','stale','cancelled-before-send'],
  'integrity-accepted':['transport-started','cancelled-before-send','failed'],
  'transport-started':['transport-confirmed','delivery-unknown','failed'],
  'transport-confirmed':['runtime-delivered','delivery-unknown','failed'],
  'runtime-delivered':['acknowledged','delivery-unknown','failed'],
  acknowledged:[],
  rejected:[],
  stale:[],
  'cancelled-before-send':[],
  failed:[],
  'delivery-unknown':[],
};

export class GamingInputDeliveryTracker {
  private readonly states=new Map<string,GamingInputDeliverySnapshot>();

  capture(input:{inputId:string;sequenceNumber:number;sessionId?:string;deviceId?:string},nowMs=Date.now()):GamingInputDeliverySnapshot{
    if(!input.inputId.trim())throw new Error('inputId is required');
    if(!Number.isInteger(input.sequenceNumber)||input.sequenceNumber<0)throw new Error('sequenceNumber must be a non-negative integer');
    if(!Number.isFinite(nowMs))throw new Error('nowMs must be finite');
    if(this.states.has(input.inputId))throw new Error('Input delivery state already exists');
    const snapshot:GamingInputDeliverySnapshot={...input,state:'captured',observedAtMs:nowMs};
    this.states.set(input.inputId,snapshot);
    return{...snapshot};
  }

  transition(inputId:string,state:GamingInputDeliveryState,nowMs=Date.now(),reason?:string):GamingInputDeliverySnapshot{
    const current=this.require(inputId);
    if(!Number.isFinite(nowMs)||nowMs<current.observedAtMs)throw new Error('Input delivery time must be monotonic');
    if(TERMINAL.has(current.state))throw new Error(`Input delivery state is terminal: ${current.state}`);
    if(!NEXT[current.state].includes(state))throw new Error(`Invalid input delivery transition: ${current.state} -> ${state}`);
    const next:GamingInputDeliverySnapshot={...current,state,observedAtMs:nowMs,...(reason?{reason}:{})};
    this.states.set(inputId,next);
    return{...next};
  }

  markDisconnect(inputId:string,nowMs=Date.now()):GamingInputDeliverySnapshot{
    const current=this.require(inputId);
    if(TERMINAL.has(current.state))return{...current};
    const state:GamingInputDeliveryState=current.state==='captured'||current.state==='authorized'||current.state==='integrity-accepted'
      ?'cancelled-before-send'
      :'delivery-unknown';
    return this.transition(inputId,state,nowMs,'controller-disconnected');
  }

  get(inputId:string):GamingInputDeliverySnapshot|undefined{
    const current=this.states.get(inputId);
    return current?{...current}:undefined;
  }

  private require(inputId:string):GamingInputDeliverySnapshot{
    const current=this.states.get(inputId);
    if(!current)throw new Error(`Unknown input delivery state: ${inputId}`);
    return current;
  }
}
