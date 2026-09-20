import {InputIntegrityMonitor,type InputIntegrityEvent,type InputIntegrityResult} from './input-integrity.js';
import {GamingInputTransportBoundary,type GamingInputTransportReceipt} from './input-transport.js';
import {GamingInputDeliveryTracker,type GamingInputDeliverySnapshot} from './input-delivery-state.js';
import type {ControllerInputGate,ControllerInputGateResult} from './controller-input-gate.js';
import type {ControllerInputResyncManager} from './input-resync.js';

export interface GamingRuntimeInputAck {inputId:string;sequenceNumber:number;deliveredAtMs:number;}
export type GamingInputResyncReason='ready'|'not-resynchronized';
export interface GamingInputResyncResult {allowed:boolean;reason:GamingInputResyncReason;}
export interface GamingInputPipelineResult extends InputIntegrityResult {
  transported:boolean;
  transportReceipt?:GamingInputTransportReceipt;
  acknowledgement?:GamingRuntimeInputAck;
  controllerGate:ControllerInputGateResult;
  resync:GamingInputResyncResult;
  delivery:GamingInputDeliverySnapshot;
}
export interface GamingRuntimeInputSink {deliver(event:InputIntegrityEvent):Promise<GamingRuntimeInputAck>;}

export class GamingInputPipeline {
  private submissionTail:Promise<void>=Promise.resolve();
  private generation=0;
  private readonly active=new Set<string>();

  constructor(
    private readonly integrity:InputIntegrityMonitor,
    private readonly transport:GamingInputTransportBoundary,
    private readonly runtime:GamingRuntimeInputSink,
    private readonly controllerGate:ControllerInputGate,
    private readonly resync:ControllerInputResyncManager,
    private readonly delivery=new GamingInputDeliveryTracker(),
  ){}

  submit(event:InputIntegrityEvent,nowMs?:number):Promise<GamingInputPipelineResult>{
    const generation=this.generation;
    const capturedAt=nowMs??Date.now();
    this.delivery.capture({...event,generation},capturedAt);
    this.active.add(event.inputId);
    const run=this.submissionTail.then(()=>this.submitSerialized(event,nowMs??Date.now(),generation));
    this.submissionTail=run.then(()=>undefined,()=>undefined);
    void run.finally(()=>this.active.delete(event.inputId)).catch(()=>undefined);
    return run;
  }

  private async submitSerialized(event:InputIntegrityEvent,nowMs:number,generation:number):Promise<GamingInputPipelineResult>{
    if(generation!==this.generation)return this.cancelledResult(event);

    const controllerGate=this.controllerGate.authorize(event,nowMs);
    if(!controllerGate.allowed){
      const delivery=this.delivery.transition(event.inputId,'rejected',nowMs,controllerGate.reason);
      return this.result(this.integritySnapshotResult(),false,controllerGate,{allowed:false,reason:'not-resynchronized'},delivery);
    }

    this.delivery.transition(event.inputId,'authorized',nowMs);
    const resync=this.checkResync(event);
    if(!resync.allowed){
      const delivery=this.delivery.transition(event.inputId,'rejected',nowMs,resync.reason);
      return this.result(this.integritySnapshotResult(),false,controllerGate,resync,delivery);
    }

    if(generation!==this.generation)return this.cancelledResult(event,controllerGate,resync);
    const integrity=this.integrity.accept(event,nowMs);
    if(!integrity.accepted){
      const delivery=this.delivery.transition(event.inputId,integrity.state==='stale'?'stale':'rejected',nowMs,integrity.state);
      return this.result(integrity,false,controllerGate,resync,delivery);
    }

    this.delivery.transition(event.inputId,'integrity-accepted',nowMs);
    if(generation!==this.generation)return this.cancelledResult(event,controllerGate,resync);

    this.delivery.transition(event.inputId,'transport-started',nowMs);
    let transportReceipt:GamingInputTransportReceipt;
    try{
      transportReceipt=await this.transport.send(event);
    }catch(error){
      if(!this.delivery.isTerminal(event.inputId)){
        this.delivery.transition(event.inputId,'delivery-unknown',Date.now(),error instanceof Error?error.message:'transport-failed');
      }
      return this.unknownResult(event,controllerGate,resync);
    }

    if(generation!==this.generation||this.delivery.isTerminal(event.inputId)){
      return this.unknownResult(event,controllerGate,resync,transportReceipt);
    }

    this.delivery.transition(
      event.inputId,
      'transport-confirmed',
      transportReceipt.confirmedAtMs,
      transportReceipt.status==='over-budget'?`transport-latency-over-budget:${transportReceipt.latencyMs}ms`:undefined,
    );

    let acknowledgement:GamingRuntimeInputAck;
    try{
      acknowledgement=this.transport.deliveryMode==='runtime-delivery'
        ?await this.transport.deliverToRuntime(event)
        :await this.runtime.deliver(event);
    }catch(error){
      if(!this.delivery.isTerminal(event.inputId)){
        this.delivery.transition(event.inputId,'delivery-unknown',Date.now(),error instanceof Error?error.message:'runtime-delivery-failed');
      }
      return this.unknownResult(event,controllerGate,resync,transportReceipt);
    }

    if(generation!==this.generation||this.delivery.isTerminal(event.inputId)){
      return this.unknownResult(event,controllerGate,resync,transportReceipt,acknowledgement);
    }

    this.delivery.transition(event.inputId,'runtime-delivered',Math.max(Date.now(),acknowledgement.deliveredAtMs));
    if(acknowledgement.inputId!==event.inputId||acknowledgement.sequenceNumber!==event.sequenceNumber){
      const delivery=this.delivery.transition(event.inputId,'delivery-unknown',Date.now(),'runtime-ack-mismatch');
      return this.result(this.integritySnapshotResult(),true,controllerGate,resync,delivery,transportReceipt,acknowledgement);
    }

    const delivery=this.delivery.transition(event.inputId,'acknowledged',Math.max(Date.now(),acknowledgement.deliveredAtMs));
    return this.result(integrity,true,controllerGate,resync,delivery,transportReceipt,acknowledgement);
  }

  async disconnect(sessionId:string,deviceId:string):Promise<void>{
    this.generation++;
    const nowMs=Date.now();
    for(const inputId of this.active){
      const snapshot=this.delivery.get(inputId);
      if(snapshot&&snapshot.sessionId===sessionId&&snapshot.deviceId===deviceId)this.delivery.markDisconnect(inputId,nowMs);
    }
    this.controllerGate.clearHealth(deviceId);
    this.resync.disconnect(sessionId,deviceId);
    await this.transport.disconnect();
  }

  deliveryState(inputId:string):GamingInputDeliverySnapshot|undefined{return this.delivery.get(inputId);}

  private cancelledResult(
    event:InputIntegrityEvent,
    controllerGate?:ControllerInputGateResult,
    resync:GamingInputResyncResult={allowed:false,reason:'not-resynchronized'},
  ):GamingInputPipelineResult{
    const delivery=this.delivery.get(event.inputId)??this.delivery.capture({...event,generation:this.generation});
    const final=this.delivery.isTerminal(event.inputId)?delivery:this.delivery.markDisconnect(event.inputId);
    const gate=controllerGate??{allowed:false,reason:'controller-unbound',deviceId:event.deviceId??'',sessionId:event.sessionId??''};
    return this.result(this.integritySnapshotResult(),false,gate,resync,final);
  }

  private unknownResult(
    event:InputIntegrityEvent,
    controllerGate:ControllerInputGateResult,
    resync:GamingInputResyncResult,
    transportReceipt?:GamingInputTransportReceipt,
    acknowledgement?:GamingRuntimeInputAck,
  ):GamingInputPipelineResult{
    let delivery=this.delivery.get(event.inputId)!;
    if(!this.delivery.isTerminal(event.inputId)){
      delivery=this.delivery.transition(event.inputId,'delivery-unknown',Date.now(),'delivery-status-uncertain');
    }
    return this.result(this.integritySnapshotResult(),delivery.transportDisposition==='confirmed',controllerGate,resync,delivery,transportReceipt,acknowledgement);
  }

  private result(
    integrity:InputIntegrityResult,
    transported:boolean,
    controllerGate:ControllerInputGateResult,
    resync:GamingInputResyncResult,
    delivery:GamingInputDeliverySnapshot,
    transportReceipt?:GamingInputTransportReceipt,
    acknowledgement?:GamingRuntimeInputAck,
  ):GamingInputPipelineResult{
    return{...integrity,transported,transportReceipt,acknowledgement,controllerGate,resync,delivery};
  }

  private integritySnapshotResult():InputIntegrityResult{
    const snapshot=this.integrity.snapshot();
    return{accepted:false,state:snapshot.state,lastSequenceNumber:snapshot.lastSequenceNumber,expectedSequenceNumber:snapshot.lastSequenceNumber+1,droppedCount:snapshot.droppedCount};
  }

  private checkResync(event:InputIntegrityEvent):GamingInputResyncResult{
    if(!event.sessionId||!event.deviceId)return{allowed:false,reason:'not-resynchronized'};
    try{this.resync.assertReady(event.sessionId,event.deviceId);return{allowed:true,reason:'ready'};}
    catch{return{allowed:false,reason:'not-resynchronized'};}
  }
}
