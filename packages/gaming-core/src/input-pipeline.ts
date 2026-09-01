import {InputIntegrityMonitor,type InputIntegrityEvent,type InputIntegrityResult} from './input-integrity.js';
import {GamingInputTransportBoundary} from './input-transport.js';
import type {ControllerInputGate,ControllerInputGateResult} from './controller-input-gate.js';

export interface GamingRuntimeInputAck {
  inputId:string;
  sequenceNumber:number;
  deliveredAtMs:number;
}

export interface GamingInputPipelineResult extends InputIntegrityResult {
  transported:boolean;
  acknowledgement?:GamingRuntimeInputAck;
  controllerGate:ControllerInputGateResult;
}

export interface GamingRuntimeInputSink {
  deliver(event:InputIntegrityEvent):Promise<GamingRuntimeInputAck>;
}

export class GamingInputPipeline {
  constructor(private readonly integrity:InputIntegrityMonitor,private readonly transport:GamingInputTransportBoundary,private readonly runtime:GamingRuntimeInputSink,private readonly controllerGate:ControllerInputGate){ }

  async submit(event:InputIntegrityEvent,nowMs=Date.now()):Promise<GamingInputPipelineResult>{
    const integrity=this.integrity.accept(event,nowMs);
    if(!integrity.accepted)return{...integrity,transported:false,controllerGate:this.controllerGate.authorize(event)};
    const controllerGate=this.controllerGate.authorize(event);
    if(!controllerGate.allowed)return{...integrity,transported:false,controllerGate};
    await this.transport.send(event);
    const acknowledgement=this.transport.deliveryMode==='runtime-delivery'
      ?await this.transport.deliverToRuntime(event)
      :await this.runtime.deliver(event);
    if(acknowledgement.inputId!==event.inputId||acknowledgement.sequenceNumber!==event.sequenceNumber){
      throw new Error('Runtime input acknowledgement does not match delivered input');
    }
    return{...integrity,transported:true,acknowledgement,controllerGate};
  }

  disconnect():void{this.integrity.disconnect();}
}
