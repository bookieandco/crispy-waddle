import type {GameLibraryEntry,GameLibraryRepository} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {
  UnifiedGamingSessionRegistry,
  type UnifiedGamingRuntimeKind,
  type UnifiedGamingSession,
} from './unified-gaming-session.js';

export interface ManagedRuntimeSession {
  runtimeSessionId:string;
  runtimeId:string;
  runtimeKind:UnifiedGamingRuntimeKind;
  stop():Promise<void>;
  pause?():Promise<void>;
  resume?():Promise<void>;
}

export interface ManagedGamingRuntimeDriver {
  readonly id:string;
  readonly runtimeKind:UnifiedGamingRuntimeKind;
  canStart(game:GameLibraryEntry):Promise<boolean>;
  start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>;
}

export interface GamingControllerLifecycle {
  bind(sessionId:string,deviceId:string):Promise<void>|void;
  disconnect(sessionId:string,deviceId:string):Promise<number|void>|number|void;
  reconnect?(sessionId:string,deviceId:string):Promise<number|void>|number|void;
  unbind(sessionId:string,deviceId:string):Promise<void>|void;
}

export interface StartGamingSessionRequest {
  gameId:string;
  preferredRuntimeId?:string;
  controllerDeviceId?:string;
  context?:LaunchContext;
  nowMs?:number;
}

export class UnifiedGamingSessionOrchestrator {
  private readonly handles=new Map<string,ManagedRuntimeSession>();
  private nextSession=1;

  constructor(
    private readonly library:GameLibraryRepository,
    private readonly drivers:readonly ManagedGamingRuntimeDriver[],
    private readonly registry:UnifiedGamingSessionRegistry,
    private readonly telemetry:GamingSessionMonitor,
    private readonly controller?:GamingControllerLifecycle,
  ){}

  async start(request:StartGamingSessionRequest):Promise<UnifiedGamingSession>{
    const game=await this.library.get(request.gameId);
    if(!game)throw new Error(`Game not found: ${request.gameId}`);
    const driver=await this.resolveDriver(game,request.preferredRuntimeId);
    const nowMs=request.nowMs??Date.now();
    const sessionId=`gaming:${game.id}:${this.nextSession++}`;
    this.registry.create({
      sessionId,
      gameId:game.id,
      runtimeId:driver.id,
      runtimeKind:driver.runtimeKind,
      controllerDeviceId:request.controllerDeviceId,
    },nowMs);

    let handle:ManagedRuntimeSession|undefined;
    try{
      if(request.controllerDeviceId&&this.controller){
        await this.controller.bind(sessionId,request.controllerDeviceId);
        this.registry.attachResource(sessionId,`controller:${request.controllerDeviceId}`,nowMs);
      }
      handle=await driver.start(game,request.context??{});
      // Take ownership immediately, even when the driver reports invalid identity.
      this.handles.set(sessionId,handle);
      this.registry.attachResource(sessionId,`runtime:${handle.runtimeSessionId}`,nowMs);
      if(handle.runtimeId!==driver.id||handle.runtimeKind!==driver.runtimeKind||!handle.runtimeSessionId.trim()){
        throw new Error('Runtime driver returned inconsistent identity');
      }
      this.telemetry.start(sessionId,`runtime:${driver.id}`,driver.id,nowMs);
      this.telemetry.heartbeat(sessionId,{status:'running'},nowMs);
      return this.registry.transition(sessionId,'running',nowMs);
    }catch(error){
      const cleanupErrors:unknown[]=[];
      if(handle){
        try{
          await handle.stop();
          this.handles.delete(sessionId);
          this.registry.releaseResource(sessionId,`runtime:${handle.runtimeSessionId}`);
        }catch(cleanupError){cleanupErrors.push(cleanupError);}
      }
      try{await this.cleanupController(sessionId,request.controllerDeviceId);}
      catch(cleanupError){cleanupErrors.push(cleanupError);}
      const current=this.registry.get(sessionId);
      if(current&&current.status!=='failed'&&current.status!=='stopped'){
        try{this.telemetry.fail(sessionId,Date.now());}catch{/* telemetry may not have started */}
        this.registry.transition(sessionId,'failed',Math.max(current.updatedAtMs,Date.now()),error instanceof Error?error.message:'runtime-start-failed');
      }
      if(cleanupErrors.length)throw Object.assign(new Error('Gaming start failed; runtime cleanup needs repair'),{causes:[error,...cleanupErrors]});
      throw error;
    }
  }

  markDegraded(sessionId:string,nowMs=Date.now()):UnifiedGamingSession{
    this.telemetry.heartbeat(sessionId,{status:'running'},nowMs);
    return this.registry.transition(sessionId,'degraded',nowMs);
  }

  async handleControllerDisconnect(sessionId:string,nowMs=Date.now()):Promise<UnifiedGamingSession>{
    const current=this.require(sessionId);
    if(!current.controllerDeviceId||!this.controller)throw new Error('Gaming session has no managed controller');
    const nextSequence=await this.controller.disconnect(sessionId,current.controllerDeviceId);
    if(typeof nextSequence==='number')this.telemetry.recordReconnect(sessionId,nextSequence,nowMs);
    return current.status==='reconnecting'?current:this.registry.transition(sessionId,'reconnecting',nowMs);
  }

  async reconnect(sessionId:string,nowMs=Date.now()):Promise<UnifiedGamingSession>{
    const current=this.require(sessionId);
    const reconnecting=current.status==='reconnecting'?current:this.registry.transition(sessionId,'reconnecting',nowMs);
    let nextSequence=0;
    if(reconnecting.controllerDeviceId&&this.controller?.reconnect){
      const result=await this.controller.reconnect(sessionId,reconnecting.controllerDeviceId);
      if(typeof result==='number')nextSequence=result;
    }
    this.telemetry.recordReconnect(sessionId,nextSequence,nowMs);
    return this.registry.transition(sessionId,'running',nowMs);
  }

  async stop(sessionId:string,nowMs=Date.now()):Promise<UnifiedGamingSession>{
    let current=this.require(sessionId);
    if(current.status==='stopped')return current;
    if(current.status!=='failed'&&current.status!=='stopping'){
      current=this.registry.transition(sessionId,'stopping',Math.max(nowMs,current.updatedAtMs));
    }
    const errors:unknown[]=[];
    const handle=this.handles.get(sessionId);
    if(handle){
      try{
        await handle.stop();
        this.handles.delete(sessionId);
        this.registry.releaseResource(sessionId,`runtime:${handle.runtimeSessionId}`,nowMs);
      }catch(error){errors.push(error);}
    }
    try{await this.cleanupController(sessionId,current.controllerDeviceId,nowMs);}
    catch(error){errors.push(error);}
    const routed=this.registry.get(sessionId);
    if(routed?.displayRouteId&&routed.resources.includes(`display:${routed.displayRouteId}`)){
      this.registry.releaseResource(sessionId,`display:${routed.displayRouteId}`,nowMs);
    }
    if(errors.length){
      try{this.telemetry.fail(sessionId,nowMs);}catch{/* telemetry may be absent */}
      const state=this.require(sessionId);
      return state.status==='failed'?state:this.registry.transition(sessionId,'failed',Math.max(nowMs,state.updatedAtMs),'session-cleanup-failed');
    }
    try{this.telemetry.stop(sessionId,nowMs);}catch{/* failed starts may have no telemetry */}
    const state=this.require(sessionId);
    return state.status==='failed'?state:this.registry.transition(sessionId,'stopped',Math.max(nowMs,state.updatedAtMs));
  }

  setDisplayRoute(sessionId:string,displayRouteId:string,nowMs=Date.now()):UnifiedGamingSession{
    const current=this.registry.get(sessionId);
    if(!current)throw new Error(`Unknown gaming session: ${sessionId}`);
    if(current.displayRouteId&&current.resources.includes(`display:${current.displayRouteId}`)){
      this.registry.releaseResource(sessionId,`display:${current.displayRouteId}`,nowMs);
    }
    this.registry.attachResource(sessionId,`display:${displayRouteId}`,nowMs);
    return this.registry.setDisplayRoute(sessionId,displayRouteId,nowMs);
  }

  get(sessionId:string):UnifiedGamingSession|undefined{return this.registry.get(sessionId);}
  active():readonly UnifiedGamingSession[]{return this.registry.active();}
  runtimeHandleCount():number{return this.handles.size;}

  private async resolveDriver(game:GameLibraryEntry,preferredRuntimeId?:string):Promise<ManagedGamingRuntimeDriver>{
    const ordered=preferredRuntimeId
      ?[...this.drivers.filter(driver=>driver.id===preferredRuntimeId),...this.drivers.filter(driver=>driver.id!==preferredRuntimeId)]
      :this.drivers;
    for(const driver of ordered)if(await driver.canStart(game))return driver;
    throw new Error(`No managed runtime for game: ${game.id}`);
  }

  private require(sessionId:string):UnifiedGamingSession{
    const session=this.registry.get(sessionId);
    if(!session)throw new Error(`Unknown gaming session: ${sessionId}`);
    return session;
  }

  private async cleanupController(sessionId:string,deviceId?:string,nowMs=Date.now()):Promise<void>{
    if(!deviceId||!this.controller)return;
    const errors:unknown[]=[];
    try{await this.controller.disconnect(sessionId,deviceId);}catch(error){errors.push(error);}
    let unbound=false;
    try{await this.controller.unbind(sessionId,deviceId);unbound=true;}catch(error){errors.push(error);}
    const current=this.registry.get(sessionId);
    if(unbound&&current?.resources.includes(`controller:${deviceId}`)){
      this.registry.releaseResource(sessionId,`controller:${deviceId}`,nowMs);
    }
    if(errors.length)throw Object.assign(new Error('Controller cleanup requires repair'),{causes:errors});
  }
}
