import { describe, expect, it } from 'vitest'
import { MeteoraDlmmPositionInstructionDecoder, METEORA_DLMM_PROGRAM_ID } from '../meteora-dlmm-position-decoder'

const addDisc = [31,94,125,90,227,52,61,186]
const removeDisc = [116,244,97,232,103,31,152,58]
const rebalanceDisc = [0,109,117,179,61,91,199,200]

function eventBytes(disc: number[], values: Array<{ kind:'pubkey'|'u64'|'i32', value:number[]|bigint|number }>) {
  const out = [...disc]
  for (const item of values) {
    if (item.kind === 'pubkey') out.push(...(item.value as number[]))
    else if (item.kind === 'i32') { const n = item.value as number; for(let i=0;i<4;i++) out.push((n >>> (i*8)) & 255) }
    else { let n=item.value as bigint; for(let i=0;i<8;i++){out.push(Number(n&255n));n>>=8n} }
  }
  return Buffer.from(Uint8Array.from(out)).toString('base64')
}

const pk = (n:number) => Array.from({length:32},(_,i)=>(n+i)&255)
const tx = (data:string) => ({ signature:'sig-1', observedAt:'2026-09-03T12:00:00.000Z', accountAddress:'pool', raw:{ meta:{ logMessages:[`Program ${METEORA_DLMM_PROGRAM_ID} invoke [1]`,`Program data: ${data}`] } }, evidenceId:'evidence-1' })

describe('MeteoraDlmmPositionInstructionDecoder', () => {
  it('decodes authoritative AddLiquidity event amounts and active bin', () => {
    const data=eventBytes(addDisc,[{kind:'pubkey',value:pk(1)},{kind:'pubkey',value:pk(2)},{kind:'pubkey',value:pk(3)},{kind:'u64',value:25n},{kind:'u64',value:75n},{kind:'i32',value:123}])
    const [event]=new MeteoraDlmmPositionInstructionDecoder({poolAddress:base58(pk(1)),tokenMint:'MEME'}).decode(tx(data))
    expect(event?.action).toBe('ADD')
    expect(event?.tokenXDeltas).toBe(25n)
    expect(event?.tokenYDeltas).toBe(75n)
    expect(event?.activeBinId).toBe(123)
  })

  it('decodes RemoveLiquidity as a withdrawal and preserves one-sided semantics', () => {
    const data=eventBytes(removeDisc,[{kind:'pubkey',value:pk(1)},{kind:'pubkey',value:pk(2)},{kind:'pubkey',value:pk(3)},{kind:'u64',value:100n},{kind:'u64',value:0n},{kind:'i32',value:456}])
    const [event]=new MeteoraDlmmPositionInstructionDecoder({poolAddress:base58(pk(1)),tokenMint:'MEME'}).decode(tx(data))
    expect(event?.action).toBe('REMOVE')
    expect(event?.tokenXDeltas).toBe(100n)
    expect(event?.tokenYDeltas).toBe(0n)
    expect(event?.oneSided).toBe(true)
  })

  it('recognizes the current Rebalancing event discriminator', () => {
    const data=eventBytes(rebalanceDisc,[{kind:'pubkey',value:pk(1)},{kind:'pubkey',value:pk(2)},{kind:'pubkey',value:pk(3)},{kind:'i32',value:9},{kind:'u64',value:1n},{kind:'u64',value:2n},{kind:'u64',value:3n},{kind:'u64',value:4n},{kind:'u64',value:0n},{kind:'u64',value:0n},{kind:'i32',value:1},{kind:'i32',value:2},{kind:'i32',value:3},{kind:'i32',value:4},{kind:'u64',value:0n},{kind:'u64',value:0n}])
    const events=new MeteoraDlmmPositionInstructionDecoder({poolAddress:base58(pk(1)),tokenMint:'MEME'}).decode(tx(data))
    expect(events.some(event=>event.action==='REBALANCE'&&event.activeBinId===9&&event.fromBinId===3&&event.toBinId===4)).toBe(true)
  })
})

function base58(bytes:number[]) {
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n=0n
  for(const b of bytes)n=(n<<8n)+BigInt(b)
  let s='';while(n){s=alphabet[Number(n%58n)]+s;n/=58n};let z=0;while(z<bytes.length&&bytes[z]===0){s='1'+s;z++};return s||'1'
}
