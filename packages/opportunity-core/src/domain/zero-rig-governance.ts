/**
 * JH-ZERO-RIG.06 — maps action proposals TO existing canonical governance.
 * Does not create an approval, authorize an action, or implement another executor.
 * Any consequential action needs an evidence-complete canonical Opportunity
 * pursuit and a separate Policy -> Owner Approval -> Action Core execution flow.
 */
export type ZeroRigActionKind =
  | 'research_read' | 'paper_draft' | 'register_agent' | 'submit_bounty'
  | 'claim_reward' | 'publish_paid_api' | 'accept_payment' | 'buy_compute'
  | 'transfer_tokens' | 'run_miner' | 'activate_bandwidth_share'
export type ZeroRigGovernanceReferral = {
  action: ZeroRigActionKind
  verdict: 'local_research_only' | 'blocked_external_action'
  canonicalHandoff: 'OpportunityActionIntent -> Policy -> Approval -> Action Core'
  prerequisites: string[]
  requiresOwnerApproval: true
  policyRequired: true
  actionAuthorized: false
  fundsAuthorized: false
  walletAccessAuthorized: false
  providerCredentialsAvailable: false
  reason: string
}
const LOCAL = new Set<ZeroRigActionKind>(['research_read', 'paper_draft'])
export function assessZeroRigAction(action: ZeroRigActionKind): ZeroRigGovernanceReferral {
  const local = LOCAL.has(action)
  return {
    action, verdict: local ? 'local_research_only' : 'blocked_external_action',
    canonicalHandoff: 'OpportunityActionIntent -> Policy -> Approval -> Action Core',
    prerequisites: local
      ? ['Use only sanitized, already obtained material; no unapproved external requests']
      : ['Official terms and personal eligibility confirmed', 'Canonical Opportunity fully verified',
        'Evidence-complete pursuit and owner-approved action intent', 'Existing Policy/Action Core execution owner',
        'Credentials and bounded limits commissioned separately', 'Auditable receipt and stop control'],
    requiresOwnerApproval: true, policyRequired: true, actionAuthorized: false,
    fundsAuthorized: false, walletAccessAuthorized: false, providerCredentialsAvailable: false,
    reason: local ? 'Local analysis only; no network side effects' : 'No live executor is commissioned for this action',
  }
}
/** An explicit guard for future adapters: never use this research package as an executor. */
export function denyZeroRigExternalExecution(action: ZeroRigActionKind): never {
  throw new Error('ZERO_RIG_EXTERNAL_ACTION_UNAUTHORIZED:' + action)
}
