/**
 * JHADINA-KALSHI.04 — server-side signed, subscribe-only Kalshi WebSocket
 * protocol adapter. NEVER exposes API keys to a browser or Google Drive.
 *
 * A host-owned, audited WebSocket factory must support custom handshake
 * headers (for example a separately installed `ws` module). Using the
 * browser/Node global WebSocket alone is insufficient for Kalshi auth headers.
 * This package deliberately contains no order/cancel/mutate API.
 */
import {constants, createPrivateKey, createSign, sign as signBytes} from 'node:crypto';
import type {
  KalshiReadOnlyFeed, KalshiReadOnlyFeedConnection,
} from './kalshi-15m-study-worker.js';

export type KalshiFeedEnv = 'demo' | 'production';
const URLS: Readonly<Record<KalshiFeedEnv,string>> = {
  production:'wss://external-api-ws.kalshi.com/trade-api/ws/v2',
  demo:'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2',
};
const WS_SIGN_PATH='/trade-api/ws/v2';

export interface KalshiServerWebSocket {
  on(event:'open',cb:()=>void):this;
  on(event:'message',cb:(message:unknown)=>void):this;
  on(event:'error',cb:(err:unknown)=>void):this;
  on(event:'close',cb:()=>void):this;
  send(data:string):void;
  close(code?:number,reason?:string):void;
  terminate?():void;
}

export type KalshiServerSocketFactory = (
  url:string,
  options:{headers:Readonly<Record<string,string>>;handshakeTimeout:number;perMessageDeflate:false}
)=>KalshiServerWebSocket;

export type KalshiFeedOptions = Readonly<{
  environment:KalshiFeedEnv;
  apiKeyId:string;
  privateKeyPem:string;
  socketFactory:KalshiServerSocketFactory;
  now?:()=>number;
  subscribeTimeoutMs?:number;
  silentFeedTimeoutMs?:number;
}>;

export function kalshiWebsocketAuthHeaders(input: {
  apiKeyId:string;
  privateKeyPem:string;
  nowMs:number;
}): Readonly<Record<string,string>> {
  if (!input.apiKeyId.trim() || !input.privateKeyPem.trim() ||
      !Number.isFinite(input.nowMs) || input.nowMs < 0)
    throw new Error('KALSHI_WS_CREDENTIALS_MISSING');
  const key=createPrivateKey(input.privateKeyPem);
  const message=Buffer.from(String(Math.floor(input.nowMs))+'GET'+WS_SIGN_PATH,'utf8');
  let signature:string;
  if (key.asymmetricKeyType==='rsa' || key.asymmetricKeyType==='rsa-pss') {
    const signer=createSign('RSA-SHA256'); signer.update(message); signer.end();
    signature=signer.sign({
      key,padding:constants.RSA_PKCS1_PSS_PADDING,
      saltLength:constants.RSA_PSS_SALTLEN_DIGEST,
    }).toString('base64');
  } else if (key.asymmetricKeyType==='ed25519') {
    signature=signBytes(null,message,key).toString('base64');
  } else throw new Error('KALSHI_WS_KEY_TYPE_FORBIDDEN');
  return Object.freeze({
    'KALSHI-ACCESS-KEY':input.apiKeyId,
    'KALSHI-ACCESS-TIMESTAMP':String(Math.floor(input.nowMs)),
    'KALSHI-ACCESS-SIGNATURE':signature,
  });
}

function object(value:unknown): Record<string,unknown> | null {
  return value!==null && typeof value==='object' && !Array.isArray(value)
    ? value as Record<string,unknown>:null;
}
function parseFrame(value:unknown):Record<string,unknown>|null {
  let json:unknown;
  try {
    const content=typeof value==='string'?value:
      Buffer.isBuffer(value)?value.toString('utf8'):null;
    if (!content || content.length>1_000_000) return null;
    json=JSON.parse(content);
  } catch {return null;}
  return object(json);
}

export class KalshiSignedStudyFeed implements KalshiReadOnlyFeed {
  readonly authority='LIVE_READ_ONLY' as const;
  private readonly options:KalshiFeedOptions;
  constructor(options:KalshiFeedOptions) {
    if (options.environment!=='demo' && options.environment!=='production')
      throw new Error('KALSHI_WS_ENV_INVALID');
    if (!options.socketFactory || !options.apiKeyId.trim() ||
        !options.privateKeyPem.trim()) throw new Error('KALSHI_WS_CONFIG_MISSING');
    this.options=options;
  }

  async subscribe(
    marketTicker:string,
    receive:(frame:unknown,receivedAtMs:number)=>void,
    disconnected:()=>void,
  ):Promise<KalshiReadOnlyFeedConnection> {
    if (!/^KXBTC15M-[A-Za-z0-9-]+$/.test(marketTicker))
      throw new Error('KALSHI_WS_TICKER_INVALID');
    const now=this.options.now??Date.now;
    const headers=kalshiWebsocketAuthHeaders({
      apiKeyId:this.options.apiKeyId,
      privateKeyPem:this.options.privateKeyPem,
      nowMs:now(),
    });
    const socket=this.options.socketFactory(URLS[this.options.environment],{
      headers,handshakeTimeout:8_000,perMessageDeflate:false,
    });
    let closed=false,connected=false,acknowledged=false;
    let finished=false,latestIndexAt=now(),timer:ReturnType<typeof setInterval>|null=null;
    const expected=new Map<number,'orderbook_delta'|'cfbenchmarks_value'>([
      [1,'orderbook_delta'],[2,'cfbenchmarks_value'],
    ]);
    const subscriptions=new Map<string,number>();

    let succeed: (connection:KalshiReadOnlyFeedConnection)=>void=()=>{};
    let fail: (reason:Error)=>void=()=>{};
    const ready=new Promise<KalshiReadOnlyFeedConnection>((resolve,reject)=>{
      succeed=resolve;fail=reject;
    });
    const abort=(code:string)=>{
      if (closed) return;
      closed=true;
      if(timer!==null)clearInterval(timer);
      if (!finished) {finished=true;fail(new Error(code));}
      else disconnected();
      try{socket.close();}catch{/* local closing only */}
    };
    const handshakeTimeout=setTimeout(()=>abort('KALSHI_WS_SUBSCRIBE_TIMEOUT'),
      this.options.subscribeTimeoutMs??10_000);
    const observeClosed=()=>abort('KALSHI_WS_DISCONNECTED');

    socket.on('open',()=>{
      if (closed)return;
      connected=true;
      // Explicitly allow ONLY two subscribed, read-only market-data channels.
      try {
        socket.send(JSON.stringify({id:1,cmd:'subscribe',params:{
          channels:['orderbook_delta'],market_ticker:marketTicker,
          use_yes_price:false,
        }}));
        socket.send(JSON.stringify({id:2,cmd:'subscribe',params:{
          channels:['cfbenchmarks_value'],index_ids:['BRTI'],
        }}));
      }catch{abort('KALSHI_WS_SUBSCRIBE_SEND_FAILED');}
    });
    socket.on('message',data=>{
      if (closed || !connected)return;
      const frame=parseFrame(data);
      if(!frame)return;
      if(frame.type==='error'){
        abort('KALSHI_WS_PROVIDER_REJECTED');return;
      }
      if(frame.type==='subscribed'){
        const id=frame.id, msg=object(frame.msg);
        const expectedChannel=typeof id==='number'?expected.get(id):undefined;
        if (!expectedChannel || !msg || msg.channel!==expectedChannel ||
            typeof msg.sid!=='number' || !Number.isSafeInteger(msg.sid)) {
          abort('KALSHI_WS_SUBSCRIPTION_INVALID');return;
        }
        subscriptions.set(expectedChannel,msg.sid);
        if(subscriptions.size===2 && !acknowledged){
          acknowledged=true;finished=true;
          clearTimeout(handshakeTimeout);
          const timeout=this.options.silentFeedTimeoutMs??8_000;
          timer=setInterval(()=>{
            if (!closed && now()-latestIndexAt>timeout)
              abort('KALSHI_WS_INDEX_FEED_SILENT');
          },1000);
          succeed(Object.freeze({close:async()=>{
            if(closed)return;
            closed=true;
            clearTimeout(handshakeTimeout);
            if(timer!==null)clearInterval(timer);
            socket.close();
          }}));
        }
        return;
      }
      if(!acknowledged)return;
      const sid=frame.sid,msg=object(frame.msg);
      if(typeof sid!=='number'||!msg)return;
      if((frame.type==='orderbook_snapshot'||frame.type==='orderbook_delta') &&
          sid===subscriptions.get('orderbook_delta') &&
          msg.market_ticker===marketTicker){
        receive(frame,now());return;
      }
      if(frame.type==='cfbenchmarks_value' &&
          sid===subscriptions.get('cfbenchmarks_value') &&
          msg.index_id==='BRTI'){
        latestIndexAt=now();
        receive(frame,now());
      }
    });
    socket.on('error',()=>abort('KALSHI_WS_TRANSPORT_ERROR'));
    socket.on('close',observeClosed);
    try{return await ready;}
    finally{clearTimeout(handshakeTimeout);}
  }
}
