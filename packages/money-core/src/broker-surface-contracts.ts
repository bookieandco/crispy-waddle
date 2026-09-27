export type BrokerReadCapability='ACCOUNT'|'QUOTE'|'POSITIONS'|'ORDERS'|'HISTORICALS'|'DIVIDENDS'|'EARNINGS'|'WATCHLISTS'
export type BrokerWriteCapability='LIMIT_ORDER'|'CANCEL_ORDER'

export type BrokerSurfaceDescriptor=Readonly<{
 provider:string
 officialApi:boolean
 authentication:'OFFICIAL_TOKEN'|'OFFICIAL_OAUTH'|'PRIVATE_REVERSE_ENGINEERED'|'OTHER'
 readCapabilities:readonly BrokerReadCapability[]
 writeCapabilities:readonly BrokerWriteCapability[]
 executionAllowed:boolean
 evidenceIds:readonly string[]
 authority:'BROKER_SURFACE_METADATA_ONLY'
}>

export function assertBrokerSurfaceEligibleForCommissioning(d:BrokerSurfaceDescriptor){
 if(!d.provider||!d.evidenceIds.length)throw new Error('MONEY_COMMISSION1_BROKER_SURFACE_INVALID')
 if(!d.officialApi||d.authentication==='PRIVATE_REVERSE_ENGINEERED')throw new Error('MONEY_COMMISSION1_UNOFFICIAL_BROKER_EXECUTION_FORBIDDEN')
 if(!d.executionAllowed)throw new Error('MONEY_COMMISSION1_BROKER_EXECUTION_DISABLED')
}

export const ROBINHOOD_NODE_REFERENCE_SURFACE:BrokerSurfaceDescriptor=Object.freeze({
 provider:'robinhood-node-reference-only',
 officialApi:false,
 authentication:'PRIVATE_REVERSE_ENGINEERED' as const,
 readCapabilities:Object.freeze(['ACCOUNT','QUOTE','POSITIONS','ORDERS','HISTORICALS','DIVIDENDS','EARNINGS','WATCHLISTS'] as const),
 writeCapabilities:Object.freeze(['LIMIT_ORDER','CANCEL_ORDER'] as const),
 executionAllowed:false,
 evidenceIds:Object.freeze(['reference:aurbano-robinhood-node']),
 authority:'BROKER_SURFACE_METADATA_ONLY' as const,
})
