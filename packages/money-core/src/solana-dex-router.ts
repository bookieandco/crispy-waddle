import type {
 DexManagedOrder,
 DexProviderExecutionReceipt,
 DexSignedTransaction,
 DexSwapIntent,
 ManagedSolanaDexAdapter,
 ManagedSolanaDexVenueAdapter,
 SolanaDexVenueProvider,
} from './solana-dex-runtime-contracts.js'

export const DEFAULT_SOLANA_DEX_ROUTE_ORDER=Object.freeze([
 'jupiter-ultra',
 'raydium-direct',
 'meteora-direct',
] as const)

export class UniversalSolanaDexRouter implements ManagedSolanaDexAdapter{
 readonly provider='solana-dex-router' as const
 private readonly adapters:ReadonlyMap<SolanaDexVenueProvider,ManagedSolanaDexVenueAdapter>
 private readonly fallbackOrder:readonly SolanaDexVenueProvider[]
 constructor(input:{
  adapters:readonly ManagedSolanaDexVenueAdapter[]
  fallbackOrder?:readonly SolanaDexVenueProvider[]
 }){
  const map=new Map<SolanaDexVenueProvider,ManagedSolanaDexVenueAdapter>()
  for(const adapter of input.adapters){
   if(map.has(adapter.provider))throw new Error('DEX_ROUTER_DUPLICATE_PROVIDER:'+adapter.provider)
   map.set(adapter.provider,adapter)
  }
  if(!map.size)throw new Error('DEX_ROUTER_ADAPTER_REQUIRED')
  this.adapters=map
  this.fallbackOrder=Object.freeze([...(input.fallbackOrder??DEFAULT_SOLANA_DEX_ROUTE_ORDER)])
  for(const provider of this.fallbackOrder)if(!map.has(provider))throw new Error('DEX_ROUTER_FALLBACK_ADAPTER_MISSING:'+provider)
 }
 private candidates(intent:DexSwapIntent):readonly SolanaDexVenueProvider[]{
  if(intent.provider!=='solana-dex-router')return Object.freeze([intent.provider])
  if(intent.routePreference==='AUTO')return this.fallbackOrder
  return Object.freeze([intent.routePreference,...this.fallbackOrder.filter(p=>p!==intent.routePreference)])
 }
 async createOrder(input:{intent:DexSwapIntent;takerAddress:string}):Promise<DexManagedOrder>{
  const failures:string[]=[]
  for(const provider of this.candidates(input.intent)){
   const adapter=this.adapters.get(provider)
   if(!adapter){failures.push(provider+':ADAPTER_MISSING');continue}
   try{
    const order=await adapter.createOrder(input)
    if(order.provider!==provider)throw new Error('ORDER_PROVIDER_MISMATCH')
    if(order.inputMint!==input.intent.inputMint||order.outputMint!==input.intent.outputMint||order.inputAmountAtomic!==input.intent.inputAmountAtomic)throw new Error('ORDER_BINDING_MISMATCH')
    return order
   }catch(error){
    failures.push(provider+':'+(error instanceof Error?error.message:'UNKNOWN'))
   }
  }
  throw new Error('DEX_ROUTER_ALL_ROUTES_FAILED:'+failures.join('|'))
 }
 async executeSigned(input:{intent:DexSwapIntent;order:DexManagedOrder;signed:DexSignedTransaction;now:string}):Promise<DexProviderExecutionReceipt>{
  const adapter=this.adapters.get(input.order.provider)
  if(!adapter)throw new Error('DEX_ROUTER_EXECUTION_ADAPTER_MISSING:'+input.order.provider)
  const receipt=await adapter.executeSigned(input)
  if(receipt.provider!==input.order.provider||receipt.requestId!==input.order.requestId||receipt.executionId!==input.intent.executionId)throw new Error('DEX_ROUTER_EXECUTION_RECEIPT_MISMATCH')
  return receipt
 }
}
