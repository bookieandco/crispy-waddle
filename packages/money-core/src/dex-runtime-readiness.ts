import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { MoneyMarketConnectorDescriptor } from './market-connector-contracts.js'
import type { SignerLease } from './signer-lease-contracts.js'
import type { StrategyBudgetSnapshot } from './strategy-budget-contracts.js'

export const DEX_RUNTIME_READINESS_CHECKS=[
 'COFFER_WALLET',
 'SIGNER_LEASE',
 'MEME_BUDGET',
 'DEX_CONNECTOR',
 'JUPITER_CREDENTIAL',
 'SIGNER_ENDPOINT',
 'SIGNER_AUTH',
 'SOLANA_RPC',
 'SETTLEMENT_MINT',
 'CANARY_FUNDING_EVIDENCE',
 'SOL_FEE_RESERVE_EVIDENCE',
] as const
export type DexRuntimeReadinessCheckId=typeof DEX_RUNTIME_READINESS_CHECKS[number]

export type DexRuntimeReadinessCheck=Readonly<{
 id:DexRuntimeReadinessCheckId
 ready:boolean
 code:string
 detail:string
 sensitive:false
}>

export type DexRuntimeReadinessInput=Readonly<{
 now:string
 cofferWallet?:ConnectedWallet
 signerLease?:SignerLease
 memeBudget?:StrategyBudgetSnapshot
 connector?:MoneyMarketConnectorDescriptor
 jupiterCredentialConfigured:boolean
 signerEndpointConfigured:boolean
 signerAuthorizationConfigured:boolean
 solanaRpcConfigured:boolean
 settlementMintConfigured:boolean
 canaryFundingEvidenceIds:readonly string[]
 solFeeReserveEvidenceIds:readonly string[]
}>

export type DexRuntimeReadinessReport=Readonly<{
 ready:boolean
 status:'READY_FOR_CONTROLLED_CANARY'|'BLOCKED'
 blockerCodes:readonly string[]
 checks:readonly DexRuntimeReadinessCheck[]
 canExposeSecrets:false
 authority:'READINESS_ONLY'
}>

function check(id:DexRuntimeReadinessCheckId,ready:boolean,code:string,detail:string):DexRuntimeReadinessCheck{
 return Object.freeze({id,ready,code,detail,sensitive:false as const})
}

export function evaluateDexRuntimeReadiness(input:DexRuntimeReadinessInput):DexRuntimeReadinessReport{
 if(Number.isNaN(Date.parse(input.now)))throw new Error('DEX_READINESS_NOW_INVALID')
 const walletReady=Boolean(
  input.cofferWallet&&
  input.cofferWallet.mode==='COFFER_EXECUTION_WALLET'&&
  input.cofferWallet.network==='SOLANA'&&
  input.cofferWallet.canSign===false&&
  input.cofferWallet.authority==='CONNECTION_ONLY'&&
  input.cofferWallet.evidenceIds.length,
 )
 const leaseReady=Boolean(
  walletReady&&
  input.signerLease&&
  input.signerLease.walletConnectionId===input.cofferWallet!.connectionId&&
  input.signerLease.state==='ACTIVE'&&
  input.signerLease.authority==='LEASE_METADATA_ONLY'&&
  input.signerLease.containsPrivateKey===false&&
  input.signerLease.containsRawToken===false&&
  input.signerLease.issuedAt<=input.now&&
  input.now<input.signerLease.expiresAt,
 )
 const budgetReady=Boolean(
  input.memeBudget&&
  input.memeBudget.lane==='MEME'&&
  input.memeBudget.state==='ACTIVE'&&
  input.memeBudget.authority==='BUDGET_EVIDENCE'&&
  input.memeBudget.evidenceIds.length&&
  input.memeBudget.allocatedMinor>0n&&
  input.memeBudget.hardCapMinor>0n&&
  input.memeBudget.spentMinor+input.memeBudget.reservedMinor<input.memeBudget.hardCapMinor,
 )
 const connectorReady=Boolean(
  input.connector&&
  input.connector.lane==='DEX'&&
  (input.connector.provider==='jupiter-ultra'||input.connector.provider==='solana-dex-router')&&
  input.connector.admission==='CONTROLLED_CANARY'&&
  input.connector.executionCapabilities.includes('swap')&&
  input.connector.credentialRef?.trim()&&
  input.connector.evidenceIds.length,
 )
 const checks=Object.freeze([
  check('COFFER_WALLET',walletReady,'DEX_READINESS_COFFER_WALLET_REQUIRED',walletReady?'Isolated Solana Coffer wallet is bound.':'Create and persist an active COFFER_EXECUTION_WALLET on Solana.'),
  check('SIGNER_LEASE',leaseReady,'DEX_READINESS_SIGNER_LEASE_REQUIRED',leaseReady?'Active secret-free signer lease is bound.':'Issue an unexpired signer lease bound to the Coffer wallet.'),
  check('MEME_BUDGET',budgetReady,'DEX_READINESS_MEME_BUDGET_REQUIRED',budgetReady?'MEME strategy budget has bounded deployable capacity.':'Commission a non-zero ACTIVE MEME budget with remaining hard-cap capacity.'),
  check('DEX_CONNECTOR',connectorReady,'DEX_READINESS_CONTROLLED_CANARY_CONNECTOR_REQUIRED',connectorReady?'DEX execution surface is admitted for CONTROLLED_CANARY.':'Admit the universal Solana DEX router (or Jupiter canary adapter) as CONTROLLED_CANARY with a credential reference.'),
  check('JUPITER_CREDENTIAL',input.jupiterCredentialConfigured,'DEX_READINESS_JUPITER_CREDENTIAL_REQUIRED',input.jupiterCredentialConfigured?'Jupiter credential is configured in the server runtime.':'Configure the server-side Jupiter API credential.'),
  check('SIGNER_ENDPOINT',input.signerEndpointConfigured,'DEX_READINESS_SIGNER_ENDPOINT_REQUIRED',input.signerEndpointConfigured?'Remote signer HTTPS endpoint is configured.':'Configure the isolated Coffer signer HTTPS endpoint.'),
  check('SIGNER_AUTH',input.signerAuthorizationConfigured,'DEX_READINESS_SIGNER_AUTH_REQUIRED',input.signerAuthorizationConfigured?'Remote signer authorization is configured.':'Configure opaque signer-service authorization.'),
  check('SOLANA_RPC',input.solanaRpcConfigured,'DEX_READINESS_SOLANA_RPC_REQUIRED',input.solanaRpcConfigured?'Solana RPC endpoint is configured.':'Configure the server-side HTTPS Solana RPC endpoint.'),
  check('SETTLEMENT_MINT',input.settlementMintConfigured,'DEX_READINESS_SETTLEMENT_MINT_REQUIRED',input.settlementMintConfigured?'Settlement mint is configured.':'Configure the canonical settlement mint used by the controlled canary.'),
  check('CANARY_FUNDING_EVIDENCE',input.canaryFundingEvidenceIds.length>0,'DEX_READINESS_CANARY_FUNDING_EVIDENCE_REQUIRED',input.canaryFundingEvidenceIds.length>0?'Canary settlement funding evidence exists.':'Verify the tiny-canary settlement-asset balance before any live DEX submission.'),
  check('SOL_FEE_RESERVE_EVIDENCE',input.solFeeReserveEvidenceIds.length>0,'DEX_READINESS_SOL_FEE_RESERVE_EVIDENCE_REQUIRED',input.solFeeReserveEvidenceIds.length>0?'SOL fee-reserve evidence exists.':'Verify a dedicated SOL network-fee reserve before any live DEX submission.'),
 ])
 const blockerCodes=Object.freeze(checks.filter(x=>!x.ready).map(x=>x.code))
 return Object.freeze({
  ready:blockerCodes.length===0,
  status:blockerCodes.length===0?'READY_FOR_CONTROLLED_CANARY' as const:'BLOCKED' as const,
  blockerCodes,
  checks,
  canExposeSecrets:false as const,
  authority:'READINESS_ONLY' as const,
 })
}
