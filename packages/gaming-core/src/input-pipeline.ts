import {InputIntegrityMonitor,type InputIntegrityEvent,type InputIntegrityResult} from './input-integrity.js';
import {GamingInputTransportBoundary} from './input-transport.js';
import type {ControllerInputGate,ControllerInputGateResult} from './controller-input-gate.js';
import type {ControllerInputResyncManager} from './input-resync.js';

export interface GamingRuntimeInputAck {
  inputId:string;
  sequenceNumber:number;
  deliveredAtMs:number;
}

export type GamingInputResyncReason='ready'|'not-resynchronized';

export interface GamingInputResyncResult {
  allowed:boolean;
  reason:GamingInputResyncReason;
}

export interface GamingInputPipelineResult extends InputIntegrityResult {
  transported:boolean;
  acknowledgement?:GamingRuntimeInputAck;
  controllerGate:ControllerInputGateResult;
  resync:GamingInputResyncResult;
}

export interface GamingRuntimeInputSink {
  deliver(event:InputIntegrityEvent):Promise<GamingRuntimeInputAck>;
}

export class GamingInputPipeline {
  constructor(private readonly integrity:InputIntegrityMonitor,private readonly transport:GamingInputTransportBoundary,private readonly runtime:GamingRuntimeInputSink,private readonly controllerGate:ControllerInputGate,private readonly resync:ControllerInputResyncManager){ }

  async submit(event:InputIntegrityEvent,nowMs=Date.now()):Promise<GamingInputPipelineResult>{
    const integrity=this.integrity.accept(event,nowMs);
    const controllerGate=this.controllerGate.authorize(event);
    if(!integrity.accepted)return{...integrity,transported:false,controllerGate,resync:{allowed:false,reason:'not-resynchronized'}};
    if(!controllerGate.allowed)return{...integrity,transported:false,controllerGate,resync:{allowed:false,reason:'not-resynchronized'}};
    const resync=this.checkResync(event);
    if(!resync.allowed)return{...integrity,transported:false,controllerGate,resync};
    await this.transport.send(event);
    const acknowledgement=this.transport.deliveryMode==='runtime-delivery'
      ?await this.transport.deliverToRuntime(event)
      :await this.runtime.deliver(event);
    if(acknowledgement.inputId!==event.inputId||acknowledgement.sequenceNumber!==event.sequenceNumber){
      throw new Error('Runtime input acknowledgement does not match delivered input');
    }
    return{...integrity,transported:true,acknowledgement,controllerGate,resync};
  }

  disconnect(sessionId:string,deviceId:string):void{this.resync.disconnect(sessionId,deviceId);}

  private checkResync(event:InputIntegrityEvent):GamingInputResyncResult{
    if(!event.sessionId||!event.deviceId)return{allowed:false,reason:'not-resynchronized'};
    try{this.resync.assertReady(event.sessionId,event.deviceId);return{allowed:true,reason:'ready'};}
    catch{return{allowed:false,reason:'not-resynchronized'};}
  }
}
