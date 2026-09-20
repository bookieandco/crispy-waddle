import {describe,expect,it} from 'vitest';
import {InputIntegrityMonitor,type InputIntegrityEvent} from './input-integrity.js';
import {ControllerInputResyncManager} from './input-resync.js';
import type {ControllerSessionBindingManager} from './controller-session-binding.js';

const bindings={assertBound:(sessionId:string,deviceId:string)=>({sessionId,deviceId,state:'bound',boundAtMs:0,capabilities:['buttons']})} as unknown as ControllerSessionBindingManager;
const input=(sequenceNumber:number,inputId=`i${sequenceNumber}`):InputIntegrityEvent=>({inputId,sequenceNumber,capturedAtMs:1000,sessionId:'s1',deviceId:'d1',inputKind:'button'});

describe('ControllerInputResyncManager',()=>{
  it('preserves the next permanently consumed sequence across disconnect',()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    expect(integrity.accept(input(4),1000).accepted).toBe(true);
    const resync=new ControllerInputResyncManager(bindings,integrity);
    expect(resync.disconnect('s1','d1').nextSequenceNumber).toBe(5);
    expect(()=>resync.beginReconnect('s1','d1',4)).toThrow('replay consumed input');
    expect(resync.beginReconnect('s1','d1').nextSequenceNumber).toBe(5);
    expect(resync.completeResync('s1','d1').nextSequenceNumber).toBe(5);
    expect(integrity.accept(input(4,'replay'),1000).accepted).toBe(false);
    expect(integrity.accept(input(5),1000).accepted).toBe(true);
  });

  it('never moves the reconnect floor backwards across repeated disconnects',()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    const resync=new ControllerInputResyncManager(bindings,integrity);
    expect(integrity.accept(input(2),1000).accepted).toBe(true);
    resync.disconnect('s1','d1');
    resync.beginReconnect('s1','d1',3);
    resync.completeResync('s1','d1',3);
    expect(integrity.accept(input(7),1000).accepted).toBe(true);
    expect(resync.disconnect('s1','d1').nextSequenceNumber).toBe(8);
    expect(()=>resync.beginReconnect('s1','d1',3)).toThrow('replay consumed input');
  });
});
