import express from 'express'
import DLMM from '@meteora-ag/dlmm'
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import BN from 'bn.js'
import crypto from 'node:crypto'

const RPC_URL=process.env.SOLANA_RPC_URL?.trim()
const AUTH=process.env.MONEY_METEORA_BUILDER_AUTH?.trim()
const PORT=Number(process.env.PORT||8092)
if(!RPC_URL?.startsWith('https://'))throw new Error('SOLANA_RPC_URL_HTTPS_REQUIRED')
if(!AUTH)throw new Error('MONEY_METEORA_BUILDER_AUTH_REQUIRED')
const connection=new Connection(RPC_URL,'confirmed')
const app=express()
app.use(express.json({limit:'64kb'}))

const key=x=>String(x?.toBase58?.()??x?.address?.toBase58?.()??x?.address??x?.publicKey?.toBase58?.()??x?.publicKey??'')
const requestId=value=>'meteora:'+crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

app.get('/health',(_req,res)=>res.json({ok:true,provider:'meteora-dlmm-builder',containsPrivateKey:false,containsRawToken:false}))
app.post('/build',async(req,res)=>{
 try{
  if(req.get('authorization')!==AUTH)return res.status(401).json({success:false,error:'UNAUTHORIZED'})
  const {poolAddress,inputMint,outputMint,inputAmountAtomic,minimumOutputAtomic,slippageBps,takerAddress,executionId}=req.body??{}
  for(const [value,name] of [[poolAddress,'poolAddress'],[inputMint,'inputMint'],[outputMint,'outputMint'],[inputAmountAtomic,'inputAmountAtomic'],[minimumOutputAtomic,'minimumOutputAtomic'],[takerAddress,'takerAddress'],[executionId,'executionId']])if(typeof value!=='string'||!value.trim())throw new Error(name+'_REQUIRED')
  if(!/^\d+$/.test(inputAmountAtomic)||!/^\d+$/.test(minimumOutputAtomic))throw new Error('AMOUNT_INVALID')
  if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>10000)throw new Error('SLIPPAGE_INVALID')
  const pool=await DLMM.create(connection,new PublicKey(poolAddress),{cluster:'mainnet-beta'})
  const x=key(pool.tokenX?.mint??pool.tokenX)
  const y=key(pool.tokenY?.mint??pool.tokenY)
  const swapForY=inputMint===x&&outputMint===y
  const swapForX=inputMint===y&&outputMint===x
  if(!swapForY&&!swapForX)throw new Error('POOL_MINT_BINDING_MISMATCH')
  const amount=new BN(inputAmountAtomic)
  const bins=await pool.getBinArrayForSwap(swapForY,4)
  const quote=pool.swapQuote(amount,swapForY,new BN(slippageBps),bins,false)
  if(!quote.consumedInAmount.eq(amount))throw new Error('PARTIAL_FILL_NOT_ADMITTED')
  if(quote.minOutAmount.lt(new BN(minimumOutputAtomic)))throw new Error('MINIMUM_OUTPUT_UNSATISFIED')
  const inToken=swapForY?new PublicKey(x):new PublicKey(y)
  const outToken=swapForY?new PublicKey(y):new PublicKey(x)
  const tx=await pool.swap({
   inToken,outToken,inAmount:quote.consumedInAmount,minOutAmount:quote.minOutAmount,
   lbPair:pool.pubkey,user:new PublicKey(takerAddress),binArraysPubkey:quote.binArraysPubkey,
  })
  const {blockhash}=await connection.getLatestBlockhash('confirmed')
  const message=new TransactionMessage({payerKey:new PublicKey(takerAddress),recentBlockhash:blockhash,instructions:tx.instructions}).compileToV0Message()
  const versioned=new VersionedTransaction(message)
  const encoded=Buffer.from(versioned.serialize()).toString('base64')
  const id=requestId({executionId,poolAddress,inputMint,outputMint,inputAmountAtomic,minimumOutputAtomic,slippageBps,blockhash})
  const priceImpactPct=Number(quote.priceImpact.toString())
  const priceImpactBps=Math.ceil(priceImpactPct*100)
  if(!Number.isFinite(priceImpactBps)||priceImpactBps<0||priceImpactBps>10000)throw new Error('PRICE_IMPACT_INVALID')
  res.json({success:true,data:{
   requestId:id,
   quotedOutputAtomic:quote.outAmount.toString(),
   unsignedTransactionBase64:encoded,
   quoteObservedAt:new Date().toISOString(),
   priceImpactBps,
   evidenceIds:[id,'meteora:pool:'+poolAddress,'meteora:min-out:'+quote.minOutAmount.toString()],
  }})
 }catch(error){
  res.status(400).json({success:false,error:error instanceof Error?error.message:'BUILD_FAILED'})
 }
})
app.listen(PORT,'0.0.0.0',()=>{})
