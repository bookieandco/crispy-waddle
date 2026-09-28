export const EDGE_007_GUARD_VERSION = 'EDGE-007-v1' as const

export type IntegrityActionKind =
  | 'MONITOR_PUBLIC_ATTENTION'
  | 'ANALYZE_NARRATIVE'
  | 'ANALYZE_WALLET_FLOW'
  | 'EXECUTE_APPROVED_SWAP'
  | 'PUBLISH_DISCLOSED_RESEARCH'
  | 'COORDINATED_PROMOTION'
  | 'SPAM_AMPLIFICATION'
  | 'FAKE_VOLUME'
  | 'WASH_TRADE'
  | 'SELF_TRADE'
  | 'MISLEADING_CLAIM'
  | 'WITHHOLD_MATERIAL_RISK'
  | 'TARGETED_HYPE_FOR_EXIT_LIQUIDITY'
  | 'MANUFACTURE_SOCIAL_PROOF'

export type IntegrityReasonCode =
  | 'EDGE007_COORDINATED_PROMOTION_FORBIDDEN'
  | 'EDGE007_SPAM_AMPLIFICATION_FORBIDDEN'
  | 'EDGE007_FAKE_VOLUME_FORBIDDEN'
  | 'EDGE007_WASH_TRADING_FORBIDDEN'
  | 'EDGE007_SELF_DEALING_FORBIDDEN'
  | 'EDGE007_MISLEADING_CLAIM_FORBIDDEN'
  | 'EDGE007_MATERIAL_RISK_OMISSION_FORBIDDEN'
  | 'EDGE007_EXIT_LIQUIDITY_ENGINEERING_FORBIDDEN'
  | 'EDGE007_MANUFACTURED_SOCIAL_PROOF_FORBIDDEN'
  | 'EDGE007_POSITION_DISCLOSURE_REQUIRED'
  | 'EDGE007_EVIDENCE_REQUIRED'
  | 'EDGE007_ACTION_REQUIRED'

export type IntegrityRequestedAction = Readonly<{
  kind: IntegrityActionKind
  description?: string
}>

export type IntegrityGuardInput = Readonly<{
  guardId: string
  evaluatedAt: string
  token: Readonly<{ chainId: string; tokenAddress: string }>
  actorPosition: 'NONE' | 'LONG' | 'SHORT'
  positionDisclosure: 'NOT_APPLICABLE' | 'DISCLOSED' | 'UNDISCLOSED'
  actions: readonly IntegrityRequestedAction[]
  evidenceIds: readonly string[]
}>

export type IntegrityGuardResult = Readonly<{
  guardVersion: typeof EDGE_007_GUARD_VERSION
  guardId: string
  evaluatedAt: string
  token: Readonly<{ chainId: string; tokenAddress: string }>
  disposition: 'PASS' | 'BLOCK'
  reasonCodes: readonly IntegrityReasonCode[]
  blockedActions: readonly IntegrityActionKind[]
  evidenceIds: readonly string[]
  authority: 'INTEGRITY_VETO_ONLY'
  canAuthorizeTrade: false
  canAuthorizePromotion: false
}>

const FORBIDDEN: Readonly<Partial<Record<IntegrityActionKind, IntegrityReasonCode>>> = Object.freeze({
  COORDINATED_PROMOTION: 'EDGE007_COORDINATED_PROMOTION_FORBIDDEN',
  SPAM_AMPLIFICATION: 'EDGE007_SPAM_AMPLIFICATION_FORBIDDEN',
  FAKE_VOLUME: 'EDGE007_FAKE_VOLUME_FORBIDDEN',
  WASH_TRADE: 'EDGE007_WASH_TRADING_FORBIDDEN',
  SELF_TRADE: 'EDGE007_SELF_DEALING_FORBIDDEN',
  MISLEADING_CLAIM: 'EDGE007_MISLEADING_CLAIM_FORBIDDEN',
  WITHHOLD_MATERIAL_RISK: 'EDGE007_MATERIAL_RISK_OMISSION_FORBIDDEN',
  TARGETED_HYPE_FOR_EXIT_LIQUIDITY: 'EDGE007_EXIT_LIQUIDITY_ENGINEERING_FORBIDDEN',
  MANUFACTURE_SOCIAL_PROOF: 'EDGE007_MANUFACTURED_SOCIAL_PROOF_FORBIDDEN',
})

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code)
}

function iso(value: string, code: string): void {
  nonEmpty(value, code)
  if (Number.isNaN(Date.parse(value))) throw new Error(code)
}

export function evaluateIntegrityGuard(input: IntegrityGuardInput): IntegrityGuardResult {
  nonEmpty(input.guardId, 'EDGE007_GUARD_ID_REQUIRED')
  nonEmpty(input.token.chainId, 'EDGE007_CHAIN_ID_REQUIRED')
  nonEmpty(input.token.tokenAddress, 'EDGE007_TOKEN_ADDRESS_REQUIRED')
  iso(input.evaluatedAt, 'EDGE007_EVALUATED_AT_INVALID')

  const reasonCodes: IntegrityReasonCode[] = []
  const blockedActions: IntegrityActionKind[] = []

  if (!input.evidenceIds.length) reasonCodes.push('EDGE007_EVIDENCE_REQUIRED')
  if (!input.actions.length) reasonCodes.push('EDGE007_ACTION_REQUIRED')

  for (const action of input.actions) {
    const code = FORBIDDEN[action.kind]
    if (code) {
      blockedActions.push(action.kind)
      reasonCodes.push(code)
    }
  }

  const publishesResearch = input.actions.some((action) => action.kind === 'PUBLISH_DISCLOSED_RESEARCH')
  if (
    publishesResearch &&
    input.actorPosition !== 'NONE' &&
    input.positionDisclosure !== 'DISCLOSED'
  ) {
    reasonCodes.push('EDGE007_POSITION_DISCLOSURE_REQUIRED')
  }

  const uniqueReasons = Object.freeze([...new Set(reasonCodes)])
  const uniqueBlocked = Object.freeze([...new Set(blockedActions)])

  return Object.freeze({
    guardVersion: EDGE_007_GUARD_VERSION,
    guardId: input.guardId,
    evaluatedAt: input.evaluatedAt,
    token: Object.freeze({ ...input.token }),
    disposition: uniqueReasons.length ? 'BLOCK' : 'PASS',
    reasonCodes: uniqueReasons,
    blockedActions: uniqueBlocked,
    evidenceIds: Object.freeze([...new Set(input.evidenceIds)]),
    authority: 'INTEGRITY_VETO_ONLY',
    canAuthorizeTrade: false,
    canAuthorizePromotion: false,
  })
}

export function assertIntegrityGuardPassed(result: IntegrityGuardResult): void {
  if (
    result.guardVersion !== EDGE_007_GUARD_VERSION ||
    result.authority !== 'INTEGRITY_VETO_ONLY' ||
    result.canAuthorizeTrade !== false ||
    result.canAuthorizePromotion !== false
  ) {
    throw new Error('EDGE007_AUTHORITY_ESCALATION_FORBIDDEN')
  }
  if (result.disposition !== 'PASS' || result.reasonCodes.length || result.blockedActions.length) {
    throw new Error('EDGE007_INTEGRITY_BLOCKED')
  }
  if (!result.evidenceIds.length) throw new Error('EDGE007_EVIDENCE_REQUIRED')
}
