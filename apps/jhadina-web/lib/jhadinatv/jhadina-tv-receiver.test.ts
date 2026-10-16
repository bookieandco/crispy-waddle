import {afterEach,describe,expect,it,vi} from 'vitest';
import {createJhadinaTVReceiverTransport} from './jhadina-tv-receiver';

class FakeSocket {
  static OPEN=1;
  static instances:FakeSocket[]=[];
  readyState=FakeSocket.OPEN;
  sent:Array<Record<string,unknown>>=[];
  onopen:((event:unknown)=>void)|null=null;
  onerror:((event:unknown)=>void)|null=null;
  onclose:((event:unknown)=>void)|null=null;
  onmessage:((event:{data:string})=>void)|null=null;
  constructor(public readonly url:string) {
    FakeSocket.instances.push(this);
    queueMicrotask(()=>this.onopen?.({}));
  }
  send(value:string){this.sent.push(JSON.parse(value) as Record<string,unknown>);}
  close(){this.readyState=3;this.onclose?.({});}
  emit(value:Record<string,unknown>){this.onmessage?.({data:JSON.stringify(value)});}
}

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();FakeSocket.instances=[];});

async function connected(){
  vi.stubGlobal('WebSocket',FakeSocket);
  vi.stubGlobal('fetch',vi.fn(async()=>({
    ok:true,json:async()=>[{id:'living-room',name:'Living room',url:'wss://receiver.example/tv',authToken:'signed-token'}],
  })));
  const receiver=createJhadinaTVReceiverTransport();
  const connecting=receiver.connect({id:'living-room',name:'Living room',transport:'jhadinatv-tv'});
  await vi.waitFor(()=>expect(FakeSocket.instances).toHaveLength(1));
  const ws=FakeSocket.instances[0]!;
  ws.emit({type:'authenticated',verified:true,receiverId:'living-room'});
  await connecting;
  return {receiver,ws};
}

describe('JH-CLOSE.02D receiver correlated acknowledgment',()=>{
  it('will not treat socket.send as a loaded/playing asset; requires correlated playback proof',async()=>{
    const {receiver,ws}=await connected();
    const sourceUrl='https://media.example/authorized.mp4';
    const loading=receiver.load(sourceUrl,15);
    await vi.waitFor(()=>expect(ws.sent.some(x=>x.type==='load')).toBe(true));
    const last=ws.sent.find(x=>x.type==='load')!;
    ws.emit({type:'load-ack',receiverId:'living-room',requestId:'wrong-request',accepted:true,playbackStarted:true});
    ws.emit({type:'load-ack',receiverId:'living-room',requestId:last.requestId,accepted:true,playbackStarted:true,
      state:{titleId:'title-1',kind:'movie',sourceUrl:'https://media.example/wrong.mp4',positionSeconds:15,playing:true}});
    await expect(loading).rejects.toThrow('did not confirm');
    await receiver.disconnect();
  });

  it('resolves a matching load ACK with source and playback evidence and a command ACK',async()=>{
    const {receiver,ws}=await connected();
    const sourceUrl='https://media.example/authorized.mp4';
    const loading=receiver.load(sourceUrl,5);
    await vi.waitFor(()=>expect(ws.sent.some(x=>x.type==='load')).toBe(true));
    const load=ws.sent.find(x=>x.type==='load')!;
    ws.emit({type:'load-ack',receiverId:'living-room',requestId:load.requestId,accepted:true,playbackStarted:true,
      state:{titleId:'title-1',kind:'movie',sourceUrl,positionSeconds:5,playing:true}});
    await expect(loading).resolves.toBeUndefined();
    expect((await receiver.state())?.sourceUrl).toBe(sourceUrl);

    const play=receiver.send({type:'play'});
    await vi.waitFor(()=>expect(ws.sent.some(x=>x.type==='command')).toBe(true));
    const command=ws.sent.find(x=>x.type==='command')!;
    ws.emit({type:'command-ack',receiverId:'living-room',requestId:command.requestId,accepted:true});
    await expect(play).resolves.toBeUndefined();
    await receiver.disconnect();
  });

  it('rejects unresolved work on disconnect without reporting success',async()=>{
    const {receiver}=await connected();
    const pending=receiver.send({type:'pause'});
    await receiver.disconnect();
    await expect(pending).rejects.toThrow('disconnected');
  });
});
