import test from 'node:test'
import assert from 'node:assert/strict'
import {corroborateSniperAltPublicRpc} from './sniper-coffer-rpc-evidence.js'
const ALT='AddressLookupTab1e1111111111111111111111111'
const ADDRESS='2'.repeat(32)
const bytes=()=>{
 const b=Buffer.alloc(56+64)
 b.writeUInt32LE(1,0);b.writeBigUInt64LE(0xffffffffffffffffn,4)
 b.writeBigUInt64LE(150n,12);b[20]=0;b[21]=0
 Buffer.alloc(32,11).copy(b,56);Buffer.alloc(32,12).copy(b,88)
 return b
}
const response=(data=bytes(),slot=200,owner=ALT)=>({
 jsonrpc:'2.0',id:1,result:{context:{slot},
 value:{owner,executable:false,space:data.length,lamports:1000,
 data:[data.toString('base64'),'base64']}},
})
const deps=(a:unknown=response(),b:unknown=response())=>{
 const seen:string[]=[]
 return {seen,fetcher:async(url:string,init:{body:string;redirect:string;method:string})=>{
  seen.push(url)
  assert.equal(init.method,'POST');assert.equal(init.redirect,'error')
  const request=JSON.parse(init.body)
  assert.equal(request.method,'getAccountInfo')
  assert.equal(request.params[1].commitment,'finalized')
  assert.equal(request.params[1].minContextSlot,190)
  return {ok:true,status:200,text:async()=>JSON.stringify(seen.length===1?a:b)}
 }}
}
test('two independently called RPC endpoints agree on exact finalized ALT bytes',async()=>{
 const d=deps()
 const r=await corroborateSniperAltPublicRpc({
  address:ADDRESS,minContextSlot:190,now:'2026-10-23T19:00:00Z',
 },d)
 assert.equal(r.status,'TWO_RPC_MATCHED')
 assert.equal(r.contextSlot,200);assert.equal(r.addresses.length,2)
 assert.equal(r.canSign,false);assert.equal(r.canUseAsSignerAttestation,false)
 assert.deepEqual(d.seen,['https://api.mainnet.solana.com','https://solana-rpc.publicnode.com'])
})
test('independent RPC disagreement or wrong owner blocks without supplying addresses',async()=>{
 const changed=bytes();changed[56]=8
 for(const [a,b] of [
  [response(),response(changed)],
  [response(),response(bytes(),201)],
  [response(),response(bytes(),200,'NotTheAddressLookupOwner')],
  [response(),{jsonrpc:'2.0',id:1,result:{context:{slot:200},value:null}}],
 ]){
  const r=await corroborateSniperAltPublicRpc({
   address:ADDRESS,minContextSlot:190,now:'2026-10-23T19:00:00Z',
  },deps(a,b))
  assert.equal(r.status,'RPC_EVIDENCE_BLOCKED')
  assert.equal(r.addresses.length,0)
  assert.equal(r.canUseAsSignerAttestation,false)
 }
})
test('recent extension, deactivation and impossible metadata are blocked',async()=>{
 for(const raw of [()=>{
  const b=bytes();b.writeBigUInt64LE(200n,12);return b
 },()=>{
  const b=bytes();b.writeBigUInt64LE(199n,4);return b
 },()=>{
  const b=bytes();b.writeUInt32LE(2,0);return b
 }]){
  const r=await corroborateSniperAltPublicRpc({
   address:ADDRESS,minContextSlot:190,now:'2026-10-23T19:00:00Z',
  },deps(response(raw()),response(raw())))
  assert.equal(r.status,'RPC_EVIDENCE_BLOCKED')
 }
})
