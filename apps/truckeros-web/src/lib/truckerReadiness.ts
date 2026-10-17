/** A prototype is never a production-ready TruckerOS merely because Next boots. */
export interface TruckerReadiness {ready:boolean;status:"not_commissioned"|"development_preview";limitations:string[];}
export function truckerReadiness(env:string|undefined):TruckerReadiness {
  const limitations=["NO_AUTHENTICATED_TENANT_RUNTIME","NO_DURABLE_DRIVER_STATE","NO_VERIFIED_LIVE_FREIGHT","NO_TRUCK_ROUTING_CERTIFICATION"];
  if(env==="production")return {ready:false,status:"not_commissioned",limitations};
  return {ready:true,status:"development_preview",limitations};
}
