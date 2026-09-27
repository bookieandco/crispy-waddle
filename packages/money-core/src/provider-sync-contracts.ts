export type ProviderSyncState='ACTIVE'|'LOGIN_REQUIRED'|'SYNC_ERROR'|'DISABLED'

export type ProviderSyncCheckpoint=Readonly<{
 syncId:string
 userId:string
 provider:'plaid'|string
 providerItemId:string
 cursor?:string
 state:ProviderSyncState
 includedAccountIds:readonly string[]
 lastSuccessfulSyncAt?:string
 lastErrorCode?:string
 evidenceIds:readonly string[]
 authority:'SYNC_CHECKPOINT'
}>

export type ProviderSyncPage=Readonly<{
 requestId:string
 previousCursor?:string
 nextCursor:string
 hasMore:boolean
 addedTransactionIds:readonly string[]
 modifiedTransactionIds:readonly string[]
 removedTransactionIds:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'SYNC_EVIDENCE'
}>

export type ProviderSyncResult=Readonly<{
 next:ProviderSyncCheckpoint
 pageApplied:boolean
 authority:'SYNC_RESULT_ONLY'
}>

export function applyProviderSyncPage(input:{checkpoint:ProviderSyncCheckpoint;page:ProviderSyncPage}):ProviderSyncResult{
 const {checkpoint:c,page:p}=input
 if(c.authority!=='SYNC_CHECKPOINT'||p.authority!=='SYNC_EVIDENCE'||!c.evidenceIds.length||!p.evidenceIds.length)throw new Error('MONEY_COMMISSION1_SYNC_EVIDENCE_REQUIRED')
 if(c.state==='DISABLED')throw new Error('MONEY_COMMISSION1_SYNC_DISABLED')
 if(c.cursor!==p.previousCursor)throw new Error('MONEY_COMMISSION1_SYNC_CURSOR_MISMATCH')
 if(!p.nextCursor)throw new Error('MONEY_COMMISSION1_SYNC_NEXT_CURSOR_REQUIRED')
 const next=Object.freeze({
  ...c,
  cursor:p.nextCursor,
  state:'ACTIVE' as const,
  lastSuccessfulSyncAt:p.observedAt,
  lastErrorCode:undefined,
  evidenceIds:Object.freeze([...c.evidenceIds,...p.evidenceIds]),
 })
 return Object.freeze({next,pageApplied:true as const,authority:'SYNC_RESULT_ONLY' as const})
}

export function markProviderSyncError(checkpoint:ProviderSyncCheckpoint,input:{code:string;observedAt:string;evidenceId:string}):ProviderSyncCheckpoint{
 if(!input.code||!input.evidenceId)throw new Error('MONEY_COMMISSION1_SYNC_ERROR_EVIDENCE_REQUIRED')
 const state:ProviderSyncState=input.code==='ITEM_LOGIN_REQUIRED'?'LOGIN_REQUIRED':'SYNC_ERROR'
 return Object.freeze({...checkpoint,state,lastErrorCode:input.code,evidenceIds:Object.freeze([...checkpoint.evidenceIds,input.evidenceId])})
}

export function assertProviderSyncAccountIncluded(checkpoint:ProviderSyncCheckpoint,accountId:string){
 if(!checkpoint.includedAccountIds.includes(accountId))throw new Error('MONEY_COMMISSION1_SYNC_ACCOUNT_FILTERED')
}
