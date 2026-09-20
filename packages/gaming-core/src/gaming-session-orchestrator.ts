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
  disconnect(sessionId:string,deviceId:string):Promise<void>|void;
  reconnect?(sessionId:string,deviceId:string):Promise<void>|void;
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

    try{
      if(request.controllerDeviceId&&this.controller){
        await this.controller.bind(sessionId,request.controllerDeviceId);
        this.registry.attachResource(sessionId,`controller:${request.controllerDeviceId}`,nowMs);
      }
      const handle=await driver.start(game,request.context??{});
      if(handle.runtimeId!==driver.id||handle.runtimeKind!==driver.runtimeKind)throw new Error('Runtime driver returned inconsistent identity');
      this.handles.set(sessionId,handle);
      this.registry.attachResource(sessionId,`runtime:${handle.runtimeSessionId}`,nowMs);
      this.telemetry.start(sessionId,`runtime:${driver.id}`,driver.id,nowMs);
      this.telemetry.heartbeat(sessionId,{status:'running'},nowMs);
      return this.registry.transition(sessionId,'running',nowMs);
    }catch(error){
      await this.cleanupController(sessionId,request.controllerDeviceId);
      const current=this.registry.get(sessionId);
      if(current&&current.status!=='failed'&&current.status!=='stopped'){
        this.registry.transition(sessionId,'failed',Math.max(current.updatedAtMs,Date.now()),error instanceof Error?error.message:'runtime-start-failed');
      }
      throw error;
    }
  }

  markDegraded(sessionId:string,nowMs=Date.now()):UnifiedGamingSession{
    this.telemetry.heartbeat(sessionId,{status:'running'},nowMs);
    return this.registry.transition(sessionId,'degraded',nowMs);
  }

  async reconnect(sessionId:string,nowMs=Date.now()):Promise<UnifiedGamingSession>{
    const current=this.require(sessionId);
    const reconnecting=current.status==='reconnecting'?current:this.registry.transition(sessionId,'reconnecting',nowMs);
    if(reconnecting.controllerDeviceId&&this.controller?.reconnect){
      await this.controller.reconnect(sessionId,reconnecting.controllerDeviceId);
    }
    this.telemetry.recordReconnect(sessionId,0,nowMs);
    return this.registry.transition(sessionId,'running',nowMs);
  }

  async stop(sessionId:string,nowMs=Date.now()):Promise<UnifiedGamingSession>{
    let current=this.require(sessionId);
    if(current.status==='stopped'||current.status==='failed')return current;
    if(current.status!=='stopping')current=this.registry.transition(sessionId,'stopping',nowMs);
    const handle=this.handles.get(sessionId);
    try{
      if(handle)await handle.stop();
      if(handle){
        this.registry.releaseResource(sessionId,`runtime:${handle.runtimeSessionId}`,nowMs);
        this.handles.delete(sessionId);
      }
      await this.cleanupController(sessionId,current.controllerDeviceId,nowMs);
      this.telemetry.stop(sessionId,nowMs);
      return this.registry.transition(sessionId,'stopped',nowMs);
    }catch(error){
      this.telemetry.fail(sessionId,nowMs);
      return this.registry.transition(sessionId,'failed',nowMs,error instanceof Error?error.message:'session-stop-failed');
    }
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
    await this.controller.disconnect(sessionId,deviceId);
    await this.controller.unbind(sessionId,deviceId);
    const current=this.registry.get(sessionId);
    if(current?.resources.includes(`controller:${deviceId}`)){
      this.registry.releaseResource(sessionId,`controller:${deviceId}`,nowMs);
    }
  }
}
