import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { SignerLease,SignerLeasePolicy } from './signer-lease-contracts.js'
import { RemoteCofferSignerHealthProbe,SolanaCofferBalanceProbe,SolanaCofferTokenBalanceProbe,certifyCofferCommissionFinal,type CofferCommissionEvidence,type CofferCommissionPolicy } from './coffer-commission-final.js'

const now='2026-09-27T20:40:00.000Z'
const wallet:ConnectedWallet={connectionId:'coffer-1',userId:'u1',provider:'remote-coffer-signer',network:'SOLANA',address:'Wallet111',mode:'COFFER_EXECUTION_WALLET',connectedAt:'2026-09-27T20:00:00.000Z',evidenceIds:['wallet:e'],authority:'CONNECTION_ONLY',canSign:false}
const signerPolicy:SignerLeasePolicy={walletConnectionId:wallet.connectionId,agentId:'money',sessionId:'canary',perTransactionCapMinor:1000n,rolling24hCapMinor:2000n,maxTransactionCount:2,allowedDestinationAddresses:[wallet.address],allowedAssets:['SOL','TOKEN'],authority:'OWNER_SIGNER_POLICY'}
const signerLease:SignerLease={leaseId:'lease-1',walletConnectionId:wallet.connectionId,agentId:'money',sessionId:'canary',tokenFingerprint:'sha256:lease',issuedAt:'2026-09-27T20:00:00.000Z',expiresAt:'2026-09-27T22:00:00.000Z',state:'ACTIVE',authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false}
const policy:CofferCommissionPolicy={minFeeReserveLamports:100_000n,settlementAssetId:'USDC_MINT',minSettlementFundingAtomic:500_000n,maxObservationAgeMs:60_000}
const evidence=(evidenceClass:'REAL_LIVE'|'SYNTHETIC_TEST',balanceLamports=700_000n,settlementAtomic=700_000n):CofferCommissionEvidence=>({
 evidenceClass,
 signer:{signerEndpoint:'https://signer.example',signerCredentialRef:'secret://coffer/live',reachable:true,signerAddress:wallet.address,network:'SOLANA',containsPrivateKey:false,containsRawToken:false,observedAt:now,evidenceIds:['signer:e'],authority:'SIGNER_PROBE_ONLY',canSign:false},
 balance:{walletAddress:wallet.address,balanceLamports,observedAt:now,evidenceIds:['balance:e'],authority:'CHAIN_BALANCE_EVIDENCE_ONLY',canMoveFunds:false},
 settlementFunding:{walletAddress:wallet.address,assetId:'USDC_MINT',amountAtomic:settlementAtomic,observedAt:now,evidenceIds:['settlement:e'],authority:'CHAIN_ASSET_BALANCE_EVIDENCE_ONLY',canMoveFunds:false},
 evidenceIds:['commission:e'],
})

describe('COFFER-COMMISSION.FINAL',()=>{
 it('certifies only fresh REAL_LIVE signer and funded-wallet evidence',()=>{
  const report=certifyCofferCommissionFinal({wallet,signerPolicy,signerLease,policy,evidence:evidence('REAL_LIVE'),now})
  assert.equal(report.passed,true)
  assert.equal(report.status,'COFFER_COMMISSIONED')
  assert.equal(report.operationalEvidence,true)
  assert.equal(report.fundingShortfallLamports,0n)
  assert.equal(report.settlementShortfallAtomic,0n)
  assert.equal(report.settlementFundingVerified,true)
  assert.equal(report.canMoveFunds,false)
  assert.equal(report.unrestrictedLiveAuthorized,false)
 })
 it('keeps synthetic software evidence fail-closed',()=>{
  const report=certifyCofferCommissionFinal({wallet,signerPolicy,signerLease,policy,evidence:evidence('SYNTHETIC_TEST'),now})
  assert.equal(report.passed,false)
  assert.equal(report.status,'SOFTWARE_READY_EXTERNAL_COMMISSION_REQUIRED')
  assert.ok(report.blockerCodes.includes('COFFER_REAL_LIVE_EVIDENCE_REQUIRED'))
 })
 it('reports separate SOL fee-reserve and settlement-asset shortfalls without claiming it can move funds',()=>{
  const report=certifyCofferCommissionFinal({wallet,signerPolicy,signerLease,policy,evidence:evidence('REAL_LIVE',50_000n,250_000n),now})
  assert.equal(report.passed,false)
  assert.equal(report.fundingShortfallLamports,50_000n)
  assert.equal(report.settlementShortfallAtomic,250_000n)
  assert.ok(report.blockerCodes.includes('COFFER_SOL_FEE_RESERVE_REQUIRED'))
  assert.ok(report.blockerCodes.includes('COFFER_SETTLEMENT_FUNDING_REQUIRED'))
  assert.equal(report.canMoveFunds,false)
 })
 it('probes remote signer, SOL reserve and settlement token balance without exposing signer secrets',async()=>{
  let signerAuth='',rpcMethods:string[]=[]
  const signerProbe=new RemoteCofferSignerHealthProbe({
   baseUrl:'https://signer.example',signerCredentialRef:'secret://coffer/live',resolveAuthorizationHeader:()=> 'Bearer opaque',
   fetchFn:async(_url,init)=>{signerAuth=(init?.headers as Record<string,string>).authorization;return new Response(JSON.stringify({ok:true,signerAddress:wallet.address,network:'SOLANA',containsPrivateKey:false,containsRawToken:false,evidenceId:'health:e'}),{status:200})},
  })
  const balanceProbe=new SolanaCofferBalanceProbe({
   resolveRpcEndpoint:()=> 'https://rpc.example',
   fetchFn:async(_url,init)=>{const body=JSON.parse(String(init?.body));rpcMethods.push(body.method);return new Response(JSON.stringify({jsonrpc:'2.0',result:{context:{slot:123},value:700000}}),{status:200})},
  })
  const tokenProbe=new SolanaCofferTokenBalanceProbe({
   resolveRpcEndpoint:()=> 'https://rpc.example',
   fetchFn:async(_url,init)=>{const body=JSON.parse(String(init?.body));rpcMethods.push(body.method);return new Response(JSON.stringify({jsonrpc:'2.0',result:{context:{slot:124},value:[{account:{data:{parsed:{info:{tokenAmount:{amount:'700000'}}}}}}]}}),{status:200})},
  })
  const signer=await signerProbe.probe(now)
  const balance=await balanceProbe.probe(wallet.address,now)
  const settlement=await tokenProbe.probe(wallet.address,'USDC_MINT',now)
  assert.equal(signerAuth,'Bearer opaque')
  assert.equal(signer.signerAddress,wallet.address)
  assert.deepEqual(rpcMethods,['getBalance','getTokenAccountsByOwner'])
  assert.equal(balance.balanceLamports,700_000n)
  assert.equal(settlement.amountAtomic,700_000n)
 })
})
