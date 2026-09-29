import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { bindUniversalSolanaDexRuntime,SolanaRpcTokenAccountResolver } from './solana-dex-runtime-factory.js'

describe('universal Solana DEX runtime factory',()=>{
 it('assembles the router without granting signing or trade authority',()=>{
  const runtime=bindUniversalSolanaDexRuntime({
   resolveSolanaRpcEndpoint:()=> 'https://rpc.example',
   resolveJupiterApiKey:()=> 'jupiter-secret',
   raydiumComputeUnitPriceMicroLamports:'1000',
   meteoraBuilderBaseUrl:'https://meteora-builder.example',
   resolveMeteoraBuilderAuthorization:()=> 'Bearer opaque',
   fetchFn:async()=>new Response('{}',{status:500}),
  })
  assert.equal(runtime.router.provider,'solana-dex-router')
  assert.equal(runtime.canSign,false)
  assert.equal(runtime.canAuthorizeTrade,false)
 })
 it('resolves one public token account and fails closed on ambiguous accounts',async()=>{
  const one=new SolanaRpcTokenAccountResolver({
   resolveRpcEndpoint:()=> 'https://rpc.example',
   fetchFn:async()=>new Response(JSON.stringify({jsonrpc:'2.0',result:{value:[{pubkey:'TokenAccount1'}]}}),{status:200}),
  })
  assert.equal(await one.resolve('Wallet111','Mint111'),'TokenAccount1')
  const ambiguous=new SolanaRpcTokenAccountResolver({
   resolveRpcEndpoint:()=> 'https://rpc.example',
   fetchFn:async()=>new Response(JSON.stringify({jsonrpc:'2.0',result:{value:[{pubkey:'A'},{pubkey:'B'}]}}),{status:200}),
  })
  await assert.rejects(()=>ambiguous.resolve('Wallet111','Mint111'),/DEX_TOKEN_ACCOUNT_AMBIGUOUS/)
 })
})
