import type {GameLibraryEntry,GameLibraryRepository} from './game-library.js';
import type {RemotePlayClass,RemoteQualitySample} from './remote-quality.js';
import type {GamingDisplayRoute} from './display-routing.js';
import {AdaptiveGamingLatencyGovernor,type GamingLatencyDecision} from './adaptive-latency-governor.js';
import {UnifiedGamingSessionOrchestrator,type StartGamingSessionRequest} from './gaming-session-orchestrator.js';
import type {UnifiedGamingSession} from './unified-gaming-session.js';
import type {LaunchAuthorizationResult} from './launch-authorization.js';

/** A host-owned authorization authority; a UI-supplied boolean is not a grant. */
export interface GamingPlayAuthorizer {
  authorize(request:GamingPlayRequest):Promise<LaunchAuthorizationResult>|LaunchAuthorizationResult;
}

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
    private readonly authorizer:GamingPlayAuthorizer,
    private readonly governor=new AdaptiveGamingLatencyGovernor(),
  ){}

  libraryView():Promise<readonly GameLibraryEntry[]>{return this.library.list();}

  async play(request:GamingPlayRequest):Promise<GamingSessionView>{
    // Deny before resolving a runtime or allocating any session resources.
    const grant=await this.authorizer.authorize(request);
    if(!grant||grant.allowed!==true||grant.reason!=='authorized'){
      throw new Error(`Gaming launch authorization denied: ${grant?.reason??'missing-grant'}`);
    }
    const connection=this.governor.evaluate(request.playClass,request.quality,request.displayRoutes);
    if(connection.action==='block'||!connection.display.route){
      throw new Error(`Gaming launch blocked by latency policy: ${connection.reasons.join('; ')||'no display route'}`);
    }
    const session=await this.sessions.start(request);
    try{
      const routed=this.sessions.setDisplayRoute(session.sessionId,connection.display.route.id,request.nowMs??Date.now());
      this.connectionBySession.set(session.sessionId,connection);
      return this.view(routed,connection);
    }catch(error){
      this.connectionBySession.delete(session.sessionId);
      // A display/response failure must not leave an invisible running session.
      const stopped=await this.sessions.stop(session.sessionId);
      if(stopped.status!=='stopped'){
        throw new AggregateError([error,new Error('Gaming session rollback incomplete')],'Gaming launch failed and cleanup requires repair');
      }
      throw error;
    }
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
