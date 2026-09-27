export type MoneyMarketLane='STOCK'|'FOREX'|'DEX'
export type ConnectorAdmission='UNCOMMISSIONED'|'READ_ONLY'|'SHADOW'|'CONTROLLED_CANARY'|'LIVE'

export type MoneyMarketConnectorDescriptor=Readonly<{
 connectorId:string
 provider:string
 lane:MoneyMarketLane
 admission:ConnectorAdmission
 readCapabilities:readonly string[]
 executionCapabilities:readonly string[]
 credentialRef?:string
 evidenceIds:readonly string[]
 authority:'CONNECTOR_METADATA_ONLY'
}>

export interface MoneyMarketConnector{
 readonly descriptor:MoneyMarketConnectorDescriptor
 health(now:string):Promise<Readonly<{ok:boolean;observedAt:string;evidenceIds:readonly string[]}>>
}

export class MoneyMarketConnectorRegistry{
 private rows=new Map<string,MoneyMarketConnector>()
 register(connector:MoneyMarketConnector){
  const d=connector.descriptor
  if(!d.connectorId||!d.provider||!d.evidenceIds.length)throw new Error('MONEY_LIVE1_MARKET_CONNECTOR_INVALID')
  if(this.rows.has(d.connectorId))throw new Error('MONEY_LIVE1_MARKET_CONNECTOR_DUPLICATE')
  this.rows.set(d.connectorId,connector)
 }
 get(connectorId:string){const x=this.rows.get(connectorId);if(!x)throw new Error('MONEY_LIVE1_MARKET_CONNECTOR_NOT_REGISTERED:'+connectorId);return x}
 byLane(lane:MoneyMarketLane){return Object.freeze([...this.rows.values()].filter(x=>x.descriptor.lane===lane))}
}

export function assertConnectorMayExecute(d:MoneyMarketConnectorDescriptor){
 if(d.admission!=='CONTROLLED_CANARY'&&d.admission!=='LIVE')throw new Error('MONEY_LIVE1_MARKET_CONNECTOR_NOT_EXECUTION_ADMITTED')
 if(!d.executionCapabilities.length)throw new Error('MONEY_LIVE1_MARKET_EXECUTION_CAPABILITY_REQUIRED')
}

/** Stable openings; provider-specific implementations are commissioned separately. */
export const MONEY_LIVE1_CONNECTOR_OPENINGS=Object.freeze([
 Object.freeze({connectorId:'stock:open',provider:'unassigned-stock-broker',lane:'STOCK' as const,admission:'UNCOMMISSIONED' as const,readCapabilities:Object.freeze(['quotes','positions','orders']),executionCapabilities:Object.freeze(['limit-order']),evidenceIds:Object.freeze(['money-live1:stock-opening']),authority:'CONNECTOR_METADATA_ONLY' as const}),
 Object.freeze({connectorId:'forex:open',provider:'unassigned-fx-broker',lane:'FOREX' as const,admission:'UNCOMMISSIONED' as const,readCapabilities:Object.freeze(['quotes','balances','positions']),executionCapabilities:Object.freeze(['spot-order']),evidenceIds:Object.freeze(['money-live1:forex-opening']),authority:'CONNECTOR_METADATA_ONLY' as const}),
 Object.freeze({connectorId:'dex:open',provider:'unassigned-dex-router',lane:'DEX' as const,admission:'UNCOMMISSIONED' as const,readCapabilities:Object.freeze(['quote','route','liquidity']),executionCapabilities:Object.freeze(['swap']),evidenceIds:Object.freeze(['money-live1:dex-opening']),authority:'CONNECTOR_METADATA_ONLY' as const}),
])
