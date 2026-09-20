import type {ControllerCapability} from './controller-capabilities.js';
import type {ControllerHealthResult} from './controller-health.js';
import type {ControllerSessionBindingManager,ControllerDevice as SessionControllerDevice} from './controller-session-binding.js';
import type {ControllerInputGate} from './controller-input-gate.js';
import type {ControllerInputResyncManager} from './input-resync.js';
import type {InputIntegrityMonitor} from './input-integrity.js';
import type {GamingInputPipeline} from './input-pipeline.js';
import type {GamingInputTransportBoundary} from './input-transport.js';
import type {GamingControllerLifecycle} from './gaming-session-orchestrator.js';

export interface GamingControllerDeviceProvider {
  get(deviceId:string):Promise<SessionControllerDevice|undefined>|SessionControllerDevice|undefined;
}

export type GamingControllerHealthProvider=(deviceId:string)=>ControllerHealthResult;

const defaultHealth=(deviceId:string):ControllerHealthResult=>({
  deviceId,
  state:'healthy',
  accepted:true,
  normalizedAxes:[],
  normalizedTriggers:[],
  jitterDetected:false,
  outOfRange:false,
});

export class CertifiedGamingInputSessionController implements GamingControllerLifecycle {
  constructor(
    private readonly devices:GamingControllerDeviceProvider,
    private readonly bindings:ControllerSessionBindingManager,
    private readonly integrity:InputIntegrityMonitor,
    private readonly resync:ControllerInputResyncManager,
    private readonly gate:ControllerInputGate,
    private readonly transport:GamingInputTransportBoundary,
    private readonly pipeline:GamingInputPipeline,
    private readonly health:GamingControllerHealthProvider=defaultHealth,
  ){}

  async bind(sessionId:string,deviceId:string):Promise<void>{
    const device=await this.requireDevice(deviceId);
    this.bindings.bind(sessionId,device);
    this.integrity.bindIdentity(sessionId,deviceId);
    try{
      const started=this.resync.beginReconnect(sessionId,deviceId,0);
      await this.transport.connect(sessionId,deviceId);
      this.resync.completeResync(sessionId,deviceId,started.nextSequenceNumber);
      this.gate.updateHealth(this.health(deviceId));
    }catch(error){
      this.gate.clearHealth(deviceId);
      this.integrity.clearIdentity();
      try{this.bindings.unbind(sessionId,deviceId);}catch{}
      throw error;
    }
  }

  async disconnect(sessionId:string,deviceId:string):Promise<number>{
    const binding=this.bindings.get();
    if(!binding||binding.sessionId!==sessionId||binding.deviceId!==deviceId)return this.resync.snapshot(sessionId,deviceId).nextSequenceNumber;
    if(binding.state==='bound'){
      await this.pipeline.disconnect(sessionId,deviceId);
      this.bindings.disconnect(deviceId);
    }
    return this.resync.snapshot(sessionId,deviceId).nextSequenceNumber;
  }

  async reconnect(sessionId:string,deviceId:string):Promise<number>{
    const device=await this.requireDevice(deviceId);
    this.bindings.reconnect(sessionId,device);
    const started=this.resync.beginReconnect(sessionId,deviceId);
    await this.transport.connect(sessionId,deviceId);
    const ready=this.resync.completeResync(sessionId,deviceId,started.nextSequenceNumber);
    this.gate.updateHealth(this.health(deviceId));
    return ready.nextSequenceNumber;
  }

  async unbind(sessionId:string,deviceId:string):Promise<void>{
    const binding=this.bindings.get();
    if(binding&&binding.sessionId===sessionId&&binding.deviceId===deviceId&&binding.state!=='unbound'){
      this.bindings.unbind(sessionId,deviceId);
    }
    this.gate.clearHealth(deviceId);
    this.integrity.clearIdentity();
  }

  private async requireDevice(deviceId:string):Promise<SessionControllerDevice>{
    const device=await this.devices.get(deviceId);
    if(!device)throw new Error(`Controller device not available: ${deviceId}`);
    return device;
  }
}

export function connectedControllerDevice(
  deviceId:string,
  capabilities:readonly ControllerCapability[]=['buttons','axes','triggers','dpad','haptics'],
):SessionControllerDevice{
  return{deviceId,connected:true,capabilities};
}
