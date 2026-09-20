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
  |'cancelled-after-accept'
  |'failed'
  |'delivery-unknown';

export type GamingInputSequenceDisposition='not-consumed'|'consumed';
export type GamingInputTransportDisposition='not-started'|'started'|'confirmed'|'unknown';

export interface GamingInputDeliverySnapshot {
  inputId:string;
  sequenceNumber:number;
  sessionId?:string;
  deviceId?:string;
  generation?:number;
  state:GamingInputDeliveryState;
  sequenceDisposition:GamingInputSequenceDisposition;
  transportDisposition:GamingInputTransportDisposition;
  observedAtMs:number;
  reason?:string;
}

export const TERMINAL_INPUT_DELIVERY_STATES=new Set<GamingInputDeliveryState>([
  'acknowledged','rejected','stale','cancelled-before-send','cancelled-after-accept','failed','delivery-unknown',
]);

const NEXT:Readonly<Record<GamingInputDeliveryState,readonly GamingInputDeliveryState[]>>={
  captured:['authorized','rejected','stale','cancelled-before-send'],
  authorized:['integrity-accepted','rejected','stale','cancelled-before-send'],
  'integrity-accepted':['transport-started','cancelled-after-accept','failed'],
  'transport-started':['transport-confirmed','delivery-unknown','failed'],
  'transport-confirmed':['runtime-delivered','delivery-unknown','failed'],
  'runtime-delivered':['acknowledged','delivery-unknown','failed'],
  acknowledged:[],
  rejected:[],
  stale:[],
  'cancelled-before-send':[],
  'cancelled-after-accept':[],
  failed:[],
  'delivery-unknown':[],
};

export class GamingInputDeliveryTracker {
  private readonly states=new Map<string,GamingInputDeliverySnapshot>();

  capture(
    input:{inputId:string;sequenceNumber:number;sessionId?:string;deviceId?:string;generation?:number},
    nowMs=Date.now(),
  ):GamingInputDeliverySnapshot{
    if(!input.inputId.trim())throw new Error('inputId is required');
    if(!Number.isInteger(input.sequenceNumber)||input.sequenceNumber<0)throw new Error('sequenceNumber must be a non-negative integer');
    if(!Number.isFinite(nowMs))throw new Error('nowMs must be finite');
    if(this.states.has(input.inputId))throw new Error('Input delivery state already exists');
    const snapshot:GamingInputDeliverySnapshot={
      ...input,
      state:'captured',
      sequenceDisposition:'not-consumed',
      transportDisposition:'not-started',
      observedAtMs:nowMs,
    };
    this.states.set(input.inputId,snapshot);
    return{...snapshot};
  }

  transition(inputId:string,state:GamingInputDeliveryState,nowMs=Date.now(),reason?:string):GamingInputDeliverySnapshot{
    const current=this.require(inputId);
    if(!Number.isFinite(nowMs)||nowMs<current.observedAtMs)throw new Error('Input delivery time must be monotonic');
    if(TERMINAL_INPUT_DELIVERY_STATES.has(current.state))throw new Error(`Input delivery state is terminal: ${current.state}`);
    if(!NEXT[current.state].includes(state))throw new Error(`Invalid input delivery transition: ${current.state} -> ${state}`);

    const sequenceDisposition:GamingInputSequenceDisposition=
      state==='integrity-accepted'||current.sequenceDisposition==='consumed'?'consumed':'not-consumed';

    let transportDisposition=current.transportDisposition;
    if(state==='transport-started')transportDisposition='started';
    else if(state==='transport-confirmed'||state==='runtime-delivered'||state==='acknowledged')transportDisposition='confirmed';
    else if(state==='delivery-unknown'&&current.transportDisposition==='started')transportDisposition='unknown';

    const next:GamingInputDeliverySnapshot={
      ...current,
      state,
      sequenceDisposition,
      transportDisposition,
      observedAtMs:nowMs,
      ...(reason?{reason}:{}),
    };
    this.states.set(inputId,next);
    return{...next};
  }

  transitionUnlessTerminal(inputId:string,state:GamingInputDeliveryState,nowMs=Date.now(),reason?:string):GamingInputDeliverySnapshot{
    const current=this.require(inputId);
    if(TERMINAL_INPUT_DELIVERY_STATES.has(current.state))return{...current};
    return this.transition(inputId,state,nowMs,reason);
  }

  markDisconnect(inputId:string,nowMs=Date.now()):GamingInputDeliverySnapshot{
    const current=this.require(inputId);
    if(TERMINAL_INPUT_DELIVERY_STATES.has(current.state))return{...current};
    if(current.state==='captured'||current.state==='authorized'){
      return this.transition(inputId,'cancelled-before-send',nowMs,'controller-disconnected');
    }
    if(current.state==='integrity-accepted'){
      return this.transition(inputId,'cancelled-after-accept',nowMs,'controller-disconnected');
    }
    return this.transition(inputId,'delivery-unknown',nowMs,'controller-disconnected');
  }

  isTerminal(inputId:string):boolean{return TERMINAL_INPUT_DELIVERY_STATES.has(this.require(inputId).state);}

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
