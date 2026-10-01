import test from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey,createPublicKey,verify } from 'node:crypto'
import { IsolatedCofferSignerService,authorizeCofferSignerHttpRequest,createCofferSignerHttpHandler,deriveEd25519PublicKeyBase58 } from './isolated-coffer-signer-service.js'

const prefix=Buffer.from('302e020100300506032b657004220420','hex')
const seed=Buffer.alloc(32,7)
const address=deriveEd25519PublicKeyBase58(seed)

function decodeBase58(value:string):Buffer{
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
 let n=0n
 for(const char of value){const index=alphabet.indexOf(char);if(index<0)throw new Error('bad base58');n=n*58n+BigInt(index)}
 const out:number[]=[]
 while(n>0n){out.push(Number(n&255n));n>>=8n}
 out.reverse()
 let zeros=0
 while(zeros<value.length&&value[zeros]==='1')zeros++
 return Buffer.concat([Buffer.alloc(zeros),Buffer.from(out)])
}

function unsignedV0(singleSignerAddress=address):{base64:string;message:Buffer}{
 const publicKey=decodeBase58(singleSignerAddress)
 assert.equal(publicKey.length,32)
 const message=Buffer.concat([
  Buffer.from([0x80,1,0,0]), // v0 + header: one required signer
  Buffer.from([1]),publicKey,
  Buffer.alloc(32),          // recent blockhash
  Buffer.from([0]),          // zero instructions
  Buffer.from([0]),          // zero address lookup tables
 ])
 const transaction=Buffer.concat([Buffer.from([1]),Buffer.alloc(64),message])
 return {base64:transaction.toString('base64'),message}
}

test('COFFER-COMMISSION.1 isolated signer signs only the bound single-signer transaction and returns no secret material',async()=>{
 const tx=unsignedV0()
 let verifiedHash=''
 const service=new IsolatedCofferSignerService({
  resolveSeedBase64:()=>seed.toString('base64'),
  verifyLease:input=>{verifiedHash=input.unsignedTransactionHash;return {
   allowed:true,reasonCodes:[],evidenceIds:['lease:verified:1'],authority:'SIGNER_LEASE_VERIFICATION_ONLY' as const,
  }},
 })
 const result=await service.signVersionedTransaction({
  walletConnectionId:'wallet:coffer:1',signerLeaseId:'lease:1',unsignedTransactionBase64:tx.base64,
  idempotencyKey:'idem:entry:1',expectedSignerAddress:address,now:'2026-10-01T02:45:00.000Z',
 })
 assert.match(verifiedHash,/^[a-f0-9]{64}$/)
 assert.equal(result.signerAddress,address)
 assert.equal(result.containsPrivateKey,false)
 assert.equal(result.containsRawToken,false)
 assert.equal(result.authority,'ISOLATED_SIGNER_RECEIPT_ONLY')
 assert.doesNotMatch(JSON.stringify(result),/seed|privateKey|mnemonic|rawToken/)
 const signed=Buffer.from(result.signedTransactionBase64,'base64')
 const signature=signed.subarray(1,65)
 assert.ok(signature.some(byte=>byte!==0))
 const privateKey=createPrivateKey({key:Buffer.concat([prefix,seed]),format:'der',type:'pkcs8'})
 const publicKey=createPublicKey(privateKey)
 assert.equal(verify(null,tx.message,publicKey,signature),true)
})

test('COFFER-COMMISSION.1 signer refuses lease veto, wrong key address, and pre-signed input',async()=>{
 const base=new IsolatedCofferSignerService({
  resolveSeedBase64:()=>seed.toString('base64'),
  verifyLease:()=>({allowed:false,reasonCodes:['LEASE_EXPIRED'],evidenceIds:['lease:e'],authority:'SIGNER_LEASE_VERIFICATION_ONLY' as const}),
 })
 await assert.rejects(()=>base.signVersionedTransaction({
  walletConnectionId:'wallet:1',signerLeaseId:'lease:1',unsignedTransactionBase64:unsignedV0().base64,
  idempotencyKey:'idem:1',expectedSignerAddress:address,now:'2026-10-01T02:45:00.000Z',
 }),/COFFER_SIGNER_LEASE_BLOCKED:LEASE_EXPIRED/)

 const service=new IsolatedCofferSignerService({
  resolveSeedBase64:()=>seed.toString('base64'),
  verifyLease:()=>({allowed:true,reasonCodes:[],evidenceIds:['lease:e'],authority:'SIGNER_LEASE_VERIFICATION_ONLY' as const}),
 })
 const wrongSeed=Buffer.alloc(32,8)
 await assert.rejects(()=>service.signVersionedTransaction({
  walletConnectionId:'wallet:1',signerLeaseId:'lease:1',unsignedTransactionBase64:unsignedV0().base64,
  idempotencyKey:'idem:2',expectedSignerAddress:deriveEd25519PublicKeyBase58(wrongSeed),now:'2026-10-01T02:45:00.000Z',
 }),/COFFER_SIGNER_KEY_ADDRESS_MISMATCH/)

 const pre=Buffer.from(unsignedV0().base64,'base64');pre[1]=1
 await assert.rejects(()=>service.signVersionedTransaction({
  walletConnectionId:'wallet:1',signerLeaseId:'lease:1',unsignedTransactionBase64:pre.toString('base64'),
  idempotencyKey:'idem:3',expectedSignerAddress:address,now:'2026-10-01T02:45:00.000Z',
 }),/COFFER_SIGNER_PREEXISTING_SIGNATURE_FORBIDDEN/)
})

test('COFFER-COMMISSION.1 signer HTTP boundary uses constant-time bearer equality',()=>{
 assert.doesNotThrow(()=>authorizeCofferSignerHttpRequest({authorizationHeader:'Bearer opaque-1',expectedAuthorizationHeader:'Bearer opaque-1'}))
 assert.throws(()=>authorizeCofferSignerHttpRequest({authorizationHeader:'Bearer nope',expectedAuthorizationHeader:'Bearer opaque-1'}),/COFFER_SIGNER_HTTP_UNAUTHORIZED/)
 assert.throws(()=>authorizeCofferSignerHttpRequest({authorizationHeader:undefined,expectedAuthorizationHeader:'Bearer opaque-1'}),/COFFER_SIGNER_HTTP_UNAUTHORIZED/)
})


test('COFFER-COMMISSION.1 HTTP handler is authenticated, POST-only, no-store, and secret-free',async()=>{
 const service=new IsolatedCofferSignerService({
  resolveSeedBase64:()=>seed.toString('base64'),
  verifyLease:()=>({allowed:true,reasonCodes:[],evidenceIds:['lease:http:e'],authority:'SIGNER_LEASE_VERIFICATION_ONLY' as const}),
 })
 const handler=createCofferSignerHttpHandler({service,resolveExpectedAuthorizationHeader:()=> 'Bearer signer-secret'})
 const denied=await handler(new Request('https://signer.example/sign',{method:'POST',headers:{authorization:'Bearer wrong','content-type':'application/json'},body:'{}'}))
 assert.equal(denied.status,401)
 assert.equal(denied.headers.get('cache-control'),'no-store')
 const method=await handler(new Request('https://signer.example/sign',{method:'GET',headers:{authorization:'Bearer signer-secret'}}))
 assert.equal(method.status,405)

 const tx=unsignedV0()
 const ok=await handler(new Request('https://signer.example/sign',{
  method:'POST',
  headers:{authorization:'Bearer signer-secret','content-type':'application/json'},
  body:JSON.stringify({walletConnectionId:'wallet:1',signerLeaseId:'lease:1',unsignedTransactionBase64:tx.base64,idempotencyKey:'idem:http',expectedSignerAddress:address,now:'2026-10-01T02:45:00.000Z'}),
 }))
 assert.equal(ok.status,200)
 assert.equal(ok.headers.get('cache-control'),'no-store')
 const payload=await ok.text()
 assert.doesNotMatch(payload,/signer-secret|seed|privateKey|mnemonic|rawToken/)
 assert.match(payload,/ISOLATED_SIGNER_RECEIPT_ONLY/)
})
