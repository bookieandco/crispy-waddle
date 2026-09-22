export type SamCoverageInterval={postedFrom:string;postedTo:string}
export type SamMarketCoverage={
  complete:boolean
  coveredFrom:string|null
  coveredTo:string|null
  coverageDays:number
  targetFrom:string
  targetTo:string
  gaps:Array<{from:string;to:string}>
}
const DAY=86_400_000
const isoDay=(d:Date)=>d.toISOString().slice(0,10)
const parseDay=(value:string)=>{
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:
    /^(\d{2})\/(\d{2})\/(\d{4})$/.test(value)?value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/,'$3-$1-$2'):null
  if(!iso)return null
  const d=new Date(iso+'T00:00:00.000Z')
  return Number.isNaN(d.getTime())?null:d
}
const clampDay=(d:Date)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))
const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*DAY)

export function computeSamMarketCoverage(input:{
  intervals:SamCoverageInterval[]
  targetFrom:string
  targetTo:string
}):SamMarketCoverage{
  const targetFrom=parseDay(input.targetFrom),targetTo=parseDay(input.targetTo)
  if(!targetFrom||!targetTo||targetFrom>targetTo)throw new Error('Invalid SAM coverage target')
  const intervals=input.intervals
    .map(x=>({from:parseDay(x.postedFrom),to:parseDay(x.postedTo)}))
    .filter((x):x is {from:Date;to:Date}=>Boolean(x.from&&x.to&&x.from<=x.to))
    .map(x=>({from:x.from<targetFrom?targetFrom:x.from,to:x.to>targetTo?targetTo:x.to}))
    .filter(x=>x.from<=x.to)
    .sort((a,b)=>a.from.getTime()-b.from.getTime())

  const merged:Array<{from:Date;to:Date}>=[]
  for(const next of intervals){
    const last=merged.at(-1)
    if(!last||next.from.getTime()>last.to.getTime()+DAY)merged.push({...next})
    else if(next.to>last.to)last.to=next.to
  }
  const gaps:Array<{from:string;to:string}>=[]
  let cursor=targetFrom
  for(const span of merged){
    if(span.from>cursor)gaps.push({from:isoDay(cursor),to:isoDay(addDays(span.from,-1))})
    if(span.to>=cursor)cursor=addDays(span.to,1)
  }
  if(cursor<=targetTo)gaps.push({from:isoDay(cursor),to:isoDay(targetTo)})
  const complete=gaps.length===0
  const coveredFrom=merged[0]?.from??null
  const coveredTo=merged.at(-1)?.to??null
  const coveredDays=merged.reduce((sum,x)=>sum+Math.floor((x.to.getTime()-x.from.getTime())/DAY)+1,0)
  return {
    complete,
    coveredFrom:coveredFrom?isoDay(coveredFrom):null,
    coveredTo:coveredTo?isoDay(coveredTo):null,
    coverageDays:coveredDays,
    targetFrom:isoDay(targetFrom),
    targetTo:isoDay(targetTo),
    gaps,
  }
}

export function nextSamBootstrapWindow(input:{
  intervals:SamCoverageInterval[]
  today:string
  historyDays:number
  windowDays:number
}):{from:string;to:string}|null{
  const today=parseDay(input.today)
  if(!today)throw new Error('Invalid SAM bootstrap today')
  const historyDays=Math.max(1,Math.min(Math.floor(input.historyDays),3650))
  const windowDays=Math.max(1,Math.min(Math.floor(input.windowDays),31))
  const targetFrom=addDays(today,-(historyDays-1))
  const coverage=computeSamMarketCoverage({
    intervals:input.intervals,
    targetFrom:isoDay(targetFrom),
    targetTo:isoDay(today),
  })
  if(coverage.complete)return null
  // Work backward from the newest uncovered gap so rolling current scans and
  // bootstrap scans naturally form one contiguous coverage chain.
  const gap=coverage.gaps.at(-1)!
  const gapFrom=parseDay(gap.from)!,gapTo=parseDay(gap.to)!
  const fromCandidate=addDays(gapTo,-(windowDays-1))
  const from=fromCandidate<gapFrom?gapFrom:fromCandidate
  return {from:isoDay(clampDay(from)),to:isoDay(clampDay(gapTo))}
}
