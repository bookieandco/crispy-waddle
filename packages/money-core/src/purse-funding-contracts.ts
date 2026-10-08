import {createHash} from 'node:crypto'
import {assertMoneyMovementProposal, type FundingDestination, type MoneyMovementProposal} from './funding-rail-contracts.js'
import {createCofferTreasuryMovementProposal, type CofferTreasuryEndpoint, type CofferTreasuryMovementProposal} from './coffer-treasury-contracts.js'

/** Purse never adds a payment rail, signs wallet transactions or directly debits a linked bank. */
export type PurseFundingPreparation=Readonly<{
  rail:'MONEY_FUND_USD'|'COFFER_TREASURY_SOLANA'
  authority:'FUNDING_PREPARATION_ONLY'
  canExecute:false
  canMoveMoney:false
  requiresOwnerApproval:true
  requiresProviderCommissioning:true
  proposal:MoneyMovementProposal|CofferTreasuryMovementProposal
}>

const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
const validTime=(value:string)=>Boolean(value)&&!Number.isNaN(Date.parse(value))
const requireId=(value:string)=>{if(!value?.trim())throw new Error('PURSE_FUNDING_IDENTIFIER_REQUIRED')}

/** Money-FUND is the one authoritative bank<->Coffer USD rail. Plaid read-only Link is not ACH authority. */
export function preparePurseUsdFunding(input:{
  userId:string
  cofferId:string
  kind:'DEPOSIT'|'WITHDRAWAL'
  amountMinor:bigint
  ownerBank:FundingDestination
  cofferCash:FundingDestination
  requestedAt:string
  requestId:string
}):PurseFundingPreparation{
  const {userId,cofferId,kind,amountMinor,ownerBank,cofferCash,requestedAt,requestId}=input
  requireId(userId);requireId(cofferId);requireId(requestId)
  if(!validTime(requestedAt)||amountMinor<=0n)throw new Error('PURSE_USD_FUNDING_AMOUNT_OR_TIME_INVALID')
  if(ownerBank.ownerUserId!==userId||cofferCash.ownerUserId!==userId||!ownerBank.verified||!cofferCash.verified)throw new Error('PURSE_USD_FUNDING_OWNER_UNVERIFIED')
  if(ownerBank.kind!=='BANK'||cofferCash.kind!=='BROKER_CASH'||cofferCash.accountId!==cofferId||cofferCash.destinationId!=='coffer:'+cofferId)throw new Error('PURSE_USD_FUNDING_ENDPOINT_INVALID')
  if(ownerBank.currency!=='USD'||cofferCash.currency!=='USD')throw new Error('PURSE_USD_FUNDING_CURRENCY_INVALID')
  if(!ownerBank.evidenceIds.length||!cofferCash.evidenceIds.length)throw new Error('PURSE_USD_FUNDING_EVIDENCE_REQUIRED')
  const source=kind==='DEPOSIT'?ownerBank:cofferCash
  const destination=kind==='DEPOSIT'?cofferCash:ownerBank
  const idempotencyKey='purse-usd:'+sha({userId,cofferId,kind,amount:amountMinor.toString(),source:source.destinationId,destination:destination.destinationId,requestId})
  const proposal:MoneyMovementProposal=Object.freeze({
    movementId:'purse-movement:'+sha(idempotencyKey),kind,userId,cofferId,amountMinor,currency:'USD',
    sourceId:source.destinationId,destinationId:destination.destinationId,idempotencyKey,requestedAt,
    state:'PENDING_APPROVAL',authority:'PROPOSAL_ONLY',canMoveMoney:false,
  })
  assertMoneyMovementProposal(proposal,{verifiedSource:source,verifiedDestination:destination})
  return Object.freeze({rail:'MONEY_FUND_USD',authority:'FUNDING_PREPARATION_ONLY',canExecute:false,canMoveMoney:false,
    requiresOwnerApproval:true,requiresProviderCommissioning:true,proposal})
}

/** Non-executing owner Phantom -> segregated Coffer Solana or reverse; conversion USD<->USDC is *not* a transfer. */
export function preparePursePhantomFunding(input:{
  userId:string
  cofferId:string
  kind:'DEPOSIT'|'WITHDRAWAL'
  assetId:'SOL'|'USDC'
  amountAtomic:bigint
  ownerPhantom:CofferTreasuryEndpoint
  cofferWallet:CofferTreasuryEndpoint
  requestedAt:string
  requestId:string
  ownershipReceiptId:string
}):PurseFundingPreparation{
  const {userId,cofferId,kind,assetId,amountAtomic,ownerPhantom,cofferWallet,requestedAt,requestId,ownershipReceiptId}=input
  requireId(userId);requireId(cofferId);requireId(requestId);requireId(ownershipReceiptId)
  if(!validTime(requestedAt)||amountAtomic<=0n)throw new Error('PURSE_PHANTOM_FUNDING_AMOUNT_OR_TIME_INVALID')
  if(ownerPhantom.userId!==userId||cofferWallet.userId!==userId||ownerPhantom.scope!=='OWNER_EXTERNAL'||cofferWallet.scope!=='COFFER'||ownerPhantom.kind!=='CRYPTO_WALLET'||cofferWallet.kind!=='CRYPTO_WALLET'||ownerPhantom.provider!=='phantom')throw new Error('PURSE_PHANTOM_FUNDING_ENDPOINT_INVALID')
  // A saved public address or wallet connection alone is not proof of possession.
  if(!ownerPhantom.verified||!ownerPhantom.evidenceIds.includes(ownershipReceiptId))throw new Error('PURSE_PHANTOM_OWNERSHIP_RECEIPT_REQUIRED')
  const source=kind==='DEPOSIT'?ownerPhantom:cofferWallet
  const destination=kind==='DEPOSIT'?cofferWallet:ownerPhantom
  const key='purse-phantom:'+sha({userId,cofferId,kind,assetId,amount:amountAtomic.toString(),source:source.endpointId,destination:destination.endpointId,requestId})
  const proposal=createCofferTreasuryMovementProposal({
    movementId:'purse-crypto:'+sha(key),kind,userId,cofferId,assetId,amountAtomic,source,destination,
    idempotencyKey:key,requestedAt,
  })
  return Object.freeze({rail:'COFFER_TREASURY_SOLANA',authority:'FUNDING_PREPARATION_ONLY',canExecute:false,canMoveMoney:false,
    requiresOwnerApproval:true,requiresProviderCommissioning:true,proposal})
}

export type PurseFundingReadiness=Readonly<{
  bankVisible:boolean
  usdBankMovementReady:boolean
  phantomVisible:boolean
  phantomOwnershipVerified:boolean
  cryptoMovementReady:boolean
  blockers:readonly string[]
  authority:'FUNDING_READINESS_ONLY'
  canExecute:false
}>
/** Visibility is not execution readiness; fail closed until both directions are independently commissioned. */
export function assessPurseFundingReadiness(x:{
  linkedBankVisible:boolean
  fundingRailLiveCertified:boolean
  ownerBankPaymentVerified:boolean
  phantomConnected:boolean
  phantomSignatureVerified:boolean
  cofferCryptoWalletReady:boolean
  cryptoTransferProviderCommissioned:boolean
}):PurseFundingReadiness{
  const blockers:string[]=[]
  if(!x.linkedBankVisible)blockers.push('OWNER_BANK_LINK_REQUIRED')
  if(!x.ownerBankPaymentVerified)blockers.push('OWNER_BANK_PAYMENT_VERIFICATION_REQUIRED')
  if(!x.fundingRailLiveCertified)blockers.push('USD_FUNDING_RAIL_NOT_COMMISSIONED')
  if(!x.phantomConnected)blockers.push('PHANTOM_CONNECTION_REQUIRED')
  if(!x.phantomSignatureVerified)blockers.push('PHANTOM_OWNERSHIP_SIGNATURE_REQUIRED')
  if(!x.cofferCryptoWalletReady)blockers.push('ISOLATED_COFFER_WALLET_REQUIRED')
  if(!x.cryptoTransferProviderCommissioned)blockers.push('SOLANA_TRANSFER_RAIL_NOT_COMMISSIONED')
  return Object.freeze({
    bankVisible:x.linkedBankVisible,usdBankMovementReady:x.linkedBankVisible&&x.ownerBankPaymentVerified&&x.fundingRailLiveCertified,
    phantomVisible:x.phantomConnected,phantomOwnershipVerified:x.phantomSignatureVerified,
    cryptoMovementReady:x.phantomConnected&&x.phantomSignatureVerified&&x.cofferCryptoWalletReady&&x.cryptoTransferProviderCommissioned,
    blockers:Object.freeze(blockers),authority:'FUNDING_READINESS_ONLY',canExecute:false,
  })
}
