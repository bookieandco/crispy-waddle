import {describe,expect,it} from 'vitest';
import {GamingInputTransportBoundary,type GamingInputTransport,type GamingInputTransportMetrics} from './input-transport.js';
import type {InputIntegrityEvent} from './input-integrity.js';

const metrics=():GamingInputTransportMetrics=>({transport:'lan',sent:0,delivered:0,dropped:0,duplicated:0,reordered:0});
const event:InputIntegrityEvent={inputId:'i1',sequenceNumber:0,capturedAtMs:1,sessionId:'s1',deviceId:'d1',inputKind:'button'};

describe('GamingInputTransportBoundary',()=>{
  it('revokes new sends immediately when disconnect starts and never underflows queue depth',async()=>{
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
    const transport:GamingInputTransport={
      kind:'lan',
      connect:async()=>{},
      send:async()=>{await blocked;},
      disconnect:async()=>{},
      metrics,
    };
    const boundary=new GamingInputTransportBoundary(transport);
    await boundary.connect('s1','d1');
    const pending=boundary.send(event);
    expect(boundary.pendingInputCount).toBe(1);
    const disconnect=boundary.disconnect();
    expect(boundary.connectionState).toBe('disconnecting');
    await expect(boundary.send({...event,inputId:'i2',sequenceNumber:1})).rejects.toThrow('not accepting input');
    release();
    await pending;
    await disconnect;
    expect(boundary.pendingInputCount).toBe(0);
    expect(boundary.connectionState).toBe('disconnected');
  });

  it('makes disconnect idempotent',async()=>{
    let calls=0;
    const transport:GamingInputTransport={kind:'lan',connect:async()=>{},send:async()=>{},disconnect:async()=>{calls++;},metrics};
    const boundary=new GamingInputTransportBoundary(transport);
    await boundary.connect('s1','d1');
    await Promise.all([boundary.disconnect(),boundary.disconnect()]);
    expect(calls).toBe(1);
    expect(boundary.pendingInputCount).toBe(0);
  });

  it('does not resurrect a connection that completes after disconnect',async()=>{
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
    const transport:GamingInputTransport={kind:'lan',connect:async()=>{await blocked;},send:async()=>{},disconnect:async()=>{},metrics};
    const boundary=new GamingInputTransportBoundary(transport);
    const connecting=boundary.connect('s1','d1');
    await boundary.disconnect();
    release();
    await expect(connecting).rejects.toThrow('revoked');
    expect(boundary.connectionState).toBe('disconnected');
  });
});
