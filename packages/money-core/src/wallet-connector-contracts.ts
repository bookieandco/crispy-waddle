export type WalletNetwork='SOLANA'|'ETHEREUM'|'BASE'|'OTHER_EVM'
export type WalletConnectorMode='OWNER_WALLET'|'COFFER_EXECUTION_WALLET'

export type ConnectedWallet=Readonly<{
 connectionId:string
 userId:string
 provider:'phantom'|string
 network:WalletNetwork
 address:string
 mode:WalletConnectorMode
 connectedAt:string
 evidenceIds:readonly string[]
 authority:'CONNECTION_ONLY'
 canSign:false
}>

export type WalletTransferRequest=Readonly<{
 transferId:string
 userId:string
 connectionId:string
 network:WalletNetwork
 assetId:string
 amountAtomic:string
 destinationAddress:string
 authorityId:string
 executionPermitId:string
 standingMandateId?:string
 idempotencyKey:string
 requestedAt:string
}>

export type WalletTransferInstruction=Readonly<{
 transferId:string
 provider:string
 network:WalletNetwork
 assetId:string
 amountAtomic:string
 destinationAddress:string
 approvalRequired:true
 reconciliationRequired:true
 authority:'WALLET_INSTRUCTION_ONLY'
 canSign:false
}>

export interface OwnerWalletConnector{
 readonly provider:string
 connect(userId:string,network:WalletNetwork):Promise<ConnectedWallet>
 disconnect(connectionId:string):Promise<void>
}

export interface CofferWalletInstructionAdapter{
 readonly provider:string
 readonly mode:'COFFER_EXECUTION_WALLET'
 readonly supportedNetworks:readonly WalletNetwork[]
 prepareTransfer(request:WalletTransferRequest):Promise<WalletTransferInstruction>
}

export function assertWalletTransferRequest(r:WalletTransferRequest,input:{connection:ConnectedWallet;allowedDestinationAddresses:readonly string[]}){
 if(input.connection.mode!=='COFFER_EXECUTION_WALLET')throw new Error('MONEY_LIVE1_OWNER_WALLET_AUTOMATION_FORBIDDEN')
 if(input.connection.connectionId!==r.connectionId||input.connection.userId!==r.userId||input.connection.network!==r.network)throw new Error('MONEY_LIVE1_WALLET_BINDING_MISMATCH')
 if(!/^\d+$/.test(r.amountAtomic)||BigInt(r.amountAtomic)<=0n)throw new Error('MONEY_LIVE1_WALLET_AMOUNT_INVALID')
 if(!r.authorityId||!r.executionPermitId||!r.idempotencyKey)throw new Error('MONEY_LIVE1_WALLET_AUTHORITY_REQUIRED')
 if(!input.allowedDestinationAddresses.includes(r.destinationAddress))throw new Error('MONEY_LIVE1_WALLET_DESTINATION_NOT_ALLOWLISTED')
 if(!input.connection.evidenceIds.length)throw new Error('MONEY_LIVE1_WALLET_CONNECTION_EVIDENCE_REQUIRED')
}

/**
 * Phantom is admitted as an owner-visible wallet connection and user-approved
 * signing surface. Money Core never imports or stores the user's Phantom seed
 * phrase/private key. Unattended DEX execution, if separately commissioned,
 * must use isolated Coffer custody outside the owner wallet.
 */
export const PHANTOM_OWNER_WALLET_BOUNDARY=Object.freeze({
 provider:'phantom',
 privateKeyCustody:'FORBIDDEN',
 seedPhraseCustody:'FORBIDDEN',
 unattendedServerSigning:false,
 purpose:Object.freeze(['OWNER_WALLET_CONNECT','DEPOSIT_DESTINATION','WITHDRAWAL_DESTINATION','USER_APPROVED_SIGNING']),
 authority:'BOUNDARY_ONLY' as const,
})
