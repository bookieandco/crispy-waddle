import {buildPumpLogsSubscribeRequest, type SolanaLogsNotification} from './pump-anchor-log-decoder'

/** SHARK-ALPHA.FABRIC.05 — bounded Solana logsSubscribe transport, no trading. */
export type PumpSocket=Readonly<{
  send:(text:string)=>void
  close:()=>void
  addEventListener:(name:'open'|'message'|'close'|'error',listener:(event:any)=>void)=>void
}>
export type PumpStreamHealth=Readonly<{
  status:'STOPPED'|'CONNECTING'|'SUBSCRIBING'|'LIVE'|'RECONNECTING'
  attempts:number
  gaps:number
  notifications:number
  ignored:number
  lastReceivedAt?:string
  subscription?:number
  canTrade:false
}>
export type PumpSessionOptions=Readonly<{
  endpoint:string
  socketFactory:(endpoint:string)=>PumpSocket
  now:()=>string
  schedule:(callback:()=>void,delayMs:number)=>{cancel:()=>void}
  onNotification:(notification:SolanaLogsNotification,receivedAt:string)=>Promise<void>
  onGap:(context:Readonly<{lastReceivedAt?:string;reason:'DISCONNECT'|'PROCESSING_FAILURE'|'SUBSCRIBE_ERROR'}>)=>void
  maxFrameBytes?:number
  maxAttempts?:number
}>

const validEndpoint=(value:string)=>{
  try{
    const url=new URL(value)
    if(url.protocol!=='wss:'||!url.hostname||url.username||url.password||url.hash)return false
    return true
  }catch{return false}
}
function normalizedFrame(value:unknown,max:number):string|null{
  if(typeof value==='string')return value.length<=max?value:null
  if(typeof value==='object'&&value!==null&&'data' in value)return normalizedFrame((value as {data:unknown}).data,max)
  return null
}
export class PumpSolanaLogsSession{
  private status:PumpStreamHealth['status']='STOPPED'
  private socket?:PumpSocket
  private retry?:{cancel:()=>void}
  private stopped=true
  private epoch=0
  private attempts=0
  private gaps=0
  private notifications=0
  private ignored=0
  private lastReceivedAt?:string
  private subscription?:number
  private queue=Promise.resolve()
  private subscribedOnce=false
  constructor(private readonly options:PumpSessionOptions){
    if(!validEndpoint(options.endpoint))throw new Error('shark_pump_ws_endpoint_invalid')
    if(options.maxFrameBytes!==undefined&&(!Number.isInteger(options.maxFrameBytes)||options.maxFrameBytes<100||options.maxFrameBytes>1_000_000))throw new Error('shark_pump_ws_frame_limit_invalid')
    if(options.maxAttempts!==undefined&&(!Number.isInteger(options.maxAttempts)||options.maxAttempts<1||options.maxAttempts>100))throw new Error('shark_pump_ws_attempt_limit_invalid')
  }
  health():PumpStreamHealth{return Object.freeze({
    status:this.status,attempts:this.attempts,gaps:this.gaps,
    notifications:this.notifications,ignored:this.ignored,
    lastReceivedAt:this.lastReceivedAt,subscription:this.subscription,canTrade:false,
  })}
  start():void{
    if(!this.stopped)throw new Error('shark_pump_ws_already_started')
    this.stopped=false
    this.connect()
  }
  stop():void{
    this.stopped=true;this.epoch++;this.retry?.cancel();this.retry=undefined
    this.socket?.close();this.socket=undefined;this.subscription=undefined;this.status='STOPPED'
  }
  private connect():void{
    if(this.stopped)return
    this.status=this.subscribedOnce?'RECONNECTING':'CONNECTING'
    this.subscription=undefined
    const epoch=++this.epoch
    let socket:PumpSocket
    try{socket=this.options.socketFactory(this.options.endpoint)}
    catch{this.backoff(epoch,'DISCONNECT');return}
    this.socket=socket
    socket.addEventListener('open',()=>{
      if(this.stopped||epoch!==this.epoch)return
      this.status='SUBSCRIBING'
      try{socket.send(JSON.stringify(buildPumpLogsSubscribeRequest({id:1,commitment:'confirmed'})))}
      catch{this.backoff(epoch,'SUBSCRIBE_ERROR')}
    })
    socket.addEventListener('message',(message)=>{
      if(this.stopped||epoch!==this.epoch)return
      const raw=normalizedFrame(message,this.options.maxFrameBytes??262_144)
      if(raw===null){this.ignored++;return}
      let payload:unknown
      try{payload=JSON.parse(raw)}catch{this.ignored++;return}
      if(!payload||typeof payload!=='object'||Array.isArray(payload)){this.ignored++;return}
      const o=payload as Record<string,unknown>
      if(o.id===1&&this.status==='SUBSCRIBING'){
        if(o.error||typeof o.result!=='number'||!Number.isSafeInteger(o.result)||o.result<0){
          this.backoff(epoch,'SUBSCRIBE_ERROR');return
        }
        this.subscription=Number(o.result)
        this.status='LIVE'
        this.attempts=0
        this.subscribedOnce=true
        return
      }
      const params=(o.params&&typeof o.params==='object'?o.params:null) as Record<string,unknown>|null
      if(this.status!=='LIVE'||o.method!=='logsNotification'||!params||
        params.subscription!==this.subscription||!params.result){this.ignored++;return}
      const receivedAt=this.options.now()
      if(!Number.isFinite(Date.parse(receivedAt))){this.backoff(epoch,'PROCESSING_FAILURE');return}
      this.lastReceivedAt=receivedAt
      this.notifications++
      // Serial admission, preserving socket delivery order and stateful bonding-curve baseline.
      const notification=payload as SolanaLogsNotification
      this.queue=this.queue.then(async()=>{
        if(this.stopped||epoch!==this.epoch)return
        await this.options.onNotification(notification,receivedAt)
      }).catch(()=>{
        if(!this.stopped&&epoch===this.epoch)this.backoff(epoch,'PROCESSING_FAILURE')
      })
    })
    socket.addEventListener('close',()=>{
      if(!this.stopped&&epoch===this.epoch)this.backoff(epoch,'DISCONNECT')
    })
    socket.addEventListener('error',()=>{
      if(!this.stopped&&epoch===this.epoch)this.backoff(epoch,'DISCONNECT')
    })
  }
  private backoff(epoch:number,reason:'DISCONNECT'|'PROCESSING_FAILURE'|'SUBSCRIBE_ERROR'):void{
    if(this.stopped||epoch!==this.epoch)return
    this.epoch++
    this.subscription=undefined
    this.gaps++
    this.options.onGap({lastReceivedAt:this.lastReceivedAt,reason})
    try{this.socket?.close()}catch{/* closing is best-effort */}
    this.socket=undefined
    this.attempts++
    const max=this.options.maxAttempts??12
    if(this.attempts>max){this.stop();return}
    const delay=Math.min(60_000,1_000*2**Math.min(this.attempts,6))
    this.status='RECONNECTING'
    this.retry=this.options.schedule(()=>{this.retry=undefined;this.connect()},delay)
  }
}

/** Runtime adapter for an explicitly commissioned Node 22+ owner host.
 * Never instantiate at module import, and never use a browser/client runtime. */
export function nativePumpSocketFactory(endpoint:string):PumpSocket{
  if(typeof WebSocket!=='function')throw new Error('shark_pump_native_websocket_unavailable')
  return new WebSocket(endpoint) as unknown as PumpSocket
}
export function realPumpSchedule(callback:()=>void,delayMs:number):{cancel:()=>void}{
  const handle=setTimeout(callback,delayMs)
  return {cancel:()=>clearTimeout(handle)}
}
