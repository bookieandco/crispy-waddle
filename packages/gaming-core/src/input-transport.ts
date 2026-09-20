import type {InputIntegrityEvent as GamingInputEvent} from './input-integrity.js';
import type {GamingRuntimeInputAck} from './input-pipeline.js';

export type GamingInputTransportKind='local'|'lan'|'remote';
export type GamingInputDeliveryMode='transport-only'|'runtime-delivery';
export type GamingInputTransportConnectionState='disconnected'|'connecting'|'connected'|'disconnecting';

export interface GamingInputTransportMetrics {
  transport:GamingInputTransportKind;sent:number;delivered:number;dropped:number;duplicated:number;reordered:number;
  lastSentAtMs?:number;lastDeliveredAtMs?:number;transportLatencyMs?:number;
}
export interface GamingInputTransport {
  readonly kind:GamingInputTransportKind;readonly deliveryMode?:GamingInputDeliveryMode;
  connect(sessionId:string,deviceId:string):Promise<void>;send(event:GamingInputEvent):Promise<void>;
  deliverToRuntime?(event:GamingInputEvent):Promise<GamingRuntimeInputAck>;disconnect():Promise<void>;metrics():GamingInputTransportMetrics;
}
export interface GamingInputTransportPolicy {allowRemote:boolean;maxTransportLatencyMs:number;maxQueueDepth:number;}
export interface GamingInputTransportReceipt {status:'confirmed'|'over-budget';sentAtMs:number;confirmedAtMs:number;latencyMs:number;}

export class GamingInputTransportBoundary {
  private state:GamingInputTransportConnectionState='disconnected';
  private queueDepth=0;
  private disconnectPromise?:Promise<void>;
  private connectionEpoch=0;
  constructor(private readonly transport:GamingInputTransport,private readonly policy:GamingInputTransportPolicy={allowRemote:true,maxTransportLatencyMs:25,maxQueueDepth:1}){
    if(!Number.isFinite(policy.maxTransportLatencyMs)||policy.maxTransportLatencyMs<0)throw new Error('maxTransportLatencyMs must be non-negative');
    if(!Number.isInteger(policy.maxQueueDepth)||policy.maxQueueDepth<0)throw new Error('maxQueueDepth must be a non-negative integer');
    if(transport.kind==='remote'&&!policy.allowRemote)throw new Error('Remote input transport is disabled by policy');
    if(transport.deliveryMode==='runtime-delivery'&&!transport.deliverToRuntime)throw new Error('Runtime-delivery transport must expose deliverToRuntime');
  }
  get deliveryMode():GamingInputDeliveryMode{return this.transport.deliveryMode??'transport-only';}
  get connectionState():GamingInputTransportConnectionState{return this.state;}
  get pendingInputCount():number{return this.queueDepth;}

  async connect(sessionId:string,deviceId:string):Promise<void>{
    if(this.state!=='disconnected')throw new Error(`Input transport cannot connect while ${this.state}`);
    const epoch=++this.connectionEpoch;
    this.state='connecting';
    try{
      await this.transport.connect(sessionId,deviceId);
      if(epoch!==this.connectionEpoch||this.state!=='connecting')throw new Error('Input transport connection was revoked before completion');
      this.state='connected';
    }catch(error){
      if(epoch===this.connectionEpoch)this.state='disconnected';
      throw error;
    }
  }

  async send(event:GamingInputEvent):Promise<GamingInputTransportReceipt>{
    if(this.state!=='connected')throw new Error(`Input transport is not accepting input while ${this.state}`);
    if(this.queueDepth>=this.policy.maxQueueDepth)throw new Error('Input transport queue is full; refusing to buffer control input');
    const started=Date.now();this.queueDepth++;
    try{
      await this.transport.send(event);
      const confirmedAtMs=Date.now();const latencyMs=confirmedAtMs-started;
      return{status:latencyMs>this.policy.maxTransportLatencyMs?'over-budget':'confirmed',sentAtMs:started,confirmedAtMs,latencyMs};
    }finally{this.queueDepth=Math.max(0,this.queueDepth-1);}
  }

  async deliverToRuntime(event:GamingInputEvent):Promise<GamingRuntimeInputAck>{
    if(this.state!=='connected')throw new Error(`Input transport cannot deliver to runtime while ${this.state}`);
    if(this.deliveryMode!=='runtime-delivery')throw new Error('Transport is not the runtime delivery endpoint');
    return this.transport.deliverToRuntime!(event);
  }

  disconnect():Promise<void>{
    if(this.state==='disconnected')return Promise.resolve();
    if(this.disconnectPromise)return this.disconnectPromise;
    this.connectionEpoch++;
    this.state='disconnecting';
    this.disconnectPromise=this.transport.disconnect().then(()=>{this.state='disconnected';},error=>{this.state='disconnected';throw error;}).finally(()=>{this.disconnectPromise=undefined;});
    return this.disconnectPromise;
  }
  metrics():GamingInputTransportMetrics{return this.transport.metrics();}
}
