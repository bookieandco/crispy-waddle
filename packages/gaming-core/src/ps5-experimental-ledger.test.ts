import {describe,expect,it} from 'vitest';
import {Ps5ExperimentalReferenceCatalog} from './ps5-experimental-catalog.js';
import {InMemoryPs5ExperimentalReceiptSink,Ps5ExperimentalAuditLedger} from './ps5-experimental-ledger.js';
import {Ps5ExperimentalControlPlane} from './ps5-experimental-control-plane.js';

describe('PS5 experimental audit ledger',()=>{
  it('records provenance and authorization without storing credentials or payload bytes',()=>{
    const sink=new InMemoryPs5ExperimentalReceiptSink();
    const control=new Ps5ExperimentalControlPlane(new Ps5ExperimentalReferenceCatalog(),new Ps5ExperimentalAuditLedger(sink));
    const denied=control.authorize({referenceId:'ps5-linux-loader',action:'exploit-run',experimentalModeEnabled:true,explicitUserApproval:true,nowMs:100});
    const allowed=control.authorize({referenceId:'ps5-mqtt',action:'state-observe',experimentalModeEnabled:true,explicitUserApproval:true,nowMs:101});
    expect(denied.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
    expect(sink.list()).toEqual([
      {receiptId:'ps5x:1',referenceId:'ps5-linux-loader',repository:'ps5-linux/ps5-linux-loader',action:'exploit-run',allowed:false,reason:'restricted-action',explicitUserApproval:true,observedAtMs:100},
      {receiptId:'ps5x:2',referenceId:'ps5-mqtt',repository:'FunkeyFlo/ps5-mqtt',action:'state-observe',allowed:true,reason:'authorized',explicitUserApproval:true,observedAtMs:101},
    ]);
    expect(JSON.stringify(sink.list())).not.toContain('token');
    expect(JSON.stringify(sink.list())).not.toContain('payloadBytes');
  });
});
