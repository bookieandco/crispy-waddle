export type GamingSessionStatus='starting'|'running'|'stopped'|'failed';

export interface GamingSessionTelemetry {
  sessionId:string;
  proposalId:string;
  runtimeId:string;
  status:GamingSessionStatus;
  observedAtMs:number;
  inputCaptureLatencyMs?:number;
  inputTransportLatencyMs?:number;
  inputToRuntimeLatencyMs?:number;
  inputToPhotonLatencyMs?:number;
  roundTripLatencyMs?:number;
  jitterMs?:number;
  packetLossPct?:number;
  framePacingMs?:number;
  encodeLatencyMs?:number;
  decodeLatencyMs?:number;
  reconnectCount?:number;
}

export interface GamingSessionState extends GamingSessionTelemetry {
  startedAtMs:number;
  lastHeartbeatAtMs:number;
}

export interface GamingSessionTelemetrySink {
  record(sample:GamingSessionTelemetry):Promise<void>|void;
}

export class GamingSessionMonitor {
  private readonly sessions=new Map<string,GamingSessionState>();

  constructor(private readonly sink?:GamingSessionTelemetrySink){ }

  start(sessionId:string,proposalId:string,runtimeId:string,nowMs=Date.now()):GamingSessionState{
    this.requireId(sessionId,'Session id');
    this.requireId(proposalId,'Proposal id');
    this.requireId(runtimeId,'Runtime id');
    const state:GamingSessionState={sessionId,proposalId,runtimeId,status:'starting',observedAtMs:nowMs,startedAtMs:nowMs,lastHeartbeatAtMs:nowMs,reconnectCount:0};
    this.sessions.set(sessionId,state);
    void this.sink?.record(state);
    return {...state};
  }

  heartbeat(sessionId:string,sample:Omit<GamingSessionTelemetry,'sessionId'|'proposalId'|'runtimeId'|'status'|'observedAtMs'> & {status?:GamingSessionStatus},nowMs=Date.now()):GamingSessionState{
    const current=this.requireSession(sessionId);
    if(current.status==='stopped'||current.status==='failed')throw new Error(`Session is terminal: ${sessionId}`);
    const next:GamingSessionState={...current,...sample,sessionId,proposalId:current.proposalId,runtimeId:current.runtimeId,status:sample.status??'running',observedAtMs:nowMs,lastHeartbeatAtMs:nowMs};
    this.sessions.set(sessionId,next);
    void this.sink?.record(next);
    return {...next};
  }

  stop(sessionId:string,nowMs=Date.now()):GamingSessionState{return this.transition(sessionId,'stopped',nowMs);}
  fail(sessionId:string,nowMs=Date.now()):GamingSessionState{return this.transition(sessionId,'failed',nowMs);}

  get(sessionId:string):GamingSessionState|undefined{const state=this.sessions.get(sessionId);return state?{...state}:undefined;}

  private transition(sessionId:string,status:'stopped'|'failed',nowMs:number):GamingSessionState{
    const current=this.requireSession(sessionId);
    if(current.status==='stopped'||current.status==='failed')return {...current};
    const next={...current,status,observedAtMs:nowMs,lastHeartbeatAtMs:nowMs};
    this.sessions.set(sessionId,next);
    void this.sink?.record(next);
    return {...next};
  }

  private requireSession(sessionId:string):GamingSessionState{const state=this.sessions.get(sessionId);if(!state)throw new Error(`Unknown gaming session: ${sessionId}`);return state;}
  private requireId(value:string,label:string):void{if(!value.trim())throw new Error(`${label} is required`);}
}
