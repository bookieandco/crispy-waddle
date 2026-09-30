export type CacheEntryKind='model'|'lora'|'asset'|'proxy'|'checkpoint';

export type CacheEntry={
  id:string;
  kind:CacheEntryKind;
  sizeGiB:number;
  priority:number;
  lastAccessedAt:string;
  pinned?:boolean;
  activeReferences?:number;
  durableReceiptRef?:string;
};

export type CacheEvictionPlan={
  requiredGiB:number;
  freeGiBBefore:number;
  evictIds:readonly string[];
  reclaimedGiB:number;
  freeGiBAfter:number;
  admissible:boolean;
  blockingEntries:readonly string[];
};

function evictable(entry:CacheEntry):boolean{
  if(entry.pinned)return false;
  if((entry.activeReferences??0)>0)return false;
  if(entry.kind==='checkpoint'&&!entry.durableReceiptRef)return false;
  return true;
}

export function planCacheEvictions(
  entries:readonly CacheEntry[],
  requiredGiB:number,
  freeGiB:number,
):CacheEvictionPlan{
  if(!Number.isFinite(requiredGiB)||requiredGiB<0)throw new Error('CACHE_REQUIRED_SPACE_INVALID');
  if(!Number.isFinite(freeGiB)||freeGiB<0)throw new Error('CACHE_FREE_SPACE_INVALID');
  const need=Math.max(requiredGiB-freeGiB,0);
  if(need===0){
    return {
      requiredGiB,freeGiBBefore:freeGiB,evictIds:Object.freeze([]),
      reclaimedGiB:0,freeGiBAfter:freeGiB,admissible:true,blockingEntries:Object.freeze([]),
    };
  }
  const candidates=entries.filter(evictable).sort((a,b)=>{
    if(a.priority!==b.priority)return a.priority-b.priority;
    const byAge=a.lastAccessedAt.localeCompare(b.lastAccessedAt);
    return byAge!==0?byAge:a.id.localeCompare(b.id);
  });
  const evictIds:string[]=[];
  let reclaimed=0;
  for(const entry of candidates){
    if(reclaimed>=need)break;
    evictIds.push(entry.id);
    reclaimed+=entry.sizeGiB;
  }
  const blocking=entries.filter(entry=>!evictable(entry)).map(entry=>entry.id).sort();
  return {
    requiredGiB,
    freeGiBBefore:freeGiB,
    evictIds:Object.freeze(evictIds),
    reclaimedGiB:Number(reclaimed.toFixed(3)),
    freeGiBAfter:Number((freeGiB+reclaimed).toFixed(3)),
    admissible:freeGiB+reclaimed>=requiredGiB,
    blockingEntries:Object.freeze(blocking),
  };
}

export type CacheWarmRequest={
  id:string;
  kind:Exclude<CacheEntryKind,'checkpoint'>;
  sizeGiB:number;
  priority:number;
  localityKey:string;
  digest:string;
};

export type CacheWarmPlan={
  nodeId:string;
  requests:readonly CacheWarmRequest[];
  totalGiB:number;
  eviction:CacheEvictionPlan;
};

export function planCacheWarm(
  nodeId:string,
  requests:readonly CacheWarmRequest[],
  entries:readonly CacheEntry[],
  freeGiB:number,
):CacheWarmPlan{
  if(!nodeId.trim())throw new Error('CACHE_NODE_REQUIRED');
  const deduped=new Map<string,CacheWarmRequest>();
  for(const request of requests){
    if(!request.id.trim()||!request.digest.trim()||request.sizeGiB<=0)throw new Error('CACHE_WARM_REQUEST_INVALID');
    const existing=deduped.get(request.digest);
    if(!existing||request.priority>existing.priority)deduped.set(request.digest,request);
  }
  const ordered=[...deduped.values()].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  const total=ordered.reduce((sum,item)=>sum+item.sizeGiB,0);
  return {
    nodeId,
    requests:Object.freeze(ordered),
    totalGiB:Number(total.toFixed(3)),
    eviction:planCacheEvictions(entries,total,freeGiB),
  };
}
