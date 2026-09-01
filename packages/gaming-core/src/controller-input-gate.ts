import type {InputIntegrityEvent} from './input-integrity.js';
import {CONTROLLER_INPUT_CAPABILITY} from './input-integrity.js';
import type {ControllerHealthResult} from './controller-health.js';
import type {ControllerSessionBindingManager} from './controller-session-binding.js';
import type {ControllerCapability} from './controller-capabilities.js';
import {assertControllerCapabilities} from './controller-capabilities.js';

export type ControllerInputGateReason='healthy'|'controller-unhealthy'|'controller-health-stale'|'controller-unbound'|'session-mismatch'|'controller-health-session-mismatch'|'controller-capability-mismatch';

export interface ControllerInputGateResult {
  allowed:boolean;
  reason:ControllerInputGateReason;
  deviceId:string;
  sessionId:string;
  health?:ControllerHealthResult;
  healthObservedAtMs?:number;
}

export interface ControllerHealthGatePolicy {maxHealthAgeMs:number;}
export interface ControllerInputGatePolicy extends ControllerHealthGatePolicy {requiredCapabilities?:readonly ControllerCapability[];}
export const DEFAULT_CONTROLLER_HEALTH_GATE_POLICY:ControllerHealthGatePolicy={maxHealthAgeMs:250};
interface HealthEnvelope {result:ControllerHealthResult;observedAtMs:number;sessionId:string;}

export class ControllerInputGate {
  private readonly health=new Map<string,HealthEnvelope>();
  private readonly policy:ControllerInputGatePolicy;

  constructor(private readonly bindings:ControllerSessionBindingManager,policy:ControllerInputGatePolicy=DEFAULT_CONTROLLER_HEALTH_GATE_POLICY){
    if(!Number.isFinite(policy.maxHealthAgeMs)||policy.maxHealthAgeMs<0)throw new Error('maxHealthAgeMs must be finite and non-negative');
    this.policy={...policy};
  }

  updateHealth(result:ControllerHealthResult,observedAtMs=Date.now()):void{
    if(!Number.isFinite(observedAtMs))throw new Error('observedAtMs must be finite');
    const binding=this.bindings.get();
    if(!binding||binding.state!=='bound'||binding.deviceId!==result.deviceId)throw new Error('Controller health requires an active session binding');
    this.health.set(result.deviceId,{result,observedAtMs,sessionId:binding.sessionId});
  }

  clearHealth(deviceId:string):void{this.health.delete(deviceId);}

  authorize(event:InputIntegrityEvent,nowMs=Date.now()):ControllerInputGateResult{
    if(!Number.isFinite(nowMs))throw new Error('nowMs must be finite');
    const deviceId=event.deviceId;
    const sessionId=event.sessionId;
    if(!deviceId||!sessionId)return{allowed:false,reason:'session-mismatch',deviceId:deviceId??'',sessionId:sessionId??''};
    let binding;
    try{binding=this.bindings.assertBound(sessionId,deviceId);}catch{return{allowed:false,reason:'controller-unbound',deviceId,sessionId};}
    if(binding.sessionId!==sessionId||binding.deviceId!==deviceId)return{allowed:false,reason:'session-mismatch',deviceId,sessionId};
    const envelope=this.health.get(deviceId);
    if(!envelope)return{allowed:false,reason:'controller-unhealthy',deviceId,sessionId};
    const {result:health,observedAtMs}=envelope;
    if(envelope.sessionId!==sessionId)return{allowed:false,reason:'controller-health-session-mismatch',deviceId,sessionId,health,healthObservedAtMs:observedAtMs};
    if(nowMs<observedAtMs||nowMs-observedAtMs>this.policy.maxHealthAgeMs)return{allowed:false,reason:'controller-health-stale',deviceId,sessionId,health,healthObservedAtMs:observedAtMs};
    if(!health.accepted||health.state!=='healthy')return{allowed:false,reason:'controller-unhealthy',deviceId,sessionId,health,healthObservedAtMs:observedAtMs};
    const requiredCapabilities=[...(this.policy.requiredCapabilities??[]),CONTROLLER_INPUT_CAPABILITY[event.inputKind]].filter((capability,index,array):capability is ControllerCapability=>Boolean(capability)&&array.indexOf(capability)===index);
    try{assertControllerCapabilities({deviceId,capabilities:binding.capabilities},{required:requiredCapabilities});}
    catch{return{allowed:false,reason:'controller-capability-mismatch',deviceId,sessionId,health,healthObservedAtMs:observedAtMs};}
    return{allowed:true,reason:'healthy',deviceId,sessionId,health,healthObservedAtMs:observedAtMs};
  }
}
