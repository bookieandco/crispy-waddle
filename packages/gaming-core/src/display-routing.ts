export type GamingDisplayRouteKind='local-display'|'homebase-tv'|'phone-cast'|'remote-display';

export interface GamingDisplayRoute {
  id:string;
  kind:GamingDisplayRouteKind;
  available:boolean;
  latencyMs:number;
  direct:boolean;
  supportsLowLatency:boolean;
}

export interface GamingDisplayRoutingPolicy {
  maxLatencyMs:number;
  requireLowLatency?:boolean;
  preferDirectHomebaseTv?:boolean;
}

export interface GamingDisplayRouteDecision {
  allowed:boolean;
  route?:GamingDisplayRoute;
  reason:'selected'|'no-viable-display-route';
}

export function selectGamingDisplayRoute(
  routes:readonly GamingDisplayRoute[],
  policy:GamingDisplayRoutingPolicy,
):GamingDisplayRouteDecision{
  if(!Number.isFinite(policy.maxLatencyMs)||policy.maxLatencyMs<0)throw new Error('maxLatencyMs must be non-negative');
  const viable=routes.filter(route=>
    route.available&&
    Number.isFinite(route.latencyMs)&&
    route.latencyMs>=0&&
    route.latencyMs<=policy.maxLatencyMs&&
    (!policy.requireLowLatency||route.supportsLowLatency)
  );
  if(viable.length===0)return{allowed:false,reason:'no-viable-display-route'};
  const preferred=policy.preferDirectHomebaseTv??true;
  const ranked=[...viable].sort((a,b)=>{
    const aDirect=preferred&&a.kind==='homebase-tv'&&a.direct?0:1;
    const bDirect=preferred&&b.kind==='homebase-tv'&&b.direct?0:1;
    return aDirect-bDirect||a.latencyMs-b.latencyMs||a.id.localeCompare(b.id);
  });
  return{allowed:true,route:ranked[0],reason:'selected'};
}
