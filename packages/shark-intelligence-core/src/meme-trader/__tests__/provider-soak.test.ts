import {describe,expect,it,vi} from 'vitest'
import {runSharkProviderSoak,SHARK_PROVIDER_PROGRAMS} from '../provider-soak'

function response(body:unknown,status=200):Response{
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
}

describe('SHARK provider soak',()=>{
  it('certifies only when every required read-only provider check is ready',async()=>{
    const fetchImpl=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input)
      if(url.includes('dexscreener'))return response([{pairAddress:'pair'}])
      if(url.includes('coingecko'))return response({data:{attributes:{ohlcv_list:[[1,1,1,1,1,1]]}}})
      const rpc=JSON.parse(String(init?.body??'{}'))
      if(rpc.method==='getHealth')return response({jsonrpc:'2.0',id:rpc.id,result:'ok'})
      if(rpc.method==='getMultipleAccounts')return response({jsonrpc:'2.0',id:rpc.id,result:{value:Object.values(SHARK_PROVIDER_PROGRAMS).map(()=>({executable:true}))}})
      throw new Error('unexpected request')
    }) as any
    const receipt=await runSharkProviderSoak({
      fetchImpl,solanaRpcUrl:'https://rpc.example',heliusApiKey:'helius-secret',coinGeckoApiKey:'cg-secret',
      now:()=>new Date('2026-09-22T14:00:00Z'),
    })
    expect(receipt.passed).toBe(true)
    expect(receipt.blockers).toEqual([])
    expect(receipt.writesPerformed).toBe(0)
    expect(receipt.financialAuthority).toBe('NONE')
    expect(receipt.walletSigningAuthority).toBe('NONE')
    expect(receipt.checks.every(x=>x.authority==='READ_ONLY')).toBe(true)
  })

  it('fails closed and names missing provider configuration without exposing secrets',async()=>{
    const fetchImpl=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
      if(String(input).includes('dexscreener'))return response([])
      const rpc=JSON.parse(String(init?.body??'{}'))
      if(rpc.method==='getMultipleAccounts')return response({jsonrpc:'2.0',id:rpc.id,result:{value:Object.values(SHARK_PROVIDER_PROGRAMS).map(()=>({executable:true}))}})
      throw new Error('unexpected request')
    }) as any
    const receipt=await runSharkProviderSoak({fetchImpl,solanaRpcUrl:'https://rpc.example'})
    expect(receipt.passed).toBe(false)
    expect(receipt.blockers).toContain('helius:unconfigured')
    expect(receipt.blockers).toContain('coingecko:unconfigured')
    expect(JSON.stringify(receipt)).not.toContain('rpc.example')
  })

  it('fails a venue when its on-chain program account is missing or non-executable',async()=>{
    const fetchImpl=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input)
      if(url.includes('dexscreener'))return response([])
      if(url.includes('coingecko'))return response({data:{attributes:{ohlcv_list:[]}}})
      const rpc=JSON.parse(String(init?.body??'{}'))
      if(rpc.method==='getHealth')return response({jsonrpc:'2.0',id:rpc.id,result:'ok'})
      if(rpc.method==='getMultipleAccounts')return response({jsonrpc:'2.0',id:rpc.id,result:{value:[
        {executable:true},{executable:true},{executable:false},{executable:true},
      ]}})
      throw new Error('unexpected request')
    }) as any
    const receipt=await runSharkProviderSoak({fetchImpl,solanaRpcUrl:'https://rpc.example',heliusApiKey:'h',coinGeckoApiKey:'c'})
    expect(receipt.passed).toBe(false)
    expect(receipt.blockers).toContain('raydium:failed')
    expect(receipt.checks.find(x=>x.provider==='raydium')?.detail).toBe('program_account_missing_or_nonexecuting')
  })
})
