import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMoneyDexGate,assertMoneyDexGatePassed,type MoneyDexGatePolicy,type MoneyDexGateContext } from './money-dex-gate.js'
import type { DexManagedOrder,DexSwapIntent } from './solana-dex-runtime-contracts.js'

const now='2026-09-27T19:00:05.000Z'
const intent=(overrides:Partial<DexSwapIntent>={}):DexSwapIntent=>({
 executionId:'exec-1',tradeId:'trade-1',requestId:'req-1',runLineageId:'run-1',userId:'u',strategyId:'meme',instrumentId:'solana:TOKEN',leg:'ENTRY',provider:'solana-dex-router',routePreference:'AUTO',requestedSlippageBps:50,
 walletConnectionId:'wallet',signerLeaseId:'lease',inputMint:'SOL',outputMint:'TOKEN',inputAmountAtomic:1000n,minimumOutputAtomic:990n,notionalMinor:100n,currency:'USD',idempotencyKey:'idem',
 informationCutoff:'2026-09-27T19:00:00.000Z',evidenceIds:['intent-e'],preExecution:{} as DexSwapIntent['preExecution'],approval:{} as DexSwapIntent['approval'],authority:'MONEY_EXECUTION_INTENT',...overrides,
})
const order=(overrides:Partial<DexManagedOrder>={}):DexManagedOrder=>({
 provider:'jupiter-ultra',requestId:'quote-1',inputMint:'SOL',outputMint:'TOKEN',inputAmountAtomic:1000n,quotedOutputAtomic:1000n,unsignedTransactionBase64:'tx',takerAddress:'wallet-address',
 quoteObservedAt:'2026-09-27T19:00:04.000Z',priceImpactBps:25,evidenceIds:['quote-e'],authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false,...overrides,
})
const policy:MoneyDexGatePolicy={maxQuoteAgeMs:5000,maxSlippageBps:100,maxPriceImpactBps:100,minSolFeeReserveLamports:100n,maxConsecutiveLosses:3}
const context=(overrides:Partial<MoneyDexGateContext>={}):MoneyDexGateContext=>({
 now,walletSolBalanceLamports:10_000n,estimatedFeeLamports:500n,solSpendLamports:1000n,consecutiveLosses:0,
 admission:{inputMint:'SOL',outputMint:'TOKEN',inputTokenAdmitted:true,outputTokenAdmitted:true,contractAdmitted:true,evidenceIds:['admission-e'],authority:'TOKEN_CONTRACT_ADMISSION_ONLY',canAuthorizeTrade:false},
 evidenceIds:['risk-e'],...overrides,
})

describe('MONEY-DEX-GATE.FINAL',()=>{
 it('passes a fresh bounded admitted quote with adequate SOL reserve',()=>{
  const receipt=evaluateMoneyDexGate({intent:intent(),order:order(),policy,context:context()})
  assert.equal(receipt.passed,true)
  assert.deepEqual(receipt.reasonCodes,[])
  assert.doesNotThrow(()=>assertMoneyDexGatePassed(receipt))
 })
 it('fails closed on stale quote, slippage, price impact, fee reserve and loss halt',()=>{
  const receipt=evaluateMoneyDexGate({
   intent:intent({requestedSlippageBps:250,minimumOutputAtomic:900n}),
   order:order({quoteObservedAt:'2026-09-27T18:59:00.000Z',priceImpactBps:400}),
   policy,
   context:context({walletSolBalanceLamports:1200n,estimatedFeeLamports:300n,solSpendLamports:1000n,consecutiveLosses:3}),
  })
  assert.equal(receipt.passed,false)
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_STALE_QUOTE'))
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_SLIPPAGE_CEILING'))
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_PRICE_IMPACT_CEILING'))
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_SOL_FEE_RESERVE'))
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_CONSECUTIVE_LOSS_HALT'))
  assert.throws(()=>assertMoneyDexGatePassed(receipt),/MONEY_DEX_GATE_BLOCKED/)
 })
 it('fails closed when token or contract admission is missing',()=>{
  const receipt=evaluateMoneyDexGate({intent:intent(),order:order(),policy,context:context({admission:{...context().admission,outputTokenAdmitted:false,contractAdmitted:false}})})
  assert.equal(receipt.passed,false)
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_OUTPUT_TOKEN_NOT_ADMITTED'))
  assert.ok(receipt.reasonCodes.includes('MONEY_DEX_GATE_CONTRACT_NOT_ADMITTED'))
 })
})
