import test from 'node:test'
import assert from 'node:assert/strict'
import {
 assertCofferConversionInstruction,
 buildCofferTreasurySnapshot,
 classifyCofferConversion,
 createCofferConversionProposal,
 createCofferTreasuryMovementProposal,
 promoteApprovedCofferConversion,
 promoteApprovedCofferTreasuryMovement,
 type CofferAssetBalanceEvidence,
 type CofferConversionInstruction,
 type CofferConversionQuote,
 type CofferTreasuryEndpoint,
} from './coffer-treasury-contracts.js'

const now='2026-10-01T04:30:00.000Z'
const endpoint=(o:Partial<CofferTreasuryEndpoint>={}):CofferTreasuryEndpoint=>Object.freeze({
 endpointId:'coffer:cash',userId:'u1',provider:'money-core',accountRef:'cash:1',scope:'COFFER',kind:'COFFER_CASH',
 supportedAssets:Object.freeze(['USD','USDC','SOL']),verified:true,evidenceIds:Object.freeze(['endpoint:e']),
 authority:'TREASURY_ENDPOINT_EVIDENCE',containsRawCredential:false,...o,
})
const balance=(o:Partial<CofferAssetBalanceEvidence>={}):CofferAssetBalanceEvidence=>Object.freeze({
 balanceId:'balance:1',cofferId:'coffer:1',userId:'u1',custodyId:'coffer:cash',custodyKind:'COFFER_CASH',provider:'money-core',
 assetId:'USD',assetKind:'FIAT',amountAtomic:100000n,decimals:2,reportingCurrency:'USD',reportingValueMinor:100000n,reservedReportingValueMinor:20000n,
 observedAt:now,evidenceIds:Object.freeze(['balance:e']),authority:'TREASURY_BALANCE_EVIDENCE',canMoveMoney:false,...o,
})
const quote=(o:Partial<CofferConversionQuote>={}):CofferConversionQuote=>Object.freeze({
 quoteId:'quote:usd-usdc:1',provider:'conversion-provider',sourceEndpointId:'bank:owner',destinationEndpointId:'coffer:wallet',
 sourceAssetId:'USD',sourceAssetKind:'FIAT',destinationAssetId:'USDC',destinationAssetKind:'STABLECOIN',
 sourceAmountAtomic:10000n,quotedDestinationAmountAtomic:99500000n,minimumDestinationAmountAtomic:99000000n,
 rateNumerator:99500000n,rateDenominator:10000n,providerFeeSourceAtomic:25n,networkFeeSourceAtomic:0n,spreadBps:25,
 quotedAt:'2026-10-01T04:29:00.000Z',expiresAt:'2026-10-01T04:31:00.000Z',evidenceIds:Object.freeze(['quote:e']),
 authority:'TREASURY_CONVERSION_QUOTE_ONLY',canExecute:false,...o,
})

test('COFFER-TREASURY aggregates fiat, stablecoin and crypto without losing native quantities',()=>{
 const snapshot=buildCofferTreasurySnapshot({
  cofferId:'coffer:1',userId:'u1',reportingCurrency:'USD',observedAt:now,
  balances:[
   balance(),
   balance({balanceId:'balance:usdc',custodyId:'wallet:1',custodyKind:'CRYPTO_WALLET',provider:'coffer-signer',assetId:'USDC',assetKind:'STABLECOIN',amountAtomic:50000000n,decimals:6,reportingValueMinor:5000n,reservedReportingValueMinor:1000n,evidenceIds:['usdc:e']}),
   balance({balanceId:'balance:sol',custodyId:'wallet:1',custodyKind:'CRYPTO_WALLET',provider:'coffer-signer',assetId:'SOL',assetKind:'CRYPTO',amountAtomic:2000000000n,decimals:9,reportingValueMinor:30000n,reservedReportingValueMinor:5000n,evidenceIds:['sol:e']}),
  ],
 })
 assert.equal(snapshot.totalReportingValueMinor,135000n)
 assert.equal(snapshot.reservedReportingValueMinor,26000n)
 assert.equal(snapshot.deployableReportingValueMinor,109000n)
 assert.equal(snapshot.assets.find(x=>x.assetId==='SOL')?.amountAtomic,2000000000n)
 assert.equal(snapshot.canMoveMoney,false)
})

test('COFFER-TREASURY deposit withdrawal and transfer remain same-asset governed movements',()=>{
 const bank=endpoint({endpointId:'bank:owner',provider:'bank',accountRef:'bank:1',scope:'OWNER_EXTERNAL',kind:'BANK',supportedAssets:['USD']})
 const cash=endpoint({endpointId:'coffer:usd',supportedAssets:['USD']})
 const deposit=createCofferTreasuryMovementProposal({movementId:'m:deposit',kind:'DEPOSIT',userId:'u1',cofferId:'coffer:1',assetId:'USD',amountAtomic:50000n,source:bank,destination:cash,idempotencyKey:'idem:deposit',requestedAt:now})
 assert.equal(deposit.canExecute,false)
 const approved=promoteApprovedCofferTreasuryMovement({proposal:deposit,authorityId:'authority:1',executionPermitId:'permit:1'})
 assert.equal(approved.canExecute,false)
 assert.equal(approved.executionPermitId,'permit:1')
 assert.throws(()=>createCofferTreasuryMovementProposal({movementId:'bad',kind:'DEPOSIT',userId:'u1',cofferId:'coffer:1',assetId:'USDC',amountAtomic:1n,source:bank,destination:cash,idempotencyKey:'bad',requestedAt:now}),/ASSET_NOT_SUPPORTED/)
})

test('COFFER-CONVERSION is a distinct primitive for fiat FX, fiat-crypto and crypto-crypto',()=>{
 assert.equal(classifyCofferConversion('FIAT','FIAT'),'FIAT_FX')
 assert.equal(classifyCofferConversion('FIAT','STABLECOIN'),'FIAT_TO_CRYPTO')
 assert.equal(classifyCofferConversion('CRYPTO','FIAT'),'CRYPTO_TO_FIAT')
 assert.equal(classifyCofferConversion('STABLECOIN','CRYPTO'),'CRYPTO_TO_CRYPTO')
})

test('COFFER-CONVERSION binds quote economics and verified owner endpoints before approval',()=>{
 const bank=endpoint({endpointId:'bank:owner',provider:'bank',accountRef:'bank:1',scope:'OWNER_EXTERNAL',kind:'BANK',supportedAssets:['USD']})
 const wallet=endpoint({endpointId:'coffer:wallet',provider:'coffer-signer',accountRef:'wallet:1',scope:'COFFER',kind:'CRYPTO_WALLET',supportedAssets:['USDC','SOL']})
 const q=quote()
 const proposal=createCofferConversionProposal({quote:q,userId:'u1',cofferId:'coffer:1',source:bank,destination:wallet,idempotencyKey:'convert:1',requestedAt:now,now})
 assert.equal(proposal.conversionClass,'FIAT_TO_CRYPTO')
 assert.equal(proposal.canExecute,false)
 assert.throws(()=>promoteApprovedCofferConversion({proposal,authorityId:'',executionPermitId:''}),/AUTHORITY_REQUIRED/)
 const request=promoteApprovedCofferConversion({proposal,authorityId:'authority:convert',executionPermitId:'permit:convert'})
 assert.equal(request.canExecute,false)
 const instruction:CofferConversionInstruction=Object.freeze({
  instructionId:'instruction:1',conversionId:request.conversionId,quoteId:request.quoteId,provider:request.provider,
  sourceEndpointId:request.sourceEndpointId,destinationEndpointId:request.destinationEndpointId,sourceAssetId:request.sourceAssetId,destinationAssetId:request.destinationAssetId,
  sourceAmountAtomic:request.sourceAmountAtomic,minimumDestinationAmountAtomic:request.minimumDestinationAmountAtomic,idempotencyKey:request.idempotencyKey,
  approvalRequired:true,reconciliationRequired:true,authority:'TREASURY_CONVERSION_INSTRUCTION_ONLY',canExecute:false,
 })
 assert.doesNotThrow(()=>assertCofferConversionInstruction({request,quote:q,instruction,now}))
})

test('COFFER-CONVERSION fails closed on expired quotes and weakened output',()=>{
 const bank=endpoint({endpointId:'bank:owner',provider:'bank',accountRef:'bank:1',scope:'OWNER_EXTERNAL',kind:'BANK',supportedAssets:['USD']})
 const wallet=endpoint({endpointId:'coffer:wallet',provider:'coffer-signer',accountRef:'wallet:1',scope:'COFFER',kind:'CRYPTO_WALLET',supportedAssets:['USDC']})
 assert.throws(()=>createCofferConversionProposal({quote:quote({expiresAt:'2026-10-01T04:29:30.000Z'}),userId:'u1',cofferId:'coffer:1',source:bank,destination:wallet,idempotencyKey:'expired',requestedAt:now,now}),/QUOTE_EXPIRED/)
 assert.throws(()=>createCofferConversionProposal({quote:quote({minimumDestinationAmountAtomic:99600000n}),userId:'u1',cofferId:'coffer:1',source:bank,destination:wallet,idempotencyKey:'weak',requestedAt:now,now}),/MINIMUM_OUTPUT_INVALID/)
})
