export type SignerLeaseState='ACTIVE'|'LOCKED'|'EXPIRED'|'REVOKED'

export type SignerLeasePolicy=Readonly<{
 walletConnectionId:string
 agentId:string
 sessionId:string
 perTransactionCapMinor:bigint
 rolling24hCapMinor:bigint
 maxTransactionCount:number
 allowedDestinationAddresses:readonly string[]
 allowedAssets:readonly string[]
 authority:'OWNER_SIGNER_POLICY'
}>

export type SignerLease=Readonly<{
 leaseId:string
 walletConnectionId:string
 agentId:string
 sessionId:string
 tokenFingerprint:string
 issuedAt:string
 expiresAt:string
 state:SignerLeaseState
 authority:'LEASE_METADATA_ONLY'
 containsPrivateKey:false
 containsRawToken:false
}>

export type SignerRollingObservation=Readonly<{
 leaseId:string
 spent24hMinor:bigint
 transactionCount24h:number
 observedAt:string
 evidenceIds:readonly string[]
 authority:'SIGNER_EVIDENCE'
}>

export type SignerTransferIntent=Readonly<{
 amountMinor:bigint
 assetId:string
 destinationAddress:string
 now:string
}>

export function assertSignerLeaseMayPrepare(input:{
 policy:SignerLeasePolicy
 lease:SignerLease
 observation:SignerRollingObservation
 intent:SignerTransferIntent
}){
 const {policy:p,lease:l,observation:o,intent:i}=input
 if(p.authority!=='OWNER_SIGNER_POLICY'||l.authority!=='LEASE_METADATA_ONLY'||o.authority!=='SIGNER_EVIDENCE')throw new Error('MONEY_COMMISSION1_SIGNER_AUTHORITY_INVALID')
 if(l.containsPrivateKey||l.containsRawToken)throw new Error('MONEY_COMMISSION1_SIGNER_SECRET_EXPOSURE_FORBIDDEN')
 if(!l.tokenFingerprint||!o.evidenceIds.length)throw new Error('MONEY_COMMISSION1_SIGNER_EVIDENCE_REQUIRED')
 if(l.state!=='ACTIVE')throw new Error('MONEY_COMMISSION1_SIGNER_LEASE_NOT_ACTIVE')
 if(i.now<l.issuedAt||i.now>=l.expiresAt)throw new Error('MONEY_COMMISSION1_SIGNER_LEASE_EXPIRED')
 if(l.walletConnectionId!==p.walletConnectionId||l.agentId!==p.agentId||l.sessionId!==p.sessionId||o.leaseId!==l.leaseId)throw new Error('MONEY_COMMISSION1_SIGNER_BINDING_MISMATCH')
 if(i.amountMinor<=0n||i.amountMinor>p.perTransactionCapMinor)throw new Error('MONEY_COMMISSION1_SIGNER_PER_TX_CAP')
 if(o.spent24hMinor<0n||o.transactionCount24h<0)throw new Error('MONEY_COMMISSION1_SIGNER_OBSERVATION_INVALID')
 if(o.spent24hMinor+i.amountMinor>p.rolling24hCapMinor)throw new Error('MONEY_COMMISSION1_SIGNER_ROLLING_CAP')
 if(o.transactionCount24h+1>p.maxTransactionCount)throw new Error('MONEY_COMMISSION1_SIGNER_TX_COUNT_CAP')
 if(!p.allowedDestinationAddresses.includes(i.destinationAddress))throw new Error('MONEY_COMMISSION1_SIGNER_DESTINATION_BLOCKED')
 if(!p.allowedAssets.includes(i.assetId))throw new Error('MONEY_COMMISSION1_SIGNER_ASSET_BLOCKED')
}
