import {describe,expect,it,vi} from 'vitest';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {Ps5ExperimentalReferenceCatalog} from './ps5-experimental-catalog.js';
import {InMemoryPs5ExperimentalReceiptSink,Ps5ExperimentalAuditLedger} from './ps5-experimental-ledger.js';
import {Ps5ExperimentalControlPlane} from './ps5-experimental-control-plane.js';
import {KytyExperimentalRuntimeDriver,Ps5MqttObservationAdapter,Ps5PayloadMetadataAdapter} from './ps5-experimental-adapters.js';

describe('G15-X.5 PlayStation experimental acceptance',()=>{
  it('observes, catalogs and emulates under policy while denying exploit/payload execution',async()=>{
    const catalog=new Ps5ExperimentalReferenceCatalog();
    const sink=new InMemoryPs5ExperimentalReceiptSink();
    const control=new Ps5ExperimentalControlPlane(catalog,new Ps5ExperimentalAuditLedger(sink));
    const approved={experimentalModeEnabled:true,explicitUserApproval:true};

    const denied=control.authorize({
      referenceId:'ps5-linux-loader',
      action:'exploit-run',
      ...approved,
      nowMs:100,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.receipt.reason).toBe('restricted-action');

    const observedDecision=control.authorize({
      referenceId:'ps5-mqtt',
      action:'state-observe',
      ...approved,
      nowMs:101,
    });
    expect(observedDecision.allowed).toBe(true);
    const observation=new Ps5MqttObservationAdapter(
      {discover:async()=>[{consoleId:'ps5-living-room',name:'Living Room PS5',state:'standby'}]},
      catalog.get('ps5-mqtt')!,
    );
    expect(await observation.discover(approved)).toEqual([{consoleId:'ps5-living-room',name:'Living Room PS5',state:'standby'}]);

    const metadataDecision=control.authorize({
      referenceId:'ps5-payloads-mirror',
      action:'homebrew-metadata',
      ...approved,
      nowMs:102,
    });
    expect(metadataDecision.allowed).toBe(true);
    const metadata=new Ps5PayloadMetadataAdapter(catalog.get('ps5-payloads-mirror')!).sanitize([
      {name:'Example Homebrew',version:'1.0',description:'Reference metadata',sourceRepository:'owner/example'},
    ],approved);
    expect(metadata).toEqual([{name:'Example Homebrew',version:'1.0',description:'Reference metadata',sourceRepository:'owner/example'}]);

    const emulatorDecision=control.authorize({
      referenceId:'kyty',
      action:'emulator-launch',
      ...approved,
      nowMs:103,
    });
    expect(emulatorDecision.allowed).toBe(true);

    const stop=vi.fn(async()=>{});
    const kyty=new KytyExperimentalRuntimeDriver(
      {launch:async()=>({processId:'kyty-42',stop})},
      catalog.get('kyty')!,
      ()=>approved,
    );
    const library=new InMemoryGameLibrary();
    await library.save({id:'ps5-lab-game',title:'PS5 Lab Game',platform:'ps5',contentUri:'experimental://kyty/test'});
    const sessions=new UnifiedGamingSessionOrchestrator(
      library,
      [kyty],
      new UnifiedGamingSessionRegistry(),
      new GamingSessionMonitor(),
    );

    const session=await sessions.start({gameId:'ps5-lab-game',preferredRuntimeId:'kyty-ps5-experimental',nowMs:104});
    expect(session).toMatchObject({status:'running',runtimeId:'kyty-ps5-experimental',runtimeKind:'emulator'});
    expect(session.resources).toContain('runtime:kyty:kyty-42');

    const stopped=await sessions.stop(session.sessionId,105);
    expect(stopped.status).toBe('stopped');
    expect(stopped.resources).toEqual([]);
    expect(sessions.active()).toEqual([]);
    expect(sessions.runtimeHandleCount()).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);

    const receipts=sink.list();
    expect(receipts.map(receipt=>[receipt.referenceId,receipt.action,receipt.allowed])).toEqual([
      ['ps5-linux-loader','exploit-run',false],
      ['ps5-mqtt','state-observe',true],
      ['ps5-payloads-mirror','homebrew-metadata',true],
      ['kyty','emulator-launch',true],
    ]);
    expect(JSON.stringify(receipts)).not.toContain('.elf');
    expect(JSON.stringify(receipts)).not.toContain('token');
  });
});
