import assert from 'node:assert/strict';
import {constants,generateKeyPairSync,verify} from 'node:crypto';
import test from 'node:test';
import {
  KalshiSignedStudyFeed, kalshiWebsocketAuthHeaders,
  type KalshiServerWebSocket,
} from './kalshi-15m-wss-transport.js';

type Callback=(...args:unknown[])=>void;
class FakeSocket implements KalshiServerWebSocket {
  readonly handlers=new Map<string,Callback[]>();
  readonly sent:string[]=[];
  closes=0;
  on(event:'open'|'message'|'error'|'close',cb:Callback):this{
    const current=this.handlers.get(event)??[];
    current.push(cb);
    this.handlers.set(event,current);
    return this;
  }
  emit(event:string,...args:unknown[]):void{
    for(const cb of this.handlers.get(event)??[])cb(...args);
  }
  send(v:string):void{this.sent.push(v);}
  close():void{this.closes++;}
}
const ticker='KXBTC15M-26OCT131700-00';
const keyPair=generateKeyPairSync('rsa',{modulusLength:2048});
const privateKeyPem=keyPair.privateKey.export({format:'pem',type:'pkcs8'}).toString();
const receiptTime=1_761_000_000_000;

test('signed WS handshake authenticates exact GET path with RSA-PSS',()=>{
  const headers=kalshiWebsocketAuthHeaders({
    apiKeyId:'synthetic-id',privateKeyPem,nowMs:receiptTime,
  });
  assert.equal(headers['KALSHI-ACCESS-KEY'],'synthetic-id');
  const msg=Buffer.from(String(receiptTime)+'GET/trade-api/ws/v2');
  assert.equal(verify('RSA-SHA256',msg,{
    key:keyPair.publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,
    saltLength:constants.RSA_PSS_SALTLEN_DIGEST,
  },Buffer.from(headers['KALSHI-ACCESS-SIGNATURE']!,'base64')),true);
});

test('subscribes ONLY book and BRTI and rejects unapproved subscribed channels',async()=>{
  const socket=new FakeSocket();
  let url='',headers:Readonly<Record<string,string>>={};
  const receive:unknown[]=[];
  const feed=new KalshiSignedStudyFeed({
    environment:'production',apiKeyId:'synthetic-id',privateKeyPem,now:()=>receiptTime,
    socketFactory:(u,opts)=>{url=u;headers=opts.headers;return socket;},
  });
  const p=feed.subscribe(ticker,(f)=>receive.push(f),()=>{});
  socket.emit('open');
  assert.equal(url,'wss://external-api-ws.kalshi.com/trade-api/ws/v2');
  assert.equal(headers['KALSHI-ACCESS-KEY'],'synthetic-id');
  assert.deepEqual(socket.sent.map(s=>JSON.parse(s)),[
    {id:1,cmd:'subscribe',params:{
      channels:['orderbook_delta'],market_ticker:ticker,use_yes_price:false,
    }},
    {id:2,cmd:'subscribe',params:{channels:['cfbenchmarks_value'],index_ids:['BRTI']}},
  ]);
  socket.emit('message',JSON.stringify({id:1,type:'subscribed',msg:{channel:'orderbook_delta',sid:18}}));
  socket.emit('message',JSON.stringify({id:2,type:'subscribed',msg:{channel:'cfbenchmarks_value',sid:20}}));
  const conn=await p;
  socket.emit('message',JSON.stringify({type:'orderbook_snapshot',sid:18,seq:1,
    msg:{market_ticker:ticker,yes_dollars_fp:[],no_dollars_fp:[]}}));
  socket.emit('message',JSON.stringify({type:'cfbenchmarks_value',sid:20,seq:3,
    msg:{index_id:'BRTI',data:JSON.stringify({id:'BRTI',type:'value',time:receiptTime,value:'83303'})}}));
  socket.emit('message',JSON.stringify({type:'fill',sid:20,msg:{secret:'ignore'}}));
  socket.emit('message',JSON.stringify({type:'cfbenchmarks_value',sid:20,msg:{index_id:'ETHUSD_RTI'}}));
  assert.equal(receive.length,2);
  await conn.close();
  assert.equal(socket.closes,1);
});

test('subscription rejection or channel mismatch never returns ready connection',async()=>{
  const socket=new FakeSocket();
  const feed=new KalshiSignedStudyFeed({
    environment:'demo',apiKeyId:'test',privateKeyPem,now:()=>receiptTime,
    socketFactory:()=>socket,subscribeTimeoutMs:2000,
  });
  const p=feed.subscribe(ticker,()=>{},()=>{});
  socket.emit('open');
  socket.emit('message',JSON.stringify({type:'subscribed',id:1,msg:{channel:'fill',sid:5}}));
  await assert.rejects(p,/SUBSCRIPTION_INVALID/);
  assert.equal(socket.closes,1);
});

test('unexpected disconnection invokes watcher, never fabricates a book',async()=>{
  const socket=new FakeSocket();let breaks=0;
  const feed=new KalshiSignedStudyFeed({
    environment:'demo',apiKeyId:'test',privateKeyPem,now:()=>receiptTime,
    socketFactory:()=>socket,
  });
  const p=feed.subscribe(ticker,()=>{},()=>{breaks++});
  socket.emit('open');
  socket.emit('message',JSON.stringify({id:1,type:'subscribed',msg:{channel:'orderbook_delta',sid:1}}));
  socket.emit('message',JSON.stringify({id:2,type:'subscribed',msg:{channel:'cfbenchmarks_value',sid:2}}));
  await p;socket.emit('close');
  assert.equal(breaks,1);
});
