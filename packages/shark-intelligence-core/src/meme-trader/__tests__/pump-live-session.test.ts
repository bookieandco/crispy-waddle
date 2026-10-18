import {describe,expect,it,vi} from 'vitest'
import {PumpSolanaLogsSession} from '../pump-live-session'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'

class Socket{
  listeners:Record<string,((event:any)=>void)[]>={}
  sent:string[]=[]
  closed=0
  send(s:string){this.sent.push(s)}
  close(){this.closed++}
  addEventListener(name:'open'|'message'|'close'|'error',listener:(event:any)=>void){
    (this.listeners[name]??=[]).push(listener)
  }
  emit(name:string,data:any={}){for(const callback of this.listeners[name]??[])callback(data)}
}
const signature='2'.repeat(64)
const notification=(subscription:number)=>({
  jsonrpc:'2.0',method:'logsNotification',
  params:{subscription,result:{context:{slot:42},value:{signature,err:null,logs:[
    'Program '+PUMP_PROGRAM_ID+' invoke [1]',
    'Program '+PUMP_PROGRAM_ID+' success',
  ]}}},
})
describe('Solana Pump WebSocket session',()=>{
 it('subscribes to one Pump program and gates notifications by acknowledged subscription ID',async()=>{
  const sockets:Socket[]=[]
  const deliver=vi.fn(async()=>{})
  const gaps:string[]=[]
  const session=new PumpSolanaLogsSession({
    endpoint:'wss://api.mainnet-beta.solana.com',
    socketFactory:()=>{const s=new Socket();sockets.push(s);return s},
    now:()=> '2026-10-17T18:00:00Z',
    schedule:()=>({cancel:()=>{}}),
    onNotification:deliver,
    onGap:({reason})=>gaps.push(reason),
  })
  session.start()
  const s=sockets[0]!
  s.emit('open')
  expect(JSON.parse(s.sent[0]!).params).toEqual([{mentions:[PUMP_PROGRAM_ID]},{commitment:'confirmed'}])
  s.emit('message',{data:JSON.stringify(notification(10))})
  expect(session.health().ignored).toBe(1)
  s.emit('message',{data:JSON.stringify({jsonrpc:'2.0',id:1,result:17})})
  expect(session.health().status).toBe('LIVE')
  s.emit('message',{data:JSON.stringify(notification(18))})
  expect(session.health().ignored).toBe(2)
  s.emit('message',{data:JSON.stringify(notification(17))})
  await Promise.resolve();await Promise.resolve()
  expect(deliver).toHaveBeenCalledTimes(1)
  expect(session.health().notifications).toBe(1)
  expect(gaps).toEqual([])
  session.stop()
  expect(s.closed).toBe(1)
 })
 it('reports disconnect and reconnects with another subscription; stop revokes timers',()=>{
  const sockets:Socket[]=[]
  const timers:{fn:()=>void;ms:number;cancelled:boolean}[]=[]
  const gaps:string[]=[]
  const session=new PumpSolanaLogsSession({
    endpoint:'wss://example.test/rpc',
    socketFactory:()=>{const s=new Socket();sockets.push(s);return s},
    now:()=>new Date().toISOString(),
    schedule:(fn,ms)=>{const t={fn,ms,cancelled:false};timers.push(t);return {cancel:()=>{t.cancelled=true}}},
    onNotification:async()=>{},
    onGap:({reason})=>gaps.push(reason),
  })
  session.start()
  sockets[0]!.emit('open')
  sockets[0]!.emit('message',{data:JSON.stringify({id:1,result:1})})
  sockets[0]!.emit('close')
  expect(session.health().gaps).toBe(1)
  expect(session.health().status).toBe('RECONNECTING')
  expect(timers[0]!.ms).toBe(2000)
  timers[0]!.fn()
  expect(sockets).toHaveLength(2)
  sockets[1]!.emit('open')
  sockets[1]!.emit('message',{data:JSON.stringify({id:1,result:2})})
  expect(session.health().status).toBe('LIVE')
  expect(gaps).toEqual(['DISCONNECT'])
  sockets[1]!.emit('close')
  session.stop()
  expect(timers[1]!.cancelled).toBe(true)
  expect(session.health().status).toBe('STOPPED')
 })
 it('fails closed for insecure credentials, bad ack, malformed JSON, and oversized frames',()=>{
  expect(()=>new PumpSolanaLogsSession({
    endpoint:'ws://example.test',socketFactory:()=>new Socket(),
    now:()=>'',schedule:()=>({cancel:()=>{}}),
    onNotification:async()=>{},onGap:()=>{},
  })).toThrow('endpoint_invalid')
  const sockets:Socket[]=[]
  const gaps:string[]=[]
  const session=new PumpSolanaLogsSession({
    endpoint:'wss://example.test',socketFactory:()=>{const s=new Socket();sockets.push(s);return s},
    now:()=>new Date().toISOString(),schedule:()=>({cancel:()=>{}}),
    maxFrameBytes:200,onNotification:async()=>{},
    onGap:({reason})=>gaps.push(reason),
  })
  session.start();sockets[0]!.emit('open')
  sockets[0]!.emit('message',{data:'not-json'})
  sockets[0]!.emit('message',{data:'z'.repeat(300)})
  sockets[0]!.emit('message',{data:JSON.stringify({id:1,error:{code:-32000}})})
  expect(session.health().ignored).toBe(2)
  expect(gaps).toEqual(['SUBSCRIBE_ERROR'])
  session.stop()
 })
})
