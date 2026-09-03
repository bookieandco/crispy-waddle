import type { HistoricalPoolTransaction } from './solana-pool-history'
import type { DlmmPositionTransition } from './meteora-dlmm-position-state'

export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
type Instruction = { programId?: unknown; programIdIndex?: unknown; accounts?: unknown; data?: unknown }
type AccountKey = string | { pubkey?: string }
export type MeteoraDlmmDecoderContext = { poolAddress?: string; tokenMint?: string }

const DISC = {
  ADD:[181,157,89,67,143,182,52,72], ADD_WEIGHT:[28,140,238,99,231,162,21,149], ADD_STRATEGY:[7,3,150,127,148,40,61,200], ADD_STRATEGY_ONE_SIDE:[41,5,238,175,100,225,6,205], ADD_ONE_SIDE:[94,155,103,151,70,95,220,165],
  REMOVE:[80,85,209,72,24,206,177,108], REMOVE_V2:[230,215,82,127,241,101,227,146], REMOVE_RANGE:[26,82,102,152,240,74,105,26], REMOVE_RANGE_V2:[204,2,195,145,53,145,145,205],
  INIT:[219,192,234,71,190,191,102,80], INIT_PDA:[46,82,125,146,85,141,228,153], INIT_OPERATOR:[251,189,190,244,117,254,35,148],
  CLOSE:[123,134,81,0,49,68,98,98], CLOSE_V2:[174,90,35,115,186,40,147,226], CLOSE_EMPTY:[59,124,212,118,91,152,110,157], REBALANCE:[92,4,176,193,119,185,83,9], CLAIM_FEE:[169,32,79,137,136,232,70,137],
} as const
const EVENTS = {
  ADD:[31,94,125,90,227,52,61,186], REMOVE:[116,244,97,232,103,31,152,58], POSITION_CREATE:[144,142,252,84,157,53,37,121], POSITION_CLOSE:[255,196,16,107,28,202,53,128], REBALANCE:[0,109,117,179,61,91,199,200], CLAIM_FEE:[75,122,154,48,140,74,123,163],
} as const
const same=(d:Uint8Array,p:readonly number[])=>d.length>=p.length&&p.every((v,i)=>d[i]===v)
const i32=(d:Uint8Array,o:number)=>d.length>=o+4?((d[o]|d[o+1]<<8|d[o+2]<<16|d[o+3]<<24)>>0):undefined
const u16=(d:Uint8Array,o:number)=>d.length>=o+2?d[o]|d[o+1]<<8:undefined
function u64(d:Uint8Array,o:number):bigint|undefined{if(d.length<o+8)return;let n=0n;for(let i=0;i<8;i++)n|=BigInt(d[o+i])<<BigInt(i*8);return n}
function readPubkey(d:Uint8Array,o:number):string|undefined{if(d.length<o+32)return;const a='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(let i=0;i<32;i++)n=(n<<8n)+BigInt(d[o+i]);let s='';while(n){s=a[Number(n%58n)]+s;n/=58n}let z=0;while(z<32&&d[o+z]===0){s='1'+s;z++}return s||'1'}
function base58(v:string):Uint8Array|undefined{const a='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of v){const x=a.indexOf(c);if(x<0)return;n=n*58n+BigInt(x)}const out:number[]=[];while(n){out.unshift(Number(n&255n));n>>=8n}for(const c of v)if(c==='1')out.unshift(0);else break;return Uint8Array.from(out)}
function base64(v:string):Uint8Array|undefined{try{const s=globalThis.atob(v);return Uint8Array.from(s,c=>c.charCodeAt(0))}catch{return}}
function keys(raw:Record<string,unknown>):AccountKey[]{const tx=raw.transaction&&typeof raw.transaction==='object'?raw.transaction as Record<string,unknown>:raw;const m=tx.message&&typeof tx.message==='object'?tx.message as Record<string,unknown>:undefined;const k=m?.accountKeys??tx.accountKeys??raw.accountKeys;return Array.isArray(k)?k.filter((x):x is AccountKey=>typeof x==='string'||!!x&&typeof x==='object'):[]}
function key(k:AccountKey[],i:unknown){return typeof i==='number'&&Number.isInteger(i)&&i>=0?(typeof k[i]==='string'?k[i]:(k[i] as {pubkey?:string}|undefined)?.pubkey):undefined}
function ix(raw:Record<string,unknown>):Instruction[]{const tx=raw.transaction&&typeof raw.transaction==='object'?raw.transaction as Record<string,unknown>:raw;const m=tx.message&&typeof tx.message==='object'?tx.message as Record<string,unknown>:undefined;return Array.isArray(m?.instructions)?m.instructions as Instruction[]:[]}
function logMessages(raw:Record<string,unknown>):string[]{const m=raw.meta&&typeof raw.meta==='object'?raw.meta as Record<string,unknown>:undefined;const tx=raw.transaction&&typeof raw.transaction==='object'?raw.transaction as Record<string,unknown>:undefined;const tm=tx?.meta&&typeof tx.meta==='object'?tx.meta as Record<string,unknown>:undefined;const v=m?.logMessages??tm?.logMessages;return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]}
function transition(base:Omit<DlmmPositionTransition,'eventId'>,suffix:string):DlmmPositionTransition{return {...base,eventId:`meteora-dlmm:${base.signature}:${suffix}`}}

export class MeteoraDlmmPositionInstructionDecoder {
  constructor(private readonly context:MeteoraDlmmDecoderContext={}){}
  decode(transaction:HistoricalPoolTransaction):DlmmPositionTransition[]{
    if(!transaction.raw||typeof transaction.raw!=='object')return[]
    const raw=transaction.raw as Record<string,unknown>, k=keys(raw), out:DlmmPositionTransition[]=[]
    const push=(v:Omit<DlmmPositionTransition,'eventId'>,s:string)=>out.push(transition(v,s))
    for(const q of ix(raw)){
      if((typeof q.programId==='string'?q.programId:key(k,q.programIdIndex))!==METEORA_DLMM_PROGRAM_ID)continue
      const a=Array.isArray(q.accounts)?q.accounts:[], d=typeof q.data==='string'?base58(q.data):q.data instanceof Uint8Array?q.data:undefined
      if(!d||d.length<8)continue
      const pool=this.context.poolAddress??key(k,a[1]); const common={signature:transaction.signature,observedAt:transaction.observedAt,poolAddress:pool??'',tokenMint:this.context.tokenMint,evidenceIds:[transaction.evidenceId],confidence:1,semantic:'EXPLICIT' as const}
      if(same(d,DISC.INIT)||same(d,DISC.INIT_PDA)||same(d,DISC.INIT_OPERATOR)){
        const isOp=same(d,DISC.INIT_OPERATOR), isPda=same(d,DISC.INIT_PDA), lower=i32(d,8), width=i32(d,12), p=key(k,a[isOp||isPda?2:1]), owner=key(k,a[isOp||isPda?4:3]), lb=key(k,a[isOp||isPda?3:2]);
        if(p&&lb&&lower!==undefined&&width!==undefined&&width>=0)push({...common,positionAddress:p,poolAddress:lb,owner,operator:isOp?key(k,a[5]):undefined,fromBinId:lower,toBinId:lower+width,action:'OPEN'},'open:'+p)
      } else if(same(d,DISC.CLOSE)||same(d,DISC.CLOSE_V2)||same(d,DISC.CLOSE_EMPTY)){
        const p=key(k,a[0]),owner=same(d,DISC.CLOSE)?key(k,a[4]):key(k,a[1]);if(p&&pool)push({...common,positionAddress:p,poolAddress:pool,owner,action:'CLOSE'},'close:'+p)
      } else if(same(d,DISC.REMOVE_RANGE)||same(d,DISC.REMOVE_RANGE_V2)){
        const p=key(k,a[0]),lb=key(k,a[1]),from=i32(d,8),to=i32(d,12),bps=u16(d,16),owner=key(k,a[11]??a[9]);if(p&&lb&&from!==undefined&&to!==undefined&&bps!==undefined)push({...common,positionAddress:p,poolAddress:lb,owner,fromBinId:from,toBinId:to,removedBps:bps,action:'REMOVE'},`remove-range:${p}:${from}:${to}`)
      } else if(same(d,DISC.REMOVE)||same(d,DISC.REMOVE_V2)){
        const p=key(k,a[0]),lb=key(k,a[1]),owner=key(k,a[11]??a[9]);if(p&&lb)push({...common,positionAddress:p,poolAddress:lb,owner,action:'REMOVE'},'remove:'+p)
      } else if(same(d,DISC.REBALANCE)){
        const p=key(k,a[0]),lb=key(k,a[1]),owner=key(k,a[9]??a[8]),active=i32(d,8);if(p&&lb)push({...common,positionAddress:p,poolAddress:lb,owner,activeBinId:active,action:'REBALANCE'},'rebalance:'+p)
      } else if(same(d,DISC.CLAIM_FEE)){
        const lb=key(k,a[0]),p=key(k,a[1]),owner=key(k,a[2]);if(p&&lb)push({...common,positionAddress:p,poolAddress:lb,owner,action:'CLAIM_FEE'},'claim-fee:'+p)
      } else if(same(d,DISC.ADD)||same(d,DISC.ADD_WEIGHT)||same(d,DISC.ADD_STRATEGY)||same(d,DISC.ADD_STRATEGY_ONE_SIDE)||same(d,DISC.ADD_ONE_SIDE)){
        const p=key(k,a[0]),lb=key(k,a[1]),owner=key(k,a[11]??a[8]);if(p&&lb)push({...common,positionAddress:p,poolAddress:lb,owner,action:'ADD'},'add:'+p)
      }
    }
    for(const line of logMessages(raw)){
      const marker=line.match(/Program data:\s*([A-Za-z0-9+/=]+)$/)?.[1],d=marker?base64(marker):undefined;if(!d||d.length<8)continue
      if(same(d,EVENTS.POSITION_CREATE)){const lb=readPubkey(d,8),p=readPubkey(d,40),owner=readPubkey(d,72);if(lb&&p&&owner&&(!this.context.poolAddress||lb===this.context.poolAddress))push({signature:transaction.signature,observedAt:transaction.observedAt,poolAddress:lb,tokenMint:this.context.tokenMint,positionAddress:p,owner,action:'OPEN',evidenceIds:[transaction.evidenceId],confidence:1,semantic:'EXPLICIT'},'event-open:'+p)}
      else if(same(d,EVENTS.POSITION_CLOSE)){const p=readPubkey(d,8),owner=readPubkey(d,40);if(p&&owner&&this.context.poolAddress)push({signature:transaction.signature,observedAt:transaction.observedAt,poolAddress:this.context.poolAddress,tokenMint:this.context.tokenMint,positionAddress:p,owner,action:'CLOSE',evidenceIds:[transaction.evidenceId],confidence:1,semantic:'EXPLICIT'},'event-close:'+p)}
      else if(same(d,EVENTS.ADD)||same(d,EVENTS.REMOVE)){const lb=readPubkey(d,8),owner=readPubkey(d,40),p=readPubkey(d,72),x=u64(d,104),y=u64(d,112),active=i32(d,120);if(!lb||!p||x===undefined||y===undefined||active===undefined||this.context.poolAddress&&lb!==this.context.poolAddress)continue;const action=same(d,EVENTS.ADD)?'ADD':'REMOVE';push({signature:transaction.signature,observedAt:transaction.observedAt,poolAddress:lb,tokenMint:this.context.tokenMint,positionAddress:p,owner,action,activeBinId:active,tokenXDeltas:x,tokenYDeltas:y,oneSided:(x===0n)!==(y===0n),evidenceIds:[transaction.evidenceId],confidence:1,semantic:'EXPLICIT'},`event-${action.toLowerCase()}:${p}`)}
      else if(same(d,EVENTS.REBALANCE)){const lb=readPubkey(d,8),p=readPubkey(d,40),owner=readPubkey(d,72),active=i32(d,104),newMin=i32(d,164),newMax=i32(d,168);if(lb&&p&&owner&&active!==undefined&&newMin!==undefined&&newMax!==undefined&&(!this.context.poolAddress||lb===this.context.poolAddress))push({signature:transaction.signature,observedAt:transaction.observedAt,poolAddress:lb,tokenMint:this.context.tokenMint,positionAddress:p,owner,activeBinId:active,fromBinId:newMin,toBinId:newMax,action:'REBALANCE',evidenceIds:[transaction.evidenceId],confidence:1,semantic:'EXPLICIT'},'event-rebalance:'+p)}
      else if(same(d,EVENTS.CLAIM_FEE)){const lb=readPubkey(d,8),p=readPubkey(d,40),owner=readPubkey(d,72);if(lb&&p&&owner&&(!this.context.poolAddress||lb===this.context.poolAddress))push({signature:transaction.signature,observedAt:transaction.observedAt,poolAddress:lb,tokenMint:this.context.tokenMint,positionAddress:p,owner,action:'CLAIM_FEE',evidenceIds:[transaction.evidenceId],confidence:1,semantic:'EXPLICIT'},'event-claim-fee:'+p)}
    }
    const preferred=new Map<string,DlmmPositionTransition>();for(const t of out){const k2=`${t.signature}:${t.positionAddress}:${t.action}`;if(!preferred.has(k2)||t.eventId.includes(':event-'))preferred.set(k2,t)}return [...preferred.values()]
  }
}
