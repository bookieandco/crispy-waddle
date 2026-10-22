/** Runtime readiness is different from process liveness, paper evidence and
 * investment performance. Missing/old cycles must never return HTTP 200 READY. */
type RecordLike=Record<string,unknown>
const obj=(x:unknown):x is RecordLike=>typeof x==='object'&&x!==null&&!Array.isArray(x)
const paper=(x:unknown):x is RecordLike=>obj(x)&&x.authority==='SHADOW_LEARNING_ONLY'
  && x.canExecute===false
const live=(x:unknown)=>paper(x)&&x.canSign===false&&x.canBroadcast===false
const outcome=(x:unknown)=>paper(x)&&x.canAuthorizeLive===false

export type ShadowReadiness=Readonly<{
  status:'ready'|'blocked'|'degraded'
  code:'READY'|'NO_SUCCESSFUL_CYCLE'|'STALE_CYCLE'|'CYCLE_FAILURE'|'PAPER_AUTHORITY_INVALID'
  httpStatus:200|503
}>

export function classifyShadowServiceReadiness(input:Readonly<{
  now:string
  service:unknown
  lastError?:string
  intervalSeconds:number
}>):ShadowReadiness{
  if(input.lastError)return {status:'degraded',code:'CYCLE_FAILURE',httpStatus:503}
  const service=input.service
  if(!obj(service)||service.status!=='ready'||!obj(service.lastCycle))
    return {status:'blocked',code:'NO_SUCCESSFUL_CYCLE',httpStatus:503}
  const cycle=service.lastCycle
  if(!live(service)||!live(cycle.live)||!outcome(cycle.outcomes))
    return {status:'blocked',code:'PAPER_AUTHORITY_INVALID',httpStatus:503}
  const now=Date.parse(input.now)
  const updated=typeof service.updatedAt==='string'?Date.parse(service.updatedAt):NaN
  const maxAgeMs=3*Math.max(60,Math.min(3600,input.intervalSeconds))*1000
  if(!Number.isFinite(now)||!Number.isFinite(updated)||updated>now
     || now-updated>maxAgeMs)
    return {status:'degraded',code:'STALE_CYCLE',httpStatus:503}
  return {status:'ready',code:'READY',httpStatus:200}
}
