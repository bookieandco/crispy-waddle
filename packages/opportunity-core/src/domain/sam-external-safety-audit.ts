/**
 * SAM-SAFETY-LEDGER.08-.11
 * RESEARCH-ONLY reconciler. This never authenticates supplied records or
 * authorizes external actions. A clean fixture cannot issue a production PASS.
 */
export const SAM_EXTERNAL_SURFACES=[
  'provider_outreach','federal_bid_submission','contract_signature',
  'money_disbursement','fallback_bypass',
] as const
export type SamExternalSurface=typeof SAM_EXTERNAL_SURFACES[number]
export type SamExternalSource=
  'action_core'|'provider_transport'|'external_provider'|'bid_portal'|
  'signature_provider'|'payment_processor'|'fallback_observer'
export type SamExternalReceipt={
  id:string
  operationId:string
  surface:SamExternalSurface
  source:SamExternalSource
  status:'attempted'|'completed'|'failed'
  observedAt:string
  authorizationId?:string
  externalRef?:string
  destinationRef?:string
}
export type SamExternalApproval={
  id:string
  operationId:string
  surface:SamExternalSurface
  status:'approved'|'revoked'|'denied'
  grantedAt:string
  expiresAt?:string
  revokedAt?:string
  destinationRef:string
  scope:'single_execution'
}
export type SamActionTrailEvent={
  id:string
  operationId:string
  surface:SamExternalSurface
  status:'started'|'completed'|'failed'|'denied'|'approval_required'
  occurredAt:string
}
export type SamAuditChainSegment={
  source:SamExternalSource
  // The real chain must have an independent, trusted head and complete fetch
  // before any caller can claim authoritative coverage.
  fromSequence:number
  throughSequence:number
  predecessorHash:string
  records:{sequence:number;previousHash:string;hash:string;eventId:string}[]
}
export type SamExternalSafetyInput={
  window:{from:string;through:string}
  approvals:SamExternalApproval[]
  receipts:SamExternalReceipt[]
  actionEvents:SamActionTrailEvent[]
  chains:SamAuditChainSegment[]
}
export type SamExternalSafetyReport={
  status:'blocked'
  observedUnauthorizedOperations:number|null
  unresolvedOperations:string[]
  observedViolations:string[]
  evidenceGaps:string[]
  chainGaps:string[]
  requiredSources:SamExternalSource[]
  safetyEvidenceComplete:false
  authorizationGranted:false
}

export const SAM_EXTERNAL_SOURCE_INVENTORY:ReadonlyArray<{
  surface:SamExternalSurface
  codeAnchor:string
  needed:readonly SamExternalSource[]
  current:'contract_only'|'not_wired'
}>=Object.freeze([
  {surface:'provider_outreach',codeAnchor:'packages/opportunity-core/src/domain/provider-transport.ts',
    needed:['action_core','provider_transport','external_provider'],current:'contract_only'},
  {surface:'federal_bid_submission',codeAnchor:'packages/opportunity-core/src/domain/proposal-assembly.ts',
    needed:['action_core','bid_portal'],current:'not_wired'},
  {surface:'contract_signature',codeAnchor:'packages/opportunity-core/src/domain/contract-readiness.ts',
    needed:['action_core','signature_provider'],current:'not_wired'},
  {surface:'money_disbursement',codeAnchor:'packages/opportunity-core/src/domain/award-execution-handoff.ts',
    needed:['action_core','payment_processor'],current:'not_wired'},
  {surface:'fallback_bypass',codeAnchor:'packages/jhadina-action-core/src/action-executor.ts',
    needed:['action_core','fallback_observer'],current:'not_wired'},
])

const nonblank=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0
const time=(value:string):number=>Date.parse(value)
const uniq=(values:string[])=>[...new Set(values)]
const goodSequence=(v:number)=>Number.isSafeInteger(v)&&v>=0

/** Detect gaps and contradictions within a delivered chain segment.
 * Deliberately does NOT verify the hash digest algorithm, trusted
 * checkpoint ownership, off-host completeness or WAL consistency.
 */
export function inspectSamAuditChains(segments:readonly SamAuditChainSegment[]):string[]{
  const failures:string[]=[]
  const seen=new Set<string>()
  for(const segment of segments){
    const identity=segment.source
    if(seen.has(identity))failures.push(`duplicate chain segment for ${identity}`)
    seen.add(identity)
    if(!goodSequence(segment.fromSequence)||!goodSequence(segment.throughSequence)||
      segment.fromSequence>segment.throughSequence||!nonblank(segment.predecessorHash)){
      failures.push(`invalid chain bounds for ${identity}`)
      continue
    }
    const expected=segment.throughSequence-segment.fromSequence+1
    if(segment.records.length!==expected)failures.push(`incomplete chain page for ${identity}`)
    let previous=segment.predecessorHash
    for(let index=0;index<segment.records.length;index++){
      const record=segment.records[index]
      if(record.sequence!==segment.fromSequence+index)failures.push(`sequence gap for ${identity}`)
      if(!nonblank(record.hash)||!nonblank(record.eventId)||record.previousHash!==previous){
        failures.push(`broken hash linkage for ${identity}`)
      }
      previous=record.hash
    }
  }
  return uniq(failures)
}

/**
 * Detect known violations plus unprovable unknowns. No combination of user-
 * provided booleans, empty arrays, contiguous hashes or fixture receipts is
 * sufficient to assert "no unauthorized external actions".
 */
export function reconcileSamExternalSafety(input:SamExternalSafetyInput):SamExternalSafetyReport{
  const violations:string[]=[]
  const gaps:string[]=[]
  const unresolved=new Set<string>()
  const requiredSources=uniq(SAM_EXTERNAL_SOURCE_INVENTORY.flatMap(row=>row.needed))
    as SamExternalSource[]
  const from=time(input.window.from),through=time(input.window.through)
  const validWindow=Number.isFinite(from)&&Number.isFinite(through)&&from<=through
  if(!validWindow)gaps.push('Invalid or unbounded audit time window.')

  const receiptIds=new Set<string>(),actionIds=new Set<string>(),approvalIds=new Set<string>()
  const operationId=(id:string)=>nonblank(id)?id:'<missing-operation-id>'
  for(const receipt of input.receipts){
    if(!nonblank(receipt.id)||receiptIds.has(receipt.id))gaps.push('Missing or duplicate external receipt ID.')
    receiptIds.add(receipt.id)
    if(!nonblank(receipt.operationId)||!nonblank(receipt.source))gaps.push('External receipt lacks operation/source identity.')
    if(!validWindow||!Number.isFinite(time(receipt.observedAt))||
      time(receipt.observedAt)<from||time(receipt.observedAt)>through)gaps.push('External receipt outside declared audit window.')
  }
  for(const event of input.actionEvents){
    if(!nonblank(event.id)||actionIds.has(event.id))gaps.push('Missing or duplicate Action Core event ID.')
    actionIds.add(event.id)
    if(!nonblank(event.operationId))gaps.push('Action Core event has no operation identity.')
    if(!validWindow||!Number.isFinite(time(event.occurredAt))||
      time(event.occurredAt)<from||time(event.occurredAt)>through)gaps.push('Action Core event outside declared audit window.')
  }
  for(const approval of input.approvals){
    if(!nonblank(approval.id)||approvalIds.has(approval.id))gaps.push('Missing or duplicate approval ID.')
    approvalIds.add(approval.id)
    if(!nonblank(approval.operationId)||!nonblank(approval.destinationRef))gaps.push('Approval lacks operation/destination scope.')
    if(!Number.isFinite(time(approval.grantedAt))||
      approval.expiresAt&&!Number.isFinite(time(approval.expiresAt))||
      approval.revokedAt&&!Number.isFinite(time(approval.revokedAt))){
      gaps.push('Invalid approval timestamps.')
    }
  }

  const successful=input.receipts.filter(r=>r.status==='completed')
  const actionComplete=input.actionEvents.filter(e=>e.status==='completed')
  const successfulByAuthorization=new Map<string,Set<string>>()
  for(const receipt of successful){
    const id=operationId(receipt.operationId)
    const approvals=input.approvals.filter(a=>
      a.id===receipt.authorizationId&&a.operationId===receipt.operationId&&
      a.surface===receipt.surface&&a.scope==='single_execution'&&
      a.status==='approved'&&a.destinationRef===receipt.destinationRef&&
      time(a.grantedAt)<=time(receipt.observedAt)&&
      (!a.expiresAt||time(receipt.observedAt)<time(a.expiresAt))&&
      (!a.revokedAt||time(receipt.observedAt)<time(a.revokedAt)),
    )
    if(!approvals.length){
      violations.push(`observed completion without valid single-operation approval: ${id}`)
      unresolved.add(id)
    }
    if(!nonblank(receipt.externalRef)){
      gaps.push(`missing external execution reference: ${id}`)
      unresolved.add(id)
    }
    if(!input.actionEvents.some(e=>e.operationId===receipt.operationId&&
      e.surface===receipt.surface&&e.status==='completed')){
      gaps.push(`external completion without matching Action Core completion: ${id}`)
      unresolved.add(id)
    }
    if(receipt.authorizationId){
      const uses=successfulByAuthorization.get(receipt.authorizationId)??new Set<string>()
      uses.add(receipt.operationId)
      successfulByAuthorization.set(receipt.authorizationId,uses)
    }
    const needed=SAM_EXTERNAL_SOURCE_INVENTORY.find(s=>s.surface===receipt.surface)?.needed??[]
    for(const source of needed){
      // An Action Core log is checked separately from external receipts.
      if(source==='action_core')continue
      const witness=input.receipts.some(r=>r.operationId===receipt.operationId&&
        r.surface===receipt.surface&&r.source===source&&r.status==='completed'&&
        r.externalRef===receipt.externalRef)
      if(!witness){gaps.push(`no matching ${source} witness for ${id}`);unresolved.add(id)}
    }
  }
  for(const [authorizationId,operations] of successfulByAuthorization){
    if(operations.size>1)violations.push(`single-execution approval reused: ${authorizationId}`)
  }
  for(const event of actionComplete){
    const id=operationId(event.operationId)
    if(!successful.some(r=>r.operationId===event.operationId&&r.surface===event.surface)){
      gaps.push(`Action Core completion without external execution receipt: ${id}`)
      unresolved.add(id)
    }
  }
  // An attempted action or failed send may already have caused a side effect;
  // both require independent resolution evidence before closing the window.
  for(const event of input.actionEvents){
    if(event.status==='started'||event.status==='failed'){
      const hasResolution=successful.some(r=>r.operationId===event.operationId&&r.surface===event.surface)
      if(!hasResolution){gaps.push(`unreconciled Action Core ${event.status}: ${operationId(event.operationId)}`);unresolved.add(operationId(event.operationId))}
    }
  }
  for(const r of input.receipts.filter(r=>r.status==='attempted'||r.status==='failed')){
    if(!successful.some(s=>s.operationId===r.operationId&&s.surface===r.surface)){
      gaps.push(`unreconciled transport ${r.status}: ${operationId(r.operationId)}`)
      unresolved.add(operationId(r.operationId))
    }
  }
  const chainGaps=inspectSamAuditChains(input.chains)
  for(const source of requiredSources){
    if(!input.chains.some(c=>c.source===source))gaps.push(`missing source chain/read fence: ${source}`)
  }
  for(const surface of SAM_EXTERNAL_SOURCE_INVENTORY){
    if(surface.current!=='contract_only')gaps.push(`canonical external receipt adapter not commissioned: ${surface.surface}`)
  }
  // Source snapshots, including any hash-chain segments, are not proof of
  // independent tamper resistance; these two requirements remain unfulfilled.
  gaps.push('No independently authenticated, off-host checkpoint/root hash and continuous read fence.')
  gaps.push('No demonstrated complete cross-channel provider, portal, signature, payment and fallback capture.')
  return {
    status:'blocked',
    observedUnauthorizedOperations:violations.length?uniq(violations).length:null,
    unresolvedOperations:[...unresolved].sort(),
    observedViolations:uniq(violations).sort(),
    evidenceGaps:uniq(gaps).sort(),
    chainGaps,
    requiredSources,
    safetyEvidenceComplete:false,
    authorizationGranted:false,
  }
}
