import {describe,expect,it,vi} from 'vitest'
import {validatePaperIngress,persistPaperIngress} from './paper-observation-ingress'

const at='2026-10-15T00:42:00Z'
const mint='So11111111111111111111111111111111111111112'
const pool='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const stamp=new Date('2026-10-15T00:43:00Z')
const market=()=>({
  type:'MARKET_OBSERVATION',digest:'1'.repeat(64),previousDigest:'0'.repeat(64),
  mint,pair:pool,observedAt:at,availableAt:at,securityStatus:'UNVERIFIED',
  canTrade:false,priceUsd:.0002,liquidityUsd:23500,flags:['MINT_FREEZE_LP_CONTROL_AND_HOLDERS_UNVERIFIED'],
})
const guard=()=>({
  type:'SHARK_MONEY_PAPER_GUARD',digest:'2'.repeat(64),previousDigest:'1'.repeat(64),
  mint,observedAt:at,availableAt:at,informationCutoff:at,
  moneyApproval:'ABSENT',paperNotionalUsd:0,simulatedFill:'NONE',
  disposition:'NO_TRADE',authority:'RESEARCH_ONLY',canTrade:false,
})
const packet=(events:any[]=[market(),guard()])=>({
  version:'SHARK-PAPER-INGRESS-01',experimentId:'JHADINA-MEME-20261013-7D-001',
  sourceDataCommit:'a'.repeat(40),ledgerHeadDigest:'f'.repeat(64),
  cycleDigest:'d'.repeat(64),cycleAvailableAt:at,
  totalEligibleInLastCycle:events.length,partialBatch:false,authority:'RESEARCH_ONLY',
  canTrade:false,canSign:false,canBroadcast:false,events,
})

describe('SHARK immutable no-money research ingress',()=>{
  it('maps actual mint, pool, observation timestamps and ledger provenance',()=>{
    const rows=validatePaperIngress(packet(),stamp)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      receipt_digest:'1'.repeat(64),event_kind:'MARKET_OBSERVATION',
      chain_id:'solana',mint,pool,event_available_at:at,can_trade:false,can_sign:false,
      can_broadcast:false,money_disposition:'NO_TRADE',authority:'RESEARCH_ONLY',
    })
    expect(rows[1]).toMatchObject({event_kind:'SHARK_MONEY_PAPER_GUARD',
      pool:null,safety_status:'UNVERIFIED',money_disposition:'NO_TRADE',can_trade:false})
  })
  it('rejects forged execution and paper fill or Money approval',()=>{
    const wrong=guard()
    expect(()=>validatePaperIngress(packet([{...wrong,moneyApproval:'APPROVED'}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_MONEY_ABSTENTION_INVALID')
    expect(()=>validatePaperIngress(packet([{...wrong,paperNotionalUsd:100}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_MONEY_ABSTENTION_INVALID')
    expect(()=>validatePaperIngress(packet([{...market(),canTrade:true}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_EVENT_EXECUTION_FORBIDDEN')
    expect(()=>validatePaperIngress({...packet(),canSign:true},stamp))
      .toThrow('SHARK_PAPER_INGRESS_ENVELOPE_UNSAFE')
  })
  it('rejects forged/missing market provenance or future-data leaks',()=>{
    expect(()=>validatePaperIngress(packet([{...market(),securityStatus:'SAFE'}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_MARKET_EVIDENCE_UNVERIFIED')
    expect(()=>validatePaperIngress(packet([{...market(),availableAt:'2026-10-16T00:00:00Z'}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_EVENT_CLOCK_INVALID')
    expect(()=>validatePaperIngress(packet([{...market(),mint:'not_a_mint'}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_MINT_INVALID')
    expect(()=>validatePaperIngress(packet([{...market(),priceUsd:NaN}]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_MARKET_EVIDENCE_UNVERIFIED')
  })
  it('refuses stale cycles, duplicate digests and oversized batches',()=>{
    expect(()=>validatePaperIngress(packet(),new Date('2026-10-15T05:00:00Z')))
      .toThrow('SHARK_PAPER_INGRESS_STALE_OR_FUTURE_CYCLE')
    expect(()=>validatePaperIngress(packet([market(),market()]),stamp))
      .toThrow('SHARK_PAPER_INGRESS_DUPLICATE_OR_SELF_REFERENTIAL_RECEIPT')
    expect(()=>validatePaperIngress(packet(Array.from({length:25},(_,i)=>({...market(),digest:i.toString(16).padStart(64,'0')}))),stamp))
      .toThrow('SHARK_PAPER_INGRESS_EVENT_BATCH_INVALID')
  })
  it('persists new receipt without authorizing trade',async()=>{
    const rows=validatePaperIngress(packet([market()]),stamp)
    const received:any[]=[]
    const client:any={
      from:vi.fn((_name:string)=>({
        insert:(row:any)=>{received.push(row);return{select:()=>({
          maybeSingle:async()=>({data:{receipt_digest:row.receipt_digest},error:null})
        })}}
      })),
    }
    const res=await persistPaperIngress(client,rows)
    expect(res).toEqual({inserted:1,replayed:0,accepted:1,
      authority:'RESEARCH_ONLY',canTrade:false,canonicalActorGraphValidated:false,moneyIngressCreated:false})
    expect(received[0].source_event_json.priceUsd).toBe(.0002)
  })
  it('enforces identical replay and rejects divergent duplicate',async()=>{
    const row=validatePaperIngress(packet([market()]),stamp)[0]!
    const from=(old:any)=>({
      insert:()=>({select:()=>({maybeSingle:async()=>({
        data:null,error:{code:'23505',message:'duplicate key'}
      })})}),
      select:()=>({eq:()=>({maybeSingle:async()=>({data:old,error:null})})}),
    })
    const old={...row,event_available_at:'2026-10-15T00:42:00+00:00',
      source_event_json:Object.fromEntries(Object.entries(row.source_event_json).reverse())}
    expect((await persistPaperIngress({from:vi.fn(()=>from(old))} as any,[row])).replayed).toBe(1)
    await expect(persistPaperIngress({from:vi.fn(()=>from({...old,mint:pool}))} as any,[row]))
      .rejects.toThrow('SHARK_PAPER_INGRESS_CONFLICT_OR_READ_FAILED')
  })
})
