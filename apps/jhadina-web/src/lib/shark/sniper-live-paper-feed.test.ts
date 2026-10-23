import {describe,it,expect,vi} from 'vitest'
import {readPublicSniperProfilesOnce,readPublicSniperPairOnce} from './sniper-live-paper-feed'
const mint='2'.repeat(32),pair='3'.repeat(32)
const at='2026-10-22T20:00:00.600Z'
const reply=(value:unknown,status=200)=>({ok:status===200,status,text:async()=>JSON.stringify(value)})
const fetcher=vi.fn(async (_url:string,_init:unknown)=>reply([{chainId:'solana',pairAddress:pair,
 baseToken:{address:mint},dexId:'pumpswap',priceUsd:'0.00002',
 liquidity:{usd:1240},pairCreatedAt:Date.parse('2026-10-22T19:59:00Z')}]))
const deps={fetcher,now:()=>at}
describe('LIVE-PAPER.06 bounded public observation adapter',()=>{
 it('reads exact mint and original pair with no executable or chain-authored claim',async()=>{
  const result=await readPublicSniperPairOnce({mint,originalPairAddress:pair},deps)
  expect(result.status).toBe('READ_ONLY_OBSERVED')
  expect(result.pair?.source).toBe('DEXSCREENER_PUBLIC_PRICE_ONLY')
  expect(result.pair?.chainProof).toBe(false)
  expect(result.pair?.verifiedSellPath).toBe(false)
  expect(result.pair?.executableQuote).toBe(false)
  expect(result.canTrade).toBe(false)
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe('https://api.dexscreener.com/token-pairs/v1/solana/'+mint)
  expect((fetcher.mock.calls.at(-1)?.[1] as {method:string;redirect:string}).method).toBe('GET')
  expect((fetcher.mock.calls.at(-1)?.[1] as {method:string;redirect:string}).redirect).toBe('error')
 })
 it('never substitutes another pool, base token or network',async()=>{
  for(const row of [
   {chainId:'ethereum',pairAddress:pair,baseToken:{address:mint},dexId:'x',priceUsd:'1',liquidity:{usd:10}},
   {chainId:'solana',pairAddress:'4'.repeat(32),baseToken:{address:mint},dexId:'x',priceUsd:'1',liquidity:{usd:10}},
   {chainId:'solana',pairAddress:pair,baseToken:{address:'4'.repeat(32)},dexId:'x',priceUsd:'1',liquidity:{usd:10}},
  ]){
   const r=await readPublicSniperPairOnce({mint,originalPairAddress:pair},{
    ...deps,fetcher:async()=>reply([row]),
   })
   expect(r.status).toBe('NO_MATCH_OR_UNVERIFIED_PAIR')
  }
 })
 it('quarantines liquidity 0, malformed time, overflow and impossible future pool',async()=>{
  for(const row of [
   {chainId:'solana',pairAddress:pair,baseToken:{address:mint},dexId:'x',priceUsd:'1',liquidity:{usd:0}},
   {chainId:'solana',pairAddress:pair,baseToken:{address:mint},dexId:'x',priceUsd:'Infinity',liquidity:{usd:100}},
   {chainId:'solana',pairAddress:pair,baseToken:{address:mint},dexId:'x',priceUsd:'1',liquidity:{usd:10},pairCreatedAt:Date.parse('2026-10-23T00:00:00Z')},
  ]){
   expect((await readPublicSniperPairOnce({mint,originalPairAddress:pair},{
    ...deps,fetcher:async()=>reply([row]),
   })).status).toBe('NO_MATCH_OR_UNVERIFIED_PAIR')
  }
  await expect(readPublicSniperPairOnce({mint:'../evil',originalPairAddress:pair},deps)).rejects.toThrow('ADDRESS_INVALID')
 })
 it('handles provider errors and missing/malformed responses by failing closed',async()=>{
  await expect(readPublicSniperPairOnce({mint,originalPairAddress:pair},{
   ...deps,fetcher:async()=>reply([],429),
  })).rejects.toThrow('HTTP_429')
  await expect(readPublicSniperPairOnce({mint,originalPairAddress:pair},{
   ...deps,fetcher:async()=>reply({fake:'pairs'}),
  })).rejects.toThrow('PAIR_SCHEMA_INVALID')
  await expect(readPublicSniperPairOnce({mint,originalPairAddress:pair},{
   ...deps,fetcher:async()=>({ok:true,status:200,text:async()=>'{'}),
  })).rejects.toThrow('INVALID_JSON')
 })
 it('profiles give prospective receipt timestamps, not asserted mint launch times',async()=>{
  const rows=[{chainId:'solana',tokenAddress:mint},{chainId:'ethereum',tokenAddress:mint},
   {chainId:'solana',tokenAddress:mint},{chainId:'solana',tokenAddress:'bad'}]
  const results=await readPublicSniperProfilesOnce({...deps,fetcher:async()=>reply(rows)})
  expect(results).toHaveLength(1)
  expect(results[0]?.firstSeenAt).toBe(at)
  expect(results[0]?.chainProof).toBe(false)
  expect(results[0]?.mint).toBe(mint)
 })
})
