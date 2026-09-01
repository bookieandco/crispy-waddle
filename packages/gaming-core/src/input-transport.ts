import type {GamingInputEvent} from './input-integrity.js';

export type GamingInputTransportKind='local'|'lan'|'remote';

export interface GamingInputTransportMetrics {
  transport:GamingInputTransportKind;
  sent:number;
  delivered:number;
  dropped:number;
  duplicated:number;
  reordered:number;
  lastSentAtMs?:number;
  lastDeliveredAtMs?:number;
  transportLatencyMs?:number;
}

export interface GamingInputTransport {
  readonly kind:GamingInputTransportKind;
  connect(sessionId:string,deviceId:string):Promise<void>;
  send(event:GamingInputEvent):Promise<void>;
  disconnect():Promise<void>;
  metrics():GamingInputTransportMetrics;
}

export interface GamingInputTransportPolicy {
  allowRemote:boolean;
  maxTransportLatencyMs:number;
  maxQueueDepth:number;
}

export class GamingInputTransportBoundary {
  private connected=false;
  private queueDepth=0;

  constructor(private readonly transport:GamingInputTransport,private readonly policy:GamingInputTransportPolicy={allowRemote:true,maxTransportLatencyMs:25,maxQueueDepth:1}){
    if(!Number.isFinite(policy.maxTransportLatencyMs)||policy.maxTransportLatencyMs<0)throw new Error('maxTransportLatencyMs must be non-negative');
    if(!Number.isInteger(policy.maxQueueDepth)||policy.maxQueueDepth<0)throw new Error('maxQueueDepth must be a non-negative integer');
    if(transport.kind==='remote'&&!policy.allowRemote)throw new Error('Remote input transport is disabled by policy');
  }

  async connect(sessionId:string,deviceId:string):Promise<void>{
    if(this.connected)throw new Error('Input transport is already connected');
    await this.transport.connect(sessionId,deviceId);
    this.connected=true;
  }

  async send(event:GamingInputEvent):Promise<void>{
    if(!this.connected)throw new Error('Input transport is not connected');
    if(this.queueDepth>=this.policy.maxQueueDepth)throw new Error('Input transport queue is full; refusing to buffer control input');
    const started=Date.now();
    this.queueDepth++;
    try{
      await this.transport.send(event);
      const elapsed=Date.now()-started;
      if(elapsed>this.policy.maxTransportLatencyMs)throw new Error(`Input transport latency budget exceeded: ${elapsed}ms`);
    }finally{
      this.queueDepth--;
    }
  }

  async disconnect():Promise<void>{
    if(!this.connected)return;
    await this.transport.disconnect();
    this.connected=false;
    this.queueDepth=0;
  }

  metrics():GamingInputTransportMetrics{return this.transport.metrics();}
}
