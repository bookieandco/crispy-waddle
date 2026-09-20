import type { ProviderDiscoveryAdapter, ProviderDiscoveryObservation, ProviderDiscoverySource } from './provider-discovery.js'
export type ProviderSourceClient={search(input:{keywords:string[];naicsCodes:string[];pscCodes:string[];geography?:string;limit:number}):Promise<ProviderDiscoveryObservation[]>}
export function createProviderSourceAdapter(id:string,source:ProviderDiscoverySource,client:ProviderSourceClient):ProviderDiscoveryAdapter{return{id,source,async discover(input){const rows=await client.search(input);return rows.map(r=>({...r,source}))}}}
export const providerSourceConnectorKinds=['sam_entity','sam_award','staffing_workforce','entity_directory','local_business','web_search'] as const
