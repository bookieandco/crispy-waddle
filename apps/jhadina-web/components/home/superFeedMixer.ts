import type {Story} from "./storyTypes"

/**
 * Inspired by Will Boyd's MIT-licensed SuperFeed FeedCoordinator (2017):
 * https://github.com/lonekorean/super-feed
 * This is a new, pure, per-request TypeScript presentation mixer. It never
 * fetches providers, polls in the background, invents posts or saves accounts.
 * Input is already verified and ordered newest-first by the caller.
 */
export function balancedSourceMix<T extends Pick<Story,"source">>(
  sorted:readonly T[],
  options:{maxStreak?:number;minPerSource?:number;limit?:number}={},
):T[]{
  const maxStreak=boundedInteger(options.maxStreak,2,1,5)
  const minPerSource=boundedInteger(options.minPerSource,2,0,5)
  const limit=boundedInteger(options.limit,sorted.length,0,500)
  const buckets=new Map<string,T[]>()
  for(const item of sorted){
    const items=buckets.get(item.source)??[]
    items.push(item)
    buckets.set(item.source,items)
  }
  const served=new Map<string,number>()
  const result:T[]=[]
  let previous=""
  let streak=0
  while(result.length<Math.min(limit,sorted.length)){
    const heads=[...buckets.entries()].filter(([,rows])=>rows.length>0)
    if(heads.length===0)break
    const underQuota=heads.filter(([source])=>(served.get(source)??0)<minPerSource)
    const candidates=underQuota.length?underQuota:heads
    // Keep source streaks bounded whenever any alternative exists.
    const alternatives=candidates.filter(([source])=>source!==previous||streak<maxStreak)
    const pool=alternatives.length?alternatives:candidates
    // Stable ordering: first in input is newest (the caller already sorted).
    const source=pool.reduce((best,[name,rows])=>{
      const index=sorted.indexOf(rows[0])
      return index<best.index?{name,index}:best
    },{name:pool[0][0],index:Infinity}).name
    const item=buckets.get(source)?.shift()
    if(!item)break
    result.push(item)
    served.set(source,(served.get(source)??0)+1)
    streak=source===previous?streak+1:1
    previous=source
  }
  return result
}

function boundedInteger(value:number|undefined,fallback:number,min:number,max:number){
  return value===undefined?fallback:Number.isSafeInteger(value)?Math.max(min,Math.min(max,value)):fallback
}
