import type {GameLibraryEntry,GameLibraryRepository} from './game-library.js';
import type {RemotePlayClass,RemoteQualitySample} from './remote-quality.js';
import type {GamingDisplayRoute} from './display-routing.js';
import {AdaptiveGamingLatencyGovernor,type GamingLatencyDecision} from './adaptive-latency-governor.js';
import {UnifiedGamingSessionOrchestrator,type StartGamingSessionRequest} from './gaming-session-orchestrator.js';
import type {UnifiedGamingSession} from './unified-gaming-session.js';

export interface GamingPlayRequest extends StartGamingSessionRequest {
  playClass:RemotePlayClass;
  quality:RemoteQualitySample;
  displayRoutes:readonly GamingDisplayRoute[];
}

export interface GamingSessionView {
  session:UnifiedGamingSession;
  connection:GamingLatencyDecision;
  controller:{
    deviceId?:string;
    state:'bound'|'not-bound';
  };
}

export class GamingApiService {
  private readonly connectionBySession=new Map<string,GamingLatencyDecision>();

  constructor(
    private readonly library:GameLibraryRepository,
    private readonly sessions:UnifiedGamingSessionOrchestrator,
    private readonly governor=new AdaptiveGamingLatencyGovernor(),
  ){}

  libraryView():Promise<readonly GameLibraryEntry[]>{return this.library.list();}

  async play(request:GamingPlayRequest):Promise<GamingSessionView>{
    const connection=this.governor.evaluate(request.playClass,request.quality,request.displayRoutes);
    if(connection.action==='block'||!connection.display.route){
      throw new Error(`Gaming launch blocked by latency policy: ${connection.reasons.join('; ')||'no display route'}`);
    }
    const session=await this.sessions.start(request);
    const routed=this.sessions.setDisplayRoute(session.sessionId,connection.display.route.id,request.nowMs??Date.now());
    this.connectionBySession.set(session.sessionId,connection);
    return this.view(routed,connection);
  }

  session(sessionId:string):GamingSessionView|undefined{
    const session=this.sessions.get(sessionId);
    const connection=this.connectionBySession.get(sessionId);
    return session&&connection?this.view(session,connection):undefined;
  }

  async stop(sessionId:string,nowMs=Date.now()):Promise<UnifiedGamingSession>{
    const stopped=await this.sessions.stop(sessionId,nowMs);
    this.connectionBySession.delete(sessionId);
    return stopped;
  }

  active():readonly GamingSessionView[]{
    return this.sessions.active().flatMap(session=>{
      const connection=this.connectionBySession.get(session.sessionId);
      return connection?[this.view(session,connection)]:[];
    });
  }

  private view(session:UnifiedGamingSession,connection:GamingLatencyDecision):GamingSessionView{
    return{
      session,
      connection,
      controller:{
        deviceId:session.controllerDeviceId,
        state:session.controllerDeviceId?'bound':'not-bound',
      },
    };
  }
}
