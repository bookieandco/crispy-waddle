import type {InputIntegrityEvent} from './input-integrity.js';
import type {ControllerHealthResult} from './controller-health.js';
import type {ControllerSessionBindingManager} from './controller-session-binding.js';

export type ControllerInputGateReason='healthy'|'controller-unhealthy'|'controller-unbound'|'session-mismatch';

export interface ControllerInputGateResult {
  allowed:boolean;
  reason:ControllerInputGateReason;
  deviceId:string;
  sessionId:string;
  health?:ControllerHealthResult;
}

export class ControllerInputGate {
  private readonly health=new Map<string,ControllerHealthResult>();

  constructor(private readonly bindings:ControllerSessionBindingManager){}

  updateHealth(result:ControllerHealthResult):void{this.health.set(result.deviceId,result);}

  clearHealth(deviceId:string):void{this.health.delete(deviceId);}

  authorize(event:InputIntegrityEvent):ControllerInputGateResult{
    const deviceId=event.deviceId;
    const sessionId=event.sessionId;
    if(!deviceId||!sessionId)return{allowed:false,reason:'session-mismatch',deviceId:deviceId??'',sessionId:sessionId??''};
    let binding;
    try{binding=this.bindings.assertBound(sessionId,deviceId);}catch{
      return{allowed:false,reason:'controller-unbound',deviceId,sessionId};
    }
    if(binding.sessionId!==sessionId||binding.deviceId!==deviceId)return{allowed:false,reason:'session-mismatch',deviceId,sessionId};
    const health=this.health.get(deviceId);
    if(!health||!health.accepted||health.state!=='healthy')return{allowed:false,reason:'controller-unhealthy',deviceId,sessionId,health};
    return{allowed:true,reason:'healthy',deviceId,sessionId,health};
  }
}
