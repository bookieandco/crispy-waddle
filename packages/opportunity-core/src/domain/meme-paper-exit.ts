/**
 * MEME-PROFIT.07–.10: emergency pause, disclosed wind-down plan and closure
 * of a PAPER-ONLY study. This state machine has no chain, wallet or funds path.
 */
export type PaperExitState = 'RESEARCH' | 'PAUSED' | 'OWNER_REVIEWED' |
  'NOTICE_RECORDED_UNVERIFIED' | 'CLOSED_PAPER'
export type PaperExitAction = 'PAUSE' | 'OWNER_REVIEW' | 'RECORD_NOTICE' | 'CLOSE_PAPER'
export type PaperExitReceipt = {
  sequence: number
  at: string
  action: PaperExitAction
  from: PaperExitState
  to: PaperExitState
  note: string
  evidenceRefs: string[]
  externalActionPerformed: false
}
export type PaperExitCase = {
  id: string
  ownerId: string
  status: PaperExitState
  protectedLiquidity: true
  marketManipulationForbidden: true
  walletActionsEnabled: false
  tokenSaleAuthorized: false
  custodyMovementAuthorized: false
  receipts: readonly PaperExitReceipt[]
}
export type PaperExitStep = {
  action: PaperExitAction
  at: string
  note: string
  evidenceRefs: readonly string[]
  ownerConfirmed?: boolean
  noticeUrl?: string
  termsReference?: string
}

const transitions: Record<PaperExitState, Partial<Record<PaperExitAction, PaperExitState>>> = {
  RESEARCH: { PAUSE: 'PAUSED' },
  PAUSED: { OWNER_REVIEW: 'OWNER_REVIEWED' },
  OWNER_REVIEWED: { RECORD_NOTICE: 'NOTICE_RECORDED_UNVERIFIED', PAUSE: 'PAUSED' },
  NOTICE_RECORDED_UNVERIFIED: { CLOSE_PAPER: 'CLOSED_PAPER', PAUSE: 'PAUSED' },
  CLOSED_PAPER: {},
}

export function beginPaperExitCase(id: string, ownerId: string): PaperExitCase {
  if (!/^[a-z0-9:_-]{3,128}$/i.test(id) || !/^[a-z0-9:_-]{3,128}$/i.test(ownerId)) {
    throw Error('EXIT_CASE_IDENTITY_INVALID')
  }
  return {
    id, ownerId, status: 'RESEARCH', protectedLiquidity: true,
    marketManipulationForbidden: true, walletActionsEnabled: false,
    tokenSaleAuthorized: false, custodyMovementAuthorized: false,
    receipts: [],
  }
}

/** Every state change is a note/receipt only; no signature, webhook or transfer. */
export function advancePaperExitCase(current: PaperExitCase, event: PaperExitStep): PaperExitCase {
  if (!current || current.protectedLiquidity !== true ||
      current.marketManipulationForbidden !== true ||
      current.walletActionsEnabled !== false ||
      current.tokenSaleAuthorized !== false || current.custodyMovementAuthorized !== false) {
    throw Error('EXIT_CASE_AUTHORITY_INVALID')
  }
  const next = transitions[current.status]?.[event.action]
  if (!next) throw Error('EXIT_TRANSITION_DENIED')
  const ts=Date.parse(event.at)
  if (!Number.isFinite(ts) || !event.note?.trim() || event.note.length > 500) {
    throw Error('EXIT_EVIDENCE_INVALID')
  }
  if (!Array.isArray(event.evidenceRefs) || !event.evidenceRefs.length ||
      event.evidenceRefs.length > 16 || event.evidenceRefs.some(x=>typeof x!=='string'|| !x.trim() || x.length>250)) {
    throw Error('EXIT_REFERENCES_REQUIRED')
  }
  const prior=current.receipts[current.receipts.length-1]
  if (prior && !(ts>Date.parse(prior.at))) throw Error('EXIT_CLOCK_NOT_MONOTONIC')
  if (event.action==='OWNER_REVIEW' && event.ownerConfirmed!==true) {
    throw Error('EXIT_OWNER_CONFIRMATION_REQUIRED')
  }
  if (event.action==='RECORD_NOTICE') {
    if (typeof event.noticeUrl!=='string' || !/^https:\/\//i.test(event.noticeUrl) ||
        typeof event.termsReference!=='string' || !event.termsReference.trim()) {
      throw Error('EXIT_NOTICE_AND_TERMS_REQUIRED')
    }
  }
  // A submitted URL is NOT evidence the notice was actually published or seen.
  const receipt: PaperExitReceipt={
    sequence:current.receipts.length+1,at:event.at,action:event.action,
    from:current.status,to:next,note:event.note.trim(),
    evidenceRefs:[...event.evidenceRefs],externalActionPerformed:false,
  }
  return {...current,status:next,receipts:[...current.receipts,receipt]}
}
