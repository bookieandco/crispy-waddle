import test from 'node:test'
import assert from 'node:assert/strict'
import {auditSniperUnsignedTransaction,sha256UnsignedTransaction} from './sniper-transaction-byte-audit.js'
import type {DexManagedOrder} from './solana-dex-runtime-contracts.js'
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const b58=(bytes:Buffer):string=>{
 let n=0n
 for(const byte of bytes)n=(n<<8n)|BigInt(byte)
 let out=''
 while(n){out=ALPHABET[Number(n%58n)]+out;n/=58n}
 return '1'.repeat(bytes.findIndex(v=>v!==0)===-1?bytes.length:bytes.findIndex(v=>v!==0))+out
}
const payer=Buffer.alloc(32,7),program=Buffer.alloc(32,9)
const address=b58(payer),programAddress=b58(program)
type Maker={prefix?:number;sig?:number;prefixAfterSig?:boolean;data?:number[];
 lookup?:number;trailer?:number[];program?:Buffer;signed?:boolean;programIndex?:number}
function transaction(opts:Maker={}):string{
 const signatures=opts.sig??1
 const wire=[
  Buffer.from([signatures]),Buffer.alloc(signatures*64,opts.signed?4:0),
  Buffer.from([opts.prefix??0x80]),Buffer.from([1,0,1]),
  Buffer.from([2]),payer,opts.program??program,Buffer.alloc(32,5),
  Buffer.from([1,opts.programIndex??1,1,0,(opts.data??[8]).length,...(opts.data??[8])]),
  Buffer.from([opts.lookup??0]),
 ]
 if(opts.lookup===1){
  wire.push(Buffer.alloc(32,10),Buffer.from([0,0]))
 }
 if(opts.trailer)wire.push(Buffer.from(opts.trailer))
 return Buffer.concat(wire).toString('base64')
}
const mkOrder=(data:string):DexManagedOrder=>({
 provider:'jupiter-ultra',requestId:'order:123',inputMint:'2'.repeat(32),
 outputMint:'3'.repeat(32),inputAmountAtomic:1000n,quotedOutputAtomic:999n,
 unsignedTransactionBase64:data,takerAddress:address,evidenceIds:['order:source:123'],
 authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false,
})
const review=(data=transaction(),opts:Partial<Parameters<typeof auditSniperUnsignedTransaction>[0]>={})=>
 auditSniperUnsignedTransaction({
  order:mkOrder(data),expectedFeePayer:address,
  allowedStaticPrograms:[programAddress],now:'2026-10-23T12:00:00Z',...opts,
 })
test('v0 transaction bytes are structurally parsed and bound to exact unsigned hash',()=>{
 const encoded=transaction()
 const r=review(encoded)
 assert.equal(r.status,'STRUCTURE_OBSERVED',r.reasonCodes.join(','))
 assert.equal(r.format,'V0')
 assert.equal(r.feePayer,address)
 assert.equal(r.signerCount,1)
 assert.equal(r.staticAccounts,2)
 assert.equal(r.instructionCount,1)
 assert.deepEqual(r.programIds,[programAddress])
 assert.equal(r.transactionSha256,sha256UnsignedTransaction(encoded))
 assert.equal(r.semanticAuthorized,false)
 assert.equal(r.altResolved,false)
 assert.equal(r.canSign,false)
 assert.equal(r.canSubmit,false)
})
test('blocks pre-signed provider bytes, unknown programs, wrong payer and extra signatures',()=>{
 for(const [data,code] of [
  [transaction({signed:true}),'PROVIDER_TRANSACTION_ALREADY_SIGNED'],
  [transaction({program:Buffer.alloc(32,11)}),'PROGRAM_NOT_ALLOWLISTED'],
  [transaction({sig:2}),'SIGNER_COUNT_NOT_ISOLATED'],
  [transaction({programIndex:0}),'PROGRAM_INDEX_INVALID'],
 ] as const){
  const r=review(data)
  assert.equal(r.status,'BLOCKED',code)
  assert.ok(r.reasonCodes.includes(code),r.reasonCodes.join(','))
  assert.equal(r.canSign,false)
 }
 assert.ok(review(transaction(),{expectedFeePayer:b58(Buffer.alloc(32,42))})
  .reasonCodes.includes('FEE_PAYER_NOT_ISOLATED'))
})
test('rejects unresolved address lookup tables and unreviewed version prefixes',()=>{
 assert.ok(review(transaction({lookup:1})).reasonCodes.includes('ADDRESS_LOOKUP_TABLE_UNRESOLVED'))
 assert.ok(review(transaction({prefix:0x81})).reasonCodes.includes('TRANSACTION_VERSION_NOT_AUDITED'))
 assert.equal(review(transaction({trailer:[42]})).status,'BLOCKED')
})
test('truncated, noncanonical or tampered unsigned bytes never produce structural approval',()=>{
 const encoded=transaction()
 assert.equal(review(encoded.slice(0,-4)).status,'BLOCKED')
 assert.equal(review('AAAAAAAA').status,'BLOCKED')
 assert.equal(review('invalid!').status,'BLOCKED')
 const bytes=Buffer.from(encoded,'base64')
 bytes[0]=0x81
 bytes[1]=0
 assert.equal(review(bytes.toString('base64')).status,'BLOCKED')
})
test('even passing bytes cannot attest Jupiter semantic effects, CPI or swap output',()=>{
 const r=review()
 assert.equal(r.status,'STRUCTURE_OBSERVED')
 assert.equal(r.semanticAuthorized,false)
 assert.equal(r.authority,'UNSIGNED_TRANSACTION_STRUCTURE_ONLY')
})
