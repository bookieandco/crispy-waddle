import {describe,expect,it,vi} from 'vitest';
import {ControllerCore,InMemoryControllerRepository,type ControllerAdapter,type CanonicalGameInput} from './controller.js';
import {ControllerSessionBindingManager} from './controller-session-binding.js';
import {ControllerInputGate} from './controller-input-gate.js';
import {ControllerInputResyncManager} from './input-resync.js';
import {InputIntegrityMonitor} from './input-integrity.js';
import {GamingInputPipeline} from './input-pipeline.js';
import {GamingInputTransportBoundary,type GamingInputTransport,type GamingInputTransportMetrics} from './input-transport.js';
import {CertifiedGamingInputSessionController,connectedControllerDevice} from './gaming-input-session-controller.js';
import {InMemoryGameLibrary} from './game-library.js';
import {NativePcManagedRuntimeDriver} from './native-pc-session-driver.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {GamingApiService} from './gaming-api.js';
import {GamingSaveCoordinator,InMemoryGamingSaveStore} from './gaming-save-sync.js';

describe('G14j end-to-end gaming acceptance',()=>{
  it('discovers, launches, controls, reconnects, saves and stops without orphaned resources',async()=>{
    const canonical:CanonicalGameInput={
      buttons:new Set(['a']),
      leftStick:{x:0,y:0},
      rightStick:{x:0,y:0},
      timestamp:new Date().toISOString(),
    };
    const repository=new InMemoryControllerRepository();
    const adapter:ControllerAdapter={
      id:'usb-test',
      name:'USB Test Adapter',
      supports:()=>true,
      discover:async()=>[{id:'pad1',name:'Gamepad',connection:'usb'}],
      readInput:async()=>canonical,
    };
    const controllerCore=new ControllerCore(repository,[adapter]);
    expect((await controllerCore.discover()).map(device=>device.id)).toEqual(['pad1']);

    const bindings=new ControllerSessionBindingManager();
    const integrity=new InputIntegrityMonitor();
    const gate=new ControllerInputGate(bindings);
    const resync=new ControllerInputResyncManager(bindings,integrity);
    let sends=0;
    let connects=0;
    let disconnects=0;
    const metrics=():GamingInputTransportMetrics=>({
      transport:'local',
      sent:sends,
      delivered:sends,
      dropped:0,
      duplicated:0,
      reordered:0,
    });
    const rawTransport:GamingInputTransport={
      kind:'local',
      connect:async()=>{connects++;},
      send:async()=>{sends++;},
      disconnect:async()=>{disconnects++;},
      metrics,
    };
    const transport=new GamingInputTransportBoundary(rawTransport);
    const pipeline=new GamingInputPipeline(
      integrity,
      transport,
      {deliver:async event=>({inputId:event.inputId,sequenceNumber:event.sequenceNumber,deliveredAtMs:Date.now()})},
      gate,
      resync,
    );
    const controller=new CertifiedGamingInputSessionController(
      {
        get:async deviceId=>{
          const discovered=await repository.get(deviceId);
          return discovered?connectedControllerDevice(discovered.id):undefined;
        },
      },
      bindings,
      integrity,
      resync,
      gate,
      transport,
      pipeline,
    );

    const library=new InMemoryGameLibrary();
    await library.save({id:'portal',title:'Portal',platform:'pc',contentUri:'steam://run/400',installed:true,tags:['steam']});
    const processStop=vi.fn(async()=>{});
    const native=new NativePcManagedRuntimeDriver({launch:async()=>({processId:'4242',stop:processStop})});
    const registry=new UnifiedGamingSessionRegistry();
    const telemetry=new GamingSessionMonitor();
    const sessions=new UnifiedGamingSessionOrchestrator(library,[native],registry,telemetry,controller);
    const api=new GamingApiService(library,sessions);

    const view=await api.play({
      gameId:'portal',
      controllerDeviceId:'pad1',
      playClass:'action',
      quality:{rttMs:12,jitterMs:1,packetLossPercent:0,inputLatencyMs:6},
      displayRoutes:[
        {id:'phone',kind:'phone-cast',available:true,latencyMs:7,direct:false,supportsLowLatency:true},
        {id:'living-room-tv',kind:'homebase-tv',available:true,latencyMs:10,direct:true,supportsLowLatency:true},
      ],
    });
    expect(view.session).toMatchObject({status:'running',runtimeId:'native-pc',controllerDeviceId:'pad1',displayRouteId:'living-room-tv'});

    const firstAt=Date.now();
    const first=await pipeline.submit({
      inputId:'input-0',
      sequenceNumber:0,
      capturedAtMs:firstAt,
      sessionId:view.session.sessionId,
      deviceId:'pad1',
      inputKind:'button',
    },firstAt);
    expect(first).toMatchObject({accepted:true,transported:true});
    expect(first.delivery.state).toBe('acknowledged');

    const reconnecting=await sessions.handleControllerDisconnect(view.session.sessionId);
    expect(reconnecting.status).toBe('reconnecting');
    expect(transport.connectionState).toBe('disconnected');

    const reconnected=await sessions.reconnect(view.session.sessionId);
    expect(reconnected.status).toBe('running');
    expect(telemetry.get(view.session.sessionId)?.reconnectNextSequenceNumber).toBe(1);

    const secondAt=Date.now();
    const second=await pipeline.submit({
      inputId:'input-1',
      sequenceNumber:1,
      capturedAtMs:secondAt,
      sessionId:view.session.sessionId,
      deviceId:'pad1',
      inputKind:'button',
    },secondAt);
    expect(second).toMatchObject({accepted:true,transported:true});
    expect(sends).toBe(2);

    const saves=new GamingSaveCoordinator(new InMemoryGamingSaveStore());
    const saved=await saves.write({
      saveId:'portal:u1:0',
      gameId:'portal',
      ownerId:'u1',
      runtimeId:'native-pc',
      kind:'persistent',
      uri:'save://portal/u1',
      expectedRevision:0,
      sourceSessionId:view.session.sessionId,
    });
    expect(saved.revision).toBe(1);

    const stopped=await api.stop(view.session.sessionId);
    expect(stopped.status).toBe('stopped');
    expect(stopped.resources).toEqual([]);
    expect(sessions.active()).toEqual([]);
    expect(sessions.runtimeHandleCount()).toBe(0);
    expect(transport.connectionState).toBe('disconnected');
    expect(bindings.get()?.state).toBe('unbound');
    expect(processStop).toHaveBeenCalledTimes(1);
    expect(connects).toBe(2);
    expect(disconnects).toBe(2);
  });
});
