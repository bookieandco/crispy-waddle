import { createHash } from 'node:crypto'

export type CofferTreasuryAssetKind='FIAT'|'STABLECOIN'|'CRYPTO'
export type CofferTreasuryCustodyKind='BANK'|'BROKER_CASH'|'COFFER_CASH'|'CRYPTO_WALLET'|'EXCHANGE'
export type CofferTreasuryEndpointScope='COFFER'|'OWNER_EXTERNAL'
export type CofferTreasuryMovementKind='DEPOSIT'|'WITHDRAWAL'|'TRANSFER'
export type CofferConversionClass='FIAT_FX'|'FIAT_TO_CRYPTO'|'CRYPTO_TO_FIAT'|'CRYPTO_TO_CRYPTO'

export type CofferTreasuryEndpoint=Readonly<{
 endpointId:string
 userId:string
 provider:string
 accountRef:string
 scope:CofferTreasuryEndpointScope
 kind:CofferTreasuryCustodyKind
 supportedAssets:readonly string[]
 verified:boolean
 evidenceIds:readonly string[]
 authority:'TREASURY_ENDPOINT_EVIDENCE'
 containsRawCredential:false
}>

export type CofferAssetBalanceEvidence=Readonly<{
 balanceId:string
 cofferId:string
 userId:string
 custodyId:string
 custodyKind:CofferTreasuryCustodyKind
 provider:string
 assetId:string
 assetKind:CofferTreasuryAssetKind
 amountAtomic:bigint
 decimals:number
 reportingCurrency:string
 reportingValueMinor:bigint
 reservedReportingValueMinor:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'TREASURY_BALANCE_EVIDENCE'
 canMoveMoney:false
}>

export type CofferAssetSummary=Readonly<{
 assetId:string
 assetKind:CofferTreasuryAssetKind
 decimals:number
 amountAtomic:bigint
 reportingValueMinor:bigint
 reservedReportingValueMinor:bigint
}>

export type CofferTreasurySnapshot=Readonly<{
 cofferId:string
 userId:string
 reportingCurrency:string
 observedAt:string
 totalReportingValueMinor:bigint
 reservedReportingValueMinor:bigint
 deployableReportingValueMinor:bigint
 assets:readonly CofferAssetSummary[]
 evidenceIds:readonly string[]
 authority:'TREASURY_ACCOUNTING_EVIDENCE'
 canMoveMoney:false
}>

export type CofferTreasuryMovementProposal=Readonly<{
 movementId:string
 kind:CofferTreasuryMovementKind
 userId:string
 cofferId:string
 assetId:string
 amountAtomic:bigint
 sourceEndpointId:string
 destinationEndpointId:string
 idempotencyKey:string
 requestedAt:string
 state:'PENDING_APPROVAL'
 evidenceIds:readonly string[]
 authority:'TREASURY_MOVEMENT_PROPOSAL_ONLY'
 canExecute:false
}>

export type CofferTreasuryMovementRequest=Readonly<{
 movementId:string
 kind:CofferTreasuryMovementKind
 userId:string
 cofferId:string
 assetId:string
 amountAtomic:bigint
 sourceEndpointId:string
 destinationEndpointId:string
 idempotencyKey:string
 requestedAt:string
 authorityId:string
 executionPermitId:string
 standingMandateId?:string
 evidenceIds:readonly string[]
 authority:'TREASURY_MOVEMENT_REQUEST'
 canExecute:false
}>

export type CofferConversionQuote=Readonly<{
 quoteId:string
 provider:string
 sourceEndpointId:string
 destinationEndpointId:string
 sourceAssetId:string
 sourceAssetKind:CofferTreasuryAssetKind
 destinationAssetId:string
 destinationAssetKind:CofferTreasuryAssetKind
 sourceAmountAtomic:bigint
 quotedDestinationAmountAtomic:bigint
 minimumDestinationAmountAtomic:bigint
 rateNumerator:bigint
 rateDenominator:bigint
 providerFeeSourceAtomic:bigint
 networkFeeSourceAtomic:bigint
 spreadBps:number
 quotedAt:string
 expiresAt:string
 evidenceIds:readonly string[]
 authority:'TREASURY_CONVERSION_QUOTE_ONLY'
 canExecute:false
}>

export type CofferConversionProposal=Readonly<{
 conversionId:string
 quoteId:string
 conversionClass:CofferConversionClass
 provider:string
 userId:string
 cofferId:string
 sourceEndpointId:string
 destinationEndpointId:string
 sourceAssetId:string
 destinationAssetId:string
 sourceAmountAtomic:bigint
 minimumDestinationAmountAtomic:bigint
 idempotencyKey:string
 requestedAt:string
 quoteFingerprint:string
 state:'PENDING_APPROVAL'
 evidenceIds:readonly string[]
 authority:'TREASURY_CONVERSION_PROPOSAL_ONLY'
 canExecute:false
}>

export type CofferConversionRequest=Readonly<{
 conversionId:string
 quoteId:string
 conversionClass:CofferConversionClass
 provider:string
 userId:string
 cofferId:string
 sourceEndpointId:string
 destinationEndpointId:string
 sourceAssetId:string
 destinationAssetId:string
 sourceAmountAtomic:bigint
 minimumDestinationAmountAtomic:bigint
 idempotencyKey:string
 requestedAt:string
 quoteFingerprint:string
 authorityId:string
 executionPermitId:string
 standingMandateId?:string
 evidenceIds:readonly string[]
 authority:'TREASURY_CONVERSION_REQUEST'
 canExecute:false
}>

export type CofferConversionInstruction=Readonly<{
 instructionId:string
 conversionId:string
 quoteId:string
 provider:string
 sourceEndpointId:string
 destinationEndpointId:string
 sourceAssetId:string
 destinationAssetId:string
 sourceAmountAtomic:bigint
 minimumDestinationAmountAtomic:bigint
 idempotencyKey:string
 approvalRequired:true
 reconciliationRequired:true
 authority:'TREASURY_CONVERSION_INSTRUCTION_ONLY'
 canExecute:false
}>

export interface CofferConversionAdapter{
 readonly provider:string
 quote(input:{
  sourceEndpoint:CofferTreasuryEndpoint
  destinationEndpoint:CofferTreasuryEndpoint
  sourceAssetId:string
  sourceAssetKind:CofferTreasuryAssetKind
  destinationAssetId:string
  destinationAssetKind:CofferTreasuryAssetKind
  sourceAmountAtomic:bigint
  now:string
 }):Promise<CofferConversionQuote>
 prepareInstruction(request:CofferConversionRequest,quote:CofferConversionQuote):Promise<CofferConversionInstruction>
}

function required(value:string,code:string):void{if(!value.trim())throw new Error(code)}
function validIso(value:string):boolean{return Boolean(value.trim())&&!Number.isNaN(Date.parse(value))}
function unique(values:readonly string[]):readonly string[]{return Object.freeze([...new Set(values)])}
function nonNegativeBps(value:number,code:string):void{if(!Number.isInteger(value)||value<0||value>10000)throw new Error(code)}
function hash(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item)).digest('hex')
}

export function classifyCofferConversion(source:CofferTreasuryAssetKind,destination:CofferTreasuryAssetKind):CofferConversionClass{
 if(source==='FIAT'&&destination==='FIAT')return 'FIAT_FX'
 if(source==='FIAT')return 'FIAT_TO_CRYPTO'
 if(destination==='FIAT')return 'CRYPTO_TO_FIAT'
 return 'CRYPTO_TO_CRYPTO'
}

export function assertCofferTreasuryEndpoint(endpoint:CofferTreasuryEndpoint):void{
 for(const [value,code] of [
  [endpoint.endpointId,'COFFER_TREASURY_ENDPOINT_ID_REQUIRED'],
  [endpoint.userId,'COFFER_TREASURY_ENDPOINT_USER_REQUIRED'],
  [endpoint.provider,'COFFER_TREASURY_ENDPOINT_PROVIDER_REQUIRED'],
  [endpoint.accountRef,'COFFER_TREASURY_ENDPOINT_ACCOUNT_REQUIRED'],
 ] as const)required(value,code)
 if(endpoint.authority!=='TREASURY_ENDPOINT_EVIDENCE'||endpoint.containsRawCredential!==false)throw new Error('COFFER_TREASURY_ENDPOINT_AUTHORITY_INVALID')
 if(!endpoint.verified)throw new Error('COFFER_TREASURY_ENDPOINT_UNVERIFIED')
 if(!endpoint.supportedAssets.length||endpoint.supportedAssets.some(x=>!x.trim()))throw new Error('COFFER_TREASURY_ENDPOINT_ASSETS_REQUIRED')
 if(!endpoint.evidenceIds.length)throw new Error('COFFER_TREASURY_ENDPOINT_EVIDENCE_REQUIRED')
}

export function assertCofferAssetBalanceEvidence(balance:CofferAssetBalanceEvidence):void{
 for(const [value,code] of [
  [balance.balanceId,'COFFER_TREASURY_BALANCE_ID_REQUIRED'],
  [balance.cofferId,'COFFER_TREASURY_COFFER_ID_REQUIRED'],
  [balance.userId,'COFFER_TREASURY_USER_ID_REQUIRED'],
  [balance.custodyId,'COFFER_TREASURY_CUSTODY_ID_REQUIRED'],
  [balance.provider,'COFFER_TREASURY_PROVIDER_REQUIRED'],
  [balance.assetId,'COFFER_TREASURY_ASSET_ID_REQUIRED'],
  [balance.reportingCurrency,'COFFER_TREASURY_REPORTING_CURRENCY_REQUIRED'],
 ] as const)required(value,code)
 if(balance.authority!=='TREASURY_BALANCE_EVIDENCE'||balance.canMoveMoney!==false)throw new Error('COFFER_TREASURY_BALANCE_AUTHORITY_INVALID')
 if(balance.amountAtomic<0n||balance.reportingValueMinor<0n||balance.reservedReportingValueMinor<0n)throw new Error('COFFER_TREASURY_BALANCE_NEGATIVE')
 if(balance.reservedReportingValueMinor>balance.reportingValueMinor)throw new Error('COFFER_TREASURY_RESERVE_EXCEEDS_VALUE')
 if(!Number.isInteger(balance.decimals)||balance.decimals<0||balance.decimals>36)throw new Error('COFFER_TREASURY_DECIMALS_INVALID')
 if(!validIso(balance.observedAt))throw new Error('COFFER_TREASURY_BALANCE_TIME_INVALID')
 if(!balance.evidenceIds.length)throw new Error('COFFER_TREASURY_BALANCE_EVIDENCE_REQUIRED')
}

export function buildCofferTreasurySnapshot(input:{
 cofferId:string
 userId:string
 reportingCurrency:string
 balances:readonly CofferAssetBalanceEvidence[]
 observedAt:string
}):CofferTreasurySnapshot{
 required(input.cofferId,'COFFER_TREASURY_COFFER_ID_REQUIRED')
 required(input.userId,'COFFER_TREASURY_USER_ID_REQUIRED')
 required(input.reportingCurrency,'COFFER_TREASURY_REPORTING_CURRENCY_REQUIRED')
 if(!validIso(input.observedAt))throw new Error('COFFER_TREASURY_SNAPSHOT_TIME_INVALID')
 if(!input.balances.length)throw new Error('COFFER_TREASURY_BALANCES_REQUIRED')
 const byAsset=new Map<string,{assetId:string;assetKind:CofferTreasuryAssetKind;decimals:number;amountAtomic:bigint;reportingValueMinor:bigint;reservedReportingValueMinor:bigint}>()
 const evidenceIds:string[]=[]
 let total=0n
 let reserved=0n
 for(const balance of input.balances){
  assertCofferAssetBalanceEvidence(balance)
  if(balance.cofferId!==input.cofferId||balance.userId!==input.userId)throw new Error('COFFER_TREASURY_BALANCE_OWNERSHIP_MISMATCH')
  if(balance.reportingCurrency!==input.reportingCurrency)throw new Error('COFFER_TREASURY_REPORTING_CURRENCY_MISMATCH')
  if(balance.observedAt>input.observedAt)throw new Error('COFFER_TREASURY_FUTURE_BALANCE_EVIDENCE')
  const prior=byAsset.get(balance.assetId)
  if(prior&&(prior.assetKind!==balance.assetKind||prior.decimals!==balance.decimals))throw new Error('COFFER_TREASURY_ASSET_DEFINITION_MISMATCH')
  byAsset.set(balance.assetId,{
   assetId:balance.assetId,assetKind:balance.assetKind,decimals:balance.decimals,
   amountAtomic:(prior?.amountAtomic??0n)+balance.amountAtomic,
   reportingValueMinor:(prior?.reportingValueMinor??0n)+balance.reportingValueMinor,
   reservedReportingValueMinor:(prior?.reservedReportingValueMinor??0n)+balance.reservedReportingValueMinor,
  })
  total+=balance.reportingValueMinor
  reserved+=balance.reservedReportingValueMinor
  evidenceIds.push(...balance.evidenceIds,balance.balanceId)
 }
 return Object.freeze({
  cofferId:input.cofferId,userId:input.userId,reportingCurrency:input.reportingCurrency,observedAt:input.observedAt,
  totalReportingValueMinor:total,reservedReportingValueMinor:reserved,deployableReportingValueMinor:total-reserved,
  assets:Object.freeze([...byAsset.values()].map(x=>Object.freeze({...x}))),
  evidenceIds:unique(evidenceIds),
  authority:'TREASURY_ACCOUNTING_EVIDENCE' as const,canMoveMoney:false as const,
 })
}

function assertEndpointForAsset(endpoint:CofferTreasuryEndpoint,userId:string,assetId:string):void{
 assertCofferTreasuryEndpoint(endpoint)
 if(endpoint.userId!==userId)throw new Error('COFFER_TREASURY_ENDPOINT_OWNER_MISMATCH')
 if(!endpoint.supportedAssets.includes(assetId))throw new Error('COFFER_TREASURY_ENDPOINT_ASSET_NOT_SUPPORTED')
}

export function createCofferTreasuryMovementProposal(input:{
 movementId:string
 kind:CofferTreasuryMovementKind
 userId:string
 cofferId:string
 assetId:string
 amountAtomic:bigint
 source:CofferTreasuryEndpoint
 destination:CofferTreasuryEndpoint
 idempotencyKey:string
 requestedAt:string
}):CofferTreasuryMovementProposal{
 for(const [value,code] of [
  [input.movementId,'COFFER_TREASURY_MOVEMENT_ID_REQUIRED'],
  [input.userId,'COFFER_TREASURY_MOVEMENT_USER_REQUIRED'],
  [input.cofferId,'COFFER_TREASURY_MOVEMENT_COFFER_REQUIRED'],
  [input.assetId,'COFFER_TREASURY_MOVEMENT_ASSET_REQUIRED'],
  [input.idempotencyKey,'COFFER_TREASURY_MOVEMENT_IDEMPOTENCY_REQUIRED'],
 ] as const)required(value,code)
 if(input.amountAtomic<=0n)throw new Error('COFFER_TREASURY_MOVEMENT_AMOUNT_INVALID')
 if(!validIso(input.requestedAt))throw new Error('COFFER_TREASURY_MOVEMENT_TIME_INVALID')
 if(input.source.endpointId===input.destination.endpointId)throw new Error('COFFER_TREASURY_MOVEMENT_ENDPOINTS_MUST_DIFFER')
 assertEndpointForAsset(input.source,input.userId,input.assetId)
 assertEndpointForAsset(input.destination,input.userId,input.assetId)
 if(input.kind==='DEPOSIT'&&(input.source.scope!=='OWNER_EXTERNAL'||input.destination.scope!=='COFFER'))throw new Error('COFFER_TREASURY_DEPOSIT_DIRECTION_INVALID')
 if(input.kind==='WITHDRAWAL'&&(input.source.scope!=='COFFER'||input.destination.scope!=='OWNER_EXTERNAL'))throw new Error('COFFER_TREASURY_WITHDRAWAL_DIRECTION_INVALID')
 if(input.kind==='TRANSFER'&&input.source.scope!=='COFFER'&&input.destination.scope!=='COFFER')throw new Error('COFFER_TREASURY_TRANSFER_COFFER_ENDPOINT_REQUIRED')
 return Object.freeze({
  movementId:input.movementId,kind:input.kind,userId:input.userId,cofferId:input.cofferId,assetId:input.assetId,amountAtomic:input.amountAtomic,
  sourceEndpointId:input.source.endpointId,destinationEndpointId:input.destination.endpointId,idempotencyKey:input.idempotencyKey,requestedAt:input.requestedAt,
  state:'PENDING_APPROVAL' as const,evidenceIds:unique([...input.source.evidenceIds,...input.destination.evidenceIds]),
  authority:'TREASURY_MOVEMENT_PROPOSAL_ONLY' as const,canExecute:false as const,
 })
}

export function promoteApprovedCofferTreasuryMovement(input:{
 proposal:CofferTreasuryMovementProposal
 authorityId:string
 executionPermitId:string
 standingMandateId?:string
}):CofferTreasuryMovementRequest{
 required(input.authorityId,'COFFER_TREASURY_MOVEMENT_AUTHORITY_REQUIRED')
 required(input.executionPermitId,'COFFER_TREASURY_MOVEMENT_PERMIT_REQUIRED')
 const p=input.proposal
 if(p.authority!=='TREASURY_MOVEMENT_PROPOSAL_ONLY'||p.canExecute!==false||p.state!=='PENDING_APPROVAL')throw new Error('COFFER_TREASURY_MOVEMENT_PROPOSAL_INVALID')
 return Object.freeze({...p,authorityId:input.authorityId,executionPermitId:input.executionPermitId,standingMandateId:input.standingMandateId,authority:'TREASURY_MOVEMENT_REQUEST' as const,canExecute:false as const})
}

export function assertCofferConversionQuote(quote:CofferConversionQuote,now:string):void{
 for(const [value,code] of [
  [quote.quoteId,'COFFER_CONVERSION_QUOTE_ID_REQUIRED'],
  [quote.provider,'COFFER_CONVERSION_PROVIDER_REQUIRED'],
  [quote.sourceEndpointId,'COFFER_CONVERSION_SOURCE_ENDPOINT_REQUIRED'],
  [quote.destinationEndpointId,'COFFER_CONVERSION_DESTINATION_ENDPOINT_REQUIRED'],
  [quote.sourceAssetId,'COFFER_CONVERSION_SOURCE_ASSET_REQUIRED'],
  [quote.destinationAssetId,'COFFER_CONVERSION_DESTINATION_ASSET_REQUIRED'],
 ] as const)required(value,code)
 if(quote.authority!=='TREASURY_CONVERSION_QUOTE_ONLY'||quote.canExecute!==false)throw new Error('COFFER_CONVERSION_QUOTE_AUTHORITY_INVALID')
 if(quote.sourceAssetId===quote.destinationAssetId)throw new Error('COFFER_CONVERSION_DISTINCT_ASSETS_REQUIRED')
 if(quote.sourceEndpointId===quote.destinationEndpointId&&quote.sourceAssetId===quote.destinationAssetId)throw new Error('COFFER_CONVERSION_NOOP_FORBIDDEN')
 if(quote.sourceAmountAtomic<=0n||quote.quotedDestinationAmountAtomic<=0n||quote.minimumDestinationAmountAtomic<=0n)throw new Error('COFFER_CONVERSION_AMOUNT_INVALID')
 if(quote.minimumDestinationAmountAtomic>quote.quotedDestinationAmountAtomic)throw new Error('COFFER_CONVERSION_MINIMUM_OUTPUT_INVALID')
 if(quote.rateNumerator<=0n||quote.rateDenominator<=0n)throw new Error('COFFER_CONVERSION_RATE_INVALID')
 if(quote.providerFeeSourceAtomic<0n||quote.networkFeeSourceAtomic<0n||quote.providerFeeSourceAtomic+quote.networkFeeSourceAtomic>=quote.sourceAmountAtomic)throw new Error('COFFER_CONVERSION_FEE_INVALID')
 nonNegativeBps(quote.spreadBps,'COFFER_CONVERSION_SPREAD_INVALID')
 if(!validIso(quote.quotedAt)||!validIso(quote.expiresAt)||!validIso(now))throw new Error('COFFER_CONVERSION_TIME_INVALID')
 if(quote.quotedAt>now)throw new Error('COFFER_CONVERSION_QUOTE_FROM_FUTURE')
 if(quote.expiresAt<=quote.quotedAt||quote.expiresAt<=now)throw new Error('COFFER_CONVERSION_QUOTE_EXPIRED')
 if(!quote.evidenceIds.length)throw new Error('COFFER_CONVERSION_QUOTE_EVIDENCE_REQUIRED')
}

export function fingerprintCofferConversionQuote(quote:CofferConversionQuote):string{
 return hash({
  quoteId:quote.quoteId,provider:quote.provider,sourceEndpointId:quote.sourceEndpointId,destinationEndpointId:quote.destinationEndpointId,
  sourceAssetId:quote.sourceAssetId,sourceAssetKind:quote.sourceAssetKind,destinationAssetId:quote.destinationAssetId,destinationAssetKind:quote.destinationAssetKind,
  sourceAmountAtomic:quote.sourceAmountAtomic,quotedDestinationAmountAtomic:quote.quotedDestinationAmountAtomic,minimumDestinationAmountAtomic:quote.minimumDestinationAmountAtomic,
  rateNumerator:quote.rateNumerator,rateDenominator:quote.rateDenominator,providerFeeSourceAtomic:quote.providerFeeSourceAtomic,networkFeeSourceAtomic:quote.networkFeeSourceAtomic,
  spreadBps:quote.spreadBps,quotedAt:quote.quotedAt,expiresAt:quote.expiresAt,evidenceIds:quote.evidenceIds,
 })
}

export function createCofferConversionProposal(input:{
 quote:CofferConversionQuote
 userId:string
 cofferId:string
 source:CofferTreasuryEndpoint
 destination:CofferTreasuryEndpoint
 idempotencyKey:string
 requestedAt:string
 now:string
}):CofferConversionProposal{
 assertCofferConversionQuote(input.quote,input.now)
 required(input.userId,'COFFER_CONVERSION_USER_REQUIRED')
 required(input.cofferId,'COFFER_CONVERSION_COFFER_REQUIRED')
 required(input.idempotencyKey,'COFFER_CONVERSION_IDEMPOTENCY_REQUIRED')
 if(!validIso(input.requestedAt)||input.requestedAt>input.now)throw new Error('COFFER_CONVERSION_REQUEST_TIME_INVALID')
 assertEndpointForAsset(input.source,input.userId,input.quote.sourceAssetId)
 assertEndpointForAsset(input.destination,input.userId,input.quote.destinationAssetId)
 if(input.quote.sourceEndpointId!==input.source.endpointId||input.quote.destinationEndpointId!==input.destination.endpointId)throw new Error('COFFER_CONVERSION_ENDPOINT_BINDING_MISMATCH')
 const quoteFingerprint=fingerprintCofferConversionQuote(input.quote)
 const conversionClass=classifyCofferConversion(input.quote.sourceAssetKind,input.quote.destinationAssetKind)
 return Object.freeze({
  conversionId:'coffer-conversion:'+hash({userId:input.userId,cofferId:input.cofferId,quoteFingerprint,idempotencyKey:input.idempotencyKey}),
  quoteId:input.quote.quoteId,conversionClass,provider:input.quote.provider,userId:input.userId,cofferId:input.cofferId,
  sourceEndpointId:input.source.endpointId,destinationEndpointId:input.destination.endpointId,
  sourceAssetId:input.quote.sourceAssetId,destinationAssetId:input.quote.destinationAssetId,
  sourceAmountAtomic:input.quote.sourceAmountAtomic,minimumDestinationAmountAtomic:input.quote.minimumDestinationAmountAtomic,
  idempotencyKey:input.idempotencyKey,requestedAt:input.requestedAt,quoteFingerprint,state:'PENDING_APPROVAL' as const,
  evidenceIds:unique([...input.quote.evidenceIds,...input.source.evidenceIds,...input.destination.evidenceIds]),
  authority:'TREASURY_CONVERSION_PROPOSAL_ONLY' as const,canExecute:false as const,
 })
}

export function promoteApprovedCofferConversion(input:{
 proposal:CofferConversionProposal
 authorityId:string
 executionPermitId:string
 standingMandateId?:string
}):CofferConversionRequest{
 required(input.authorityId,'COFFER_CONVERSION_AUTHORITY_REQUIRED')
 required(input.executionPermitId,'COFFER_CONVERSION_PERMIT_REQUIRED')
 const p=input.proposal
 if(p.authority!=='TREASURY_CONVERSION_PROPOSAL_ONLY'||p.canExecute!==false||p.state!=='PENDING_APPROVAL')throw new Error('COFFER_CONVERSION_PROPOSAL_INVALID')
 return Object.freeze({...p,authorityId:input.authorityId,executionPermitId:input.executionPermitId,standingMandateId:input.standingMandateId,authority:'TREASURY_CONVERSION_REQUEST' as const,canExecute:false as const})
}

export function assertCofferConversionInstruction(input:{
 request:CofferConversionRequest
 quote:CofferConversionQuote
 instruction:CofferConversionInstruction
 now:string
}):void{
 assertCofferConversionQuote(input.quote,input.now)
 const {request,quote,instruction}=input
 if(request.quoteFingerprint!==fingerprintCofferConversionQuote(quote)||request.quoteId!==quote.quoteId)throw new Error('COFFER_CONVERSION_QUOTE_BINDING_MISMATCH')
 if(instruction.authority!=='TREASURY_CONVERSION_INSTRUCTION_ONLY'||instruction.canExecute!==false||instruction.approvalRequired!==true||instruction.reconciliationRequired!==true)throw new Error('COFFER_CONVERSION_INSTRUCTION_AUTHORITY_INVALID')
 if(instruction.conversionId!==request.conversionId||instruction.quoteId!==request.quoteId||instruction.provider!==request.provider)throw new Error('COFFER_CONVERSION_INSTRUCTION_BINDING_MISMATCH')
 if(instruction.sourceEndpointId!==request.sourceEndpointId||instruction.destinationEndpointId!==request.destinationEndpointId)throw new Error('COFFER_CONVERSION_INSTRUCTION_ENDPOINT_MISMATCH')
 if(instruction.sourceAssetId!==request.sourceAssetId||instruction.destinationAssetId!==request.destinationAssetId)throw new Error('COFFER_CONVERSION_INSTRUCTION_ASSET_MISMATCH')
 if(instruction.sourceAmountAtomic!==request.sourceAmountAtomic||instruction.minimumDestinationAmountAtomic<request.minimumDestinationAmountAtomic)throw new Error('COFFER_CONVERSION_INSTRUCTION_ECONOMICS_MISMATCH')
 if(instruction.idempotencyKey!==request.idempotencyKey)throw new Error('COFFER_CONVERSION_INSTRUCTION_IDEMPOTENCY_MISMATCH')
}
