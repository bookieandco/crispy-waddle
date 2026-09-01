import type {ControllerCapability} from './controller-capabilities.js';

export type ControllerBindingState='bound'|'unbound'|'disconnected';

export interface ControllerDevice {
  deviceId:string;
  sessionId?:string;
  connected:boolean;
  capabilities:readonly ControllerCapability[];
}

export interface ControllerSessionBinding {
  sessionId:string;
  deviceId:string;
  boundAtMs:number;
  state:ControllerBindingState;
  capabilities:readonly ControllerCapability[];
}

export interface ControllerSessionBindingPolicy {
  requiredCapabilities?:readonly ControllerCapability[];
  allowRebind:boolean;
}

export class ControllerSessionBindingManager {
  private binding?:ControllerSessionBinding;

  constructor(private readonly policy:ControllerSessionBindingPolicy={allowRebind:false}){}

  bind(sessionId:string,device:ControllerDevice,nowMs=Date.now()):ControllerSessionBinding {
    this.validateId(sessionId,'sessionId');
    this.validateDevice(device);
    if(!Number.isFinite(nowMs))throw new Error('nowMs must be finite');
    if(!device.connected)throw new Error('Controller device is not connected');
    if(this.binding&&this.binding.state==='bound'){
      if(this.binding.sessionId===sessionId&&this.binding.deviceId===device.deviceId)return this.binding;
      if(!this.policy.allowRebind)throw new Error('Controller is already bound to another session');
    }
    this.assertRequiredCapabilities(device.capabilities);
    this.binding={sessionId,deviceId:device.deviceId,boundAtMs:nowMs,state:'bound',capabilities:Object.freeze([...device.capabilities])};
    return this.binding;
  }

  disconnect(deviceId:string):ControllerSessionBinding|undefined {
    if(this.binding?.deviceId!==deviceId)return this.binding;
    this.binding={...this.binding,state:'disconnected'};
    return this.binding;
  }

  reconnect(sessionId:string,device:ControllerDevice,nowMs=Date.now()):ControllerSessionBinding {
    this.validateId(sessionId,'sessionId');
    this.validateDevice(device);
    if(!device.connected)throw new Error('Controller device is not connected');
    if(!this.binding||this.binding.state==='unbound')return this.bind(sessionId,device,nowMs);
    if(this.binding.sessionId!==sessionId||this.binding.deviceId!==device.deviceId)throw new Error('Controller reconnect does not match the existing session binding');
    this.assertCapabilitiesUnchanged(device.capabilities);
    this.binding={...this.binding,state:'bound'};
    return this.binding;
  }

  unbind(sessionId:string,deviceId:string):void {
    if(this.binding?.sessionId!==sessionId||this.binding.deviceId!==deviceId)throw new Error('Controller binding does not match session');
    this.binding={...this.binding,state:'unbound'};
  }

  assertBound(sessionId:string,deviceId:string):ControllerSessionBinding {
    if(this.binding?.state!=='bound'||this.binding.sessionId!==sessionId||this.binding.deviceId!==deviceId)throw new Error('Controller is not bound to the requested gaming session');
    return this.binding;
  }

  get():ControllerSessionBinding|undefined{return this.binding;}

  private validateDevice(device:ControllerDevice):void{
    this.validateId(device.deviceId,'deviceId');
    if(!Array.isArray(device.capabilities))throw new Error('Controller capabilities must be an array');
  }

  private assertRequiredCapabilities(capabilities:readonly ControllerCapability[]):void{
    const available=new Set(capabilities);
    for(const capability of this.policy.requiredCapabilities??[]){
      if(!available.has(capability))throw new Error(`Controller capability required: ${capability}`);
    }
  }

  private assertCapabilitiesUnchanged(capabilities:readonly ControllerCapability[]):void{
    if(!this.binding)throw new Error('Controller binding is missing');
    const bound=new Set(this.binding.capabilities);
    const current=new Set(capabilities);
    if(bound.size!==current.size||[...bound].some(capability=>!current.has(capability)))throw new Error('Controller capabilities changed during session binding');
  }

  private validateId(value:string,name:string):void{if(typeof value!=='string'||!value.trim())throw new Error(`${name} is required`);}
}
