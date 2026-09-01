import type {InputIntegrityMonitor} from './input-integrity.js';
import type {ControllerSessionBindingManager} from './controller-session-binding.js';

export type ControllerResyncState='disconnected'|'awaiting-resync'|'ready';

export interface ControllerResyncSnapshot {
  sessionId:string;
  deviceId:string;
  state:ControllerResyncState;
  nextSequenceNumber:number;
}

export class ControllerInputResyncManager {
  private state:ControllerResyncState='disconnected';
  private sessionId?:string;
  private deviceId?:string;
  private nextSequenceNumber=0;

  constructor(private readonly bindings:ControllerSessionBindingManager,private readonly integrity:InputIntegrityMonitor){}

  disconnect(sessionId:string,deviceId:string):ControllerResyncSnapshot{
    this.assertIdentity(sessionId,deviceId);
    this.integrity.disconnect();
    this.state='awaiting-resync';
    this.nextSequenceNumber=0;
    return this.snapshot(sessionId,deviceId);
  }

  beginReconnect(sessionId:string,deviceId:string,nextSequenceNumber:number):ControllerResyncSnapshot{
    if(!Number.isInteger(nextSequenceNumber)||nextSequenceNumber<0)throw new Error('nextSequenceNumber must be a non-negative integer');
    this.bindings.assertBound(sessionId,deviceId);
    this.sessionId=sessionId;
    this.deviceId=deviceId;
    this.integrity.bindIdentity(sessionId,deviceId);
    this.nextSequenceNumber=nextSequenceNumber;
    this.state='awaiting-resync';
    return this.snapshot(sessionId,deviceId);
  }

  completeResync(sessionId:string,deviceId:string,nextSequenceNumber:number):ControllerResyncSnapshot{
    if(!Number.isInteger(nextSequenceNumber)||nextSequenceNumber<0)throw new Error('nextSequenceNumber must be a non-negative integer');
    this.bindings.assertBound(sessionId,deviceId);
    if(this.state!=='awaiting-resync')throw new Error('Controller is not awaiting input resynchronization');
    if(this.sessionId!==sessionId||this.deviceId!==deviceId)throw new Error('Controller resync identity does not match the active session');
    this.integrity.reconnect(nextSequenceNumber);
    this.nextSequenceNumber=nextSequenceNumber;
    this.state='ready';
    return this.snapshot(sessionId,deviceId);
  }

  assertReady(sessionId:string,deviceId:string):ControllerResyncSnapshot{
    this.assertIdentity(sessionId,deviceId);
    if(this.state!=='ready')throw new Error('Controller input is not resynchronized');
    return this.snapshot(sessionId,deviceId);
  }

  snapshot(sessionId=this.sessionId??'',deviceId=this.deviceId??''):ControllerResyncSnapshot{return{sessionId,deviceId,state:this.state,nextSequenceNumber:this.nextSequenceNumber};}

  private assertIdentity(sessionId:string,deviceId:string):void{
    if(!sessionId.trim()||!deviceId.trim())throw new Error('sessionId and deviceId are required');
    if(this.sessionId!==undefined&&(this.sessionId!==sessionId||this.deviceId!==deviceId))throw new Error('Controller resync identity does not match the active session');
    this.bindings.assertBound(sessionId,deviceId);
    this.sessionId=sessionId;
    this.deviceId=deviceId;
  }
}
