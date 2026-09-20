import type {ControllerCapability,ControllerCapabilityProfile} from './controller-capabilities.js';
import {assertControllerCapabilities} from './controller-capabilities.js';

export type ControllerInputKind='button'|'axis'|'trigger'|'dpad'|'haptic';
export const CONTROLLER_INPUT_CAPABILITY:Record<ControllerInputKind,ControllerCapability>={button:'buttons',axis:'axes',trigger:'triggers',dpad:'dpad',haptic:'haptics'};

export interface InputIntegrityEvent {
  inputId:string;
  sequenceNumber:number;
  capturedAtMs:number;
  sessionId?:string;
  deviceId?:string;
  inputKind:ControllerInputKind;
}

export type InputIntegrityState='healthy'|'reordered'|'duplicate'|'stale'|'disconnected'|'identity-mismatch'|'capability-mismatch';
export interface InputIntegrityResult {accepted:boolean;state:InputIntegrityState;lastSequenceNumber:number;expectedSequenceNumber:number;droppedCount:number;}
export interface InputIntegritySnapshot {sessionId?:string;deviceId?:string;lastSequenceNumber:number;acceptedCount:number;duplicateCount:number;reorderedCount:number;staleCount:number;droppedCount:number;state:InputIntegrityState;}

export class InputIntegrityMonitor {
  private last=-1;
  private seen=new Set<string>();
  private acceptedCount=0;
  private duplicateCount=0;
  private reorderedCount=0;
  private staleCount=0;
  private droppedCount=0;
  private state:InputIntegrityState='healthy';
  private sessionId?:string;
  private deviceId?:string;
  constructor(private readonly staleAfterMs=250,private readonly requireContiguousSequence=false){if(!Number.isFinite(staleAfterMs)||staleAfterMs<0)throw new Error('staleAfterMs must be non-negative');}
  bindIdentity(sessionId:string,deviceId:string):void{if(!sessionId.trim()||!deviceId.trim())throw new Error('sessionId and deviceId are required');this.sessionId=sessionId;this.deviceId=deviceId;this.resetStream();}
  clearIdentity():void{this.sessionId=undefined;this.deviceId=undefined;this.resetStream();this.state='disconnected';}
  accept(event:InputIntegrityEvent,nowMs=Date.now()):InputIntegrityResult {
    this.validate(event);
    if(!this.sessionId||!this.deviceId||event.sessionId!==this.sessionId||event.deviceId!==this.deviceId){this.state='identity-mismatch';return this.result(false,'identity-mismatch');}
    if(this.seen.has(event.inputId)){this.duplicateCount++;this.state='duplicate';return this.result(false,'duplicate');}
    const age=nowMs-event.capturedAtMs;
    if(age<0||age>this.staleAfterMs){this.staleCount++;this.state='stale';return this.result(false,'stale');}
    const expected=this.last+1;
    if(event.sequenceNumber<=this.last){this.reorderedCount++;this.state='reordered';return this.result(false,'reordered');}
    if(this.requireContiguousSequence&&event.sequenceNumber>expected){this.reorderedCount++;this.droppedCount+=event.sequenceNumber-expected;this.state='reordered';return this.result(false,'reordered');}
    this.seen.add(event.inputId);
    this.last=event.sequenceNumber;
    this.acceptedCount++;
    this.state='healthy';
    if(this.seen.size>2048){const first=this.seen.values().next().value;if(first)this.seen.delete(first);}
    return this.result(true,'healthy');
  }
  assertEventCapability(event:InputIntegrityEvent,profile:ControllerCapabilityProfile):void{
    if(event.deviceId!==profile.deviceId)throw new Error('Controller capability profile does not match input device');
    assertControllerCapabilities(profile,{required:[CONTROLLER_INPUT_CAPABILITY[event.inputKind]]});
  }
  disconnect():void{this.state='disconnected';}
  reconnect(nextSequence=this.last+1):void{if(!Number.isInteger(nextSequence)||nextSequence<0)throw new Error('nextSequence must be a non-negative integer');this.last=nextSequence-1;this.seen.clear();this.state='healthy';}
  snapshot():InputIntegritySnapshot{return{sessionId:this.sessionId,deviceId:this.deviceId,lastSequenceNumber:this.last,acceptedCount:this.acceptedCount,duplicateCount:this.duplicateCount,reorderedCount:this.reorderedCount,staleCount:this.staleCount,droppedCount:this.droppedCount,state:this.state};}
  private resetStream():void{this.last=-1;this.seen.clear();this.acceptedCount=0;this.duplicateCount=0;this.reorderedCount=0;this.staleCount=0;this.droppedCount=0;}
  private result(accepted:boolean,state:InputIntegrityState):InputIntegrityResult{return{accepted,state,lastSequenceNumber:this.last,expectedSequenceNumber:this.last+1,droppedCount:this.droppedCount};}
  private validate(event:InputIntegrityEvent):void{if(!event.inputId.trim())throw new Error('inputId is required');if(!Number.isInteger(event.sequenceNumber)||event.sequenceNumber<0)throw new Error('sequenceNumber must be a non-negative integer');if(!Number.isFinite(event.capturedAtMs))throw new Error('capturedAtMs must be finite');if(!Object.hasOwn(CONTROLLER_INPUT_CAPABILITY,event.inputKind))throw new Error('inputKind is invalid');}
}
