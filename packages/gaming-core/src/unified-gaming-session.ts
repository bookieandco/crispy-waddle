export type UnifiedGamingSessionStatus=
  |'starting'
  |'running'
  |'degraded'
  |'reconnecting'
  |'stopping'
  |'stopped'
  |'failed';

export type UnifiedGamingRuntimeKind='emulator'|'native'|'remote'|'console'|'cloud';

export interface UnifiedGamingSession {
  sessionId:string;
  gameId:string;
  runtimeId:string;
  runtimeKind:UnifiedGamingRuntimeKind;
  status:UnifiedGamingSessionStatus;
  startedAtMs:number;
  updatedAtMs:number;
  controllerDeviceId?:string;
  displayRouteId?:string;
  runtimeSessionId?:string;
  resources:readonly string[];
  failureReason?:string;
}

const ALLOWED:Readonly<Record<UnifiedGamingSessionStatus,readonly UnifiedGamingSessionStatus[]>>={
  starting:['running','failed','stopping'],
  running:['degraded','reconnecting','stopping','failed'],
  degraded:['running','reconnecting','stopping','failed'],
  reconnecting:['running','degraded','stopping','failed'],
  stopping:['stopped','failed'],
  stopped:[],
  failed:[],
};

export class UnifiedGamingSessionRegistry {
  private readonly sessions=new Map<string,UnifiedGamingSession>();

  create(
    input:Omit<UnifiedGamingSession,'status'|'startedAtMs'|'updatedAtMs'|'resources'> & {resources?:readonly string[]},
    nowMs=Date.now(),
  ):UnifiedGamingSession{
    this.validateId(input.sessionId,'sessionId');
    this.validateId(input.gameId,'gameId');
    this.validateId(input.runtimeId,'runtimeId');
    if(!Number.isFinite(nowMs))throw new Error('nowMs must be finite');
    if(this.sessions.has(input.sessionId))throw new Error(`Gaming session already exists: ${input.sessionId}`);
    const session:UnifiedGamingSession={
      ...input,
      status:'starting',
      startedAtMs:nowMs,
      updatedAtMs:nowMs,
      resources:Object.freeze([...(input.resources??[])]),
    };
    this.sessions.set(session.sessionId,session);
    return this.copy(session);
  }

  transition(sessionId:string,status:UnifiedGamingSessionStatus,nowMs=Date.now(),failureReason?:string):UnifiedGamingSession{
    const current=this.require(sessionId);
    if(!Number.isFinite(nowMs)||nowMs<current.updatedAtMs)throw new Error('Gaming session time must be monotonic');
    if(current.status===status)return this.copy(current);
    if(!ALLOWED[current.status].includes(status))throw new Error(`Invalid gaming session transition: ${current.status} -> ${status}`);
    const next:UnifiedGamingSession={
      ...current,
      status,
      updatedAtMs:nowMs,
      ...(status==='failed'?{failureReason:failureReason??'unknown-failure'}:{}),
    };
    this.sessions.set(sessionId,next);
    return this.copy(next);
  }

  attachResource(sessionId:string,resourceId:string,nowMs=Date.now()):UnifiedGamingSession{
    this.validateId(resourceId,'resourceId');
    const current=this.require(sessionId);
    if(current.status==='stopped'||current.status==='failed')throw new Error('Cannot attach resource to terminal gaming session');
    const resources=current.resources.includes(resourceId)?current.resources:[...current.resources,resourceId];
    const next={...current,resources:Object.freeze(resources),updatedAtMs:Math.max(current.updatedAtMs,nowMs)};
    this.sessions.set(sessionId,next);
    return this.copy(next);
  }

  releaseResource(sessionId:string,resourceId:string,nowMs=Date.now()):UnifiedGamingSession{
    const current=this.require(sessionId);
    const next={...current,resources:Object.freeze(current.resources.filter(id=>id!==resourceId)),updatedAtMs:Math.max(current.updatedAtMs,nowMs)};
    this.sessions.set(sessionId,next);
    return this.copy(next);
  }

  setDisplayRoute(sessionId:string,displayRouteId:string,nowMs=Date.now()):UnifiedGamingSession{
    this.validateId(displayRouteId,'displayRouteId');
    const current=this.require(sessionId);
    if(current.status==='stopped'||current.status==='failed')throw new Error('Cannot route display for terminal gaming session');
    const next={...current,displayRouteId,updatedAtMs:Math.max(current.updatedAtMs,nowMs)};
    this.sessions.set(sessionId,next);
    return this.copy(next);
  }

  get(sessionId:string):UnifiedGamingSession|undefined{
    const session=this.sessions.get(sessionId);
    return session?this.copy(session):undefined;
  }

  active():readonly UnifiedGamingSession[]{
    return [...this.sessions.values()]
      .filter(session=>session.status!=='stopped'&&session.status!=='failed')
      .map(session=>this.copy(session));
  }

  private require(sessionId:string):UnifiedGamingSession{
    const session=this.sessions.get(sessionId);
    if(!session)throw new Error(`Unknown gaming session: ${sessionId}`);
    return session;
  }

  private copy(session:UnifiedGamingSession):UnifiedGamingSession{
    return{...session,resources:[...session.resources]};
  }

  private validateId(value:string,label:string):void{
    if(!value.trim())throw new Error(`${label} is required`);
  }
}
