/**
 * COMMISSION.13 — standing-authorization candidate, never a cron installer.
 * A schedule is eligible only when its owner has separately approved
 * sources, terms, time window and cost-free internal actions.
 */
export type OpportunityDiscoverySchedule = {
  id: string
  ownerId: string
  boards: { source: 'greenhouse'|'lever'; board: string }[]
  approvalReceiptId: string
  ownerApprovedAt: string
  providerTermsReviewedAt: string
  expiresAt: string
  intervalMinutes: number
  maxFindingsPerCycle: number
  lastCycleAt?: string
  paused: boolean
}
export type ScheduleAdmission = {
  state: 'due'|'not_due'|'blocked'
  reasons: string[]
  sourceCount: number
  nextDueAt: string|null
  executionAuthority: 'PUBLIC_READ_ONLY'
  canonicalIngestAuthorized: false
  externalActionAuthorized: false
  estimatedThirdPartyCostUsd: 0
}
export function assessDiscoverySchedule(input:OpportunityDiscoverySchedule,now:string):ScheduleAdmission {
  const reasons:string[]=[]
  const time=Date.parse(now)
  if(!Number.isFinite(time))throw Error('Current timestamp invalid')
  const approved=Date.parse(input.ownerApprovedAt)
  const terms=Date.parse(input.providerTermsReviewedAt)
  const expires=Date.parse(input.expiresAt)
  const last=input.lastCycleAt?Date.parse(input.lastCycleAt):undefined
  if(!input.ownerId?.trim() || !input.approvalReceiptId?.trim())reasons.push('owner consent receipt required')
  if(!Array.isArray(input.boards)||input.boards.length<1||input.boards.length>5)reasons.push('1–5 explicitly permitted boards required')
  const keys=new Set<string>()
  for(const b of input.boards??[]){
    if(!['greenhouse','lever'].includes(b.source)||!/^[a-z0-9][a-z0-9_-]{1,49}$/i.test(b.board))reasons.push('invalid board token')
    const key=b.source+':'+b.board.toLowerCase()
    if(keys.has(key))reasons.push('duplicated board')
    keys.add(key)
  }
  if(!Number.isFinite(approved)||approved>time||!Number.isFinite(terms)||terms>time)reasons.push('valid prior review timestamps required')
  if(!Number.isFinite(expires)||expires<=time||expires-approved>30*86400_000)reasons.push('approval expired or exceeds 30 days')
  if(!Number.isInteger(input.intervalMinutes)||input.intervalMinutes<60||input.intervalMinutes>10080)reasons.push('schedule interval must be 1 hour to 7 days')
  if(!Number.isInteger(input.maxFindingsPerCycle)||input.maxFindingsPerCycle<1||input.maxFindingsPerCycle>25)reasons.push('per-cycle finding budget 1–25 required')
  if(last!==undefined && (!Number.isFinite(last)||last>time))reasons.push('invalid last-run observation')
  if(input.paused)reasons.push('owner has paused this schedule')
  const nextDueAt=last===undefined?now:new Date(last+input.intervalMinutes*60_000).toISOString()
  return {
    state:reasons.length?'blocked':last!==undefined&&time<last+input.intervalMinutes*60_000?'not_due':'due',
    reasons,sourceCount:input.boards?.length??0,nextDueAt,
    executionAuthority:'PUBLIC_READ_ONLY',canonicalIngestAuthorized:false,
    externalActionAuthorized:false,estimatedThirdPartyCostUsd:0,
  }
}
